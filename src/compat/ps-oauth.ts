/**
 * Pokémon Showdown OAuth2 (smogon/pokemon-showdown-loginserver OAUTH.md).
 *
 * The safest login for a third-party client: the user's password is only
 * ever typed on play.pokemonshowdown.com. The authorize page redirects back
 * with an assertion (immediate login) and a two-week token that mints future
 * assertions silently via `oauth/api/getassertion`.
 *
 * All `oauth/api/*` endpoints set CORS headers, so the browser calls them
 * directly — no proxy involved.
 */

const OAUTH_ROOT = import.meta.env.VITE_PS_OAUTH_ROOT || 'https://play.pokemonshowdown.com/api';
const TOKEN_KEY = 'arena-ps-oauth-token';
const TOKEN_META_KEY = 'arena-ps-oauth-meta';
export const OAUTH_STORAGE_KEY = 'arena-ps-oauth-session-v1';
/** Tokens live two weeks server-side; refresh once past half-life. */
const TOKEN_LIFETIME = 14 * 24 * 60 * 60 * 1000;

export const oauthClientId = (): string =>
  (import.meta.env.VITE_PS_OAUTH_CLIENT_ID as string | undefined)?.trim() || '';

export const oauthConfigured = (): boolean => !!oauthClientId();

export type OAuthGrant = { assertion: string; token: string; user: string };

type StoredToken = { token: string; user: string; issuedAt: number };

export const storedOAuthToken = (): StoredToken | null => {
  try {
    const record = localStorage.getItem(OAUTH_STORAGE_KEY);
    const meta = JSON.parse(record || localStorage.getItem(TOKEN_META_KEY) || '{}') as Partial<StoredToken>;
    const token = record ? meta?.token : localStorage.getItem(TOKEN_KEY);
    if (!token || typeof token !== 'string') return null;
    if (!meta || typeof meta.issuedAt !== 'number' || !Number.isFinite(meta.issuedAt) || Date.now() - meta.issuedAt > TOKEN_LIFETIME) {
      clearOAuthToken();
      return null;
    }
    return { token, user: typeof meta.user === 'string' ? meta.user : '', issuedAt: meta.issuedAt };
  } catch {
    return null;
  }
};

export const saveOAuthToken = (token: string, user: string, issuedAt = Date.now()): boolean => {
  try {
    localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify({ token, user, issuedAt } satisfies StoredToken));
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_META_KEY);
    return true;
  } catch {
    return false;
  }
};

export const clearOAuthToken = (): void => {
  try {
    localStorage.removeItem(OAUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_META_KEY);
  } catch { /* Storage may be disabled; logout still ends the live session. */ }
};

/**
 * Loginserver responses are either a raw assertion string or `]`-prefixed
 * JSON. Assertions starting with `;` are refusals.
 */
const parseAssertionResponse = (body: string): { assertion?: string; user?: string; failed?: boolean } => {
  const text = body.trim();
  if (text.startsWith(']')) {
    try {
      const data = JSON.parse(text.slice(1)) as { success?: unknown; data?: string; assertion?: string; user?: string };
      if (data.success === false) return { failed: true };
      const assertion = data.data ?? data.assertion;
      if (typeof assertion === 'string' && assertion && !assertion.startsWith(';')) {
        return { assertion, user: typeof data.user === 'string' ? data.user : undefined };
      }
      return { failed: true };
    } catch {
      return { failed: true };
    }
  }
  if (!text || text.startsWith(';')) return { failed: true };
  return { assertion: text };
};

/** Silent login: mint an assertion for `challstr` from a stored token. */
export const assertionFromToken = async (
  challstr: string,
  token: string,
  signal?: AbortSignal
): Promise<{ assertion: string; user?: string } | null> => {
  const url = new URL(`${OAUTH_ROOT}/oauth/api/getassertion`);
  url.searchParams.set('challenge', challstr);
  url.searchParams.set('client_id', oauthClientId());
  url.searchParams.set('token', token);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The login server returned an error (HTTP ${response.status}).`);
  const parsed = parseAssertionResponse(await response.text());
  if (parsed.failed || !parsed.assertion) return null;
  return { assertion: parsed.assertion, user: parsed.user };
};

/** Rotate a token past its half-life; returns the replacement or null. */
export const refreshOAuthToken = async (token: string, signal?: AbortSignal): Promise<string | null> => {
  const url = new URL(`${OAUTH_ROOT}/oauth/api/refreshtoken`);
  url.searchParams.set('client_id', oauthClientId());
  url.searchParams.set('token', token);
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const text = (await response.text()).trim();
  if (!text.startsWith(']')) return null;
  try {
    const data = JSON.parse(text.slice(1)) as { success?: unknown };
    return typeof data.success === 'string' && data.success ? data.success : null;
  } catch {
    return null;
  }
};

export const authorizeUrl = (challstr: string, state?: string): string => {
  const url = new URL(`${OAUTH_ROOT}/oauth/authorize`);
  // A static page, not an SPA route: the popup shouldn't boot a second copy
  // of the client, and this path resolves identically in dev and production.
  const callback = new URL('/oauth.html', location.origin);
  if (state) callback.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', callback.toString());
  url.searchParams.set('client_id', oauthClientId());
  url.searchParams.set('challenge', challstr);
  return url.toString();
};

/**
 * Open the authorize page in a popup and wait for the grant. Two signals,
 * either wins: the /oauth callback page postMessages the grant, and (the
 * upstream reference pattern) the opener polls the popup's URL once it is
 * back on our origin.
 */
export const requestOAuthGrant = (challstr: string, signal?: AbortSignal): Promise<OAuthGrant> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Login cancelled.', 'AbortError')); return; }
    const state = crypto.randomUUID();
    const popup = window.open(authorizeUrl(challstr, state), `ps-oauth-${state}`, 'popup=1,width=500,height=700');
    if (!popup) {
      reject(new Error('The login popup was blocked. Allow popups for this site and try again.'));
      return;
    }
    let settled = false;
    const settle = (grant: OAuthGrant | null, error?: string) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      signal?.removeEventListener('abort', onAbort);
      clearInterval(poll);
      clearTimeout(timeout);
      try { popup.name = ''; popup.close(); } catch { /* already closed */ }
      if (grant) resolve(grant);
      else reject(new Error(error || 'Login was cancelled.'));
    };
    const fromParams = (params: URLSearchParams): OAuthGrant | null => {
      if (params.get('state') !== state) return null;
      const assertion = params.get('assertion');
      const token = params.get('token');
      const user = params.get('user') || '';
      if (!assertion || assertion.startsWith(';') || !token) return null;
      return { assertion, token, user };
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== popup) return;
      const data = event.data as { type?: string; search?: string };
      if (data?.type !== 'ps-oauth' || typeof data.search !== 'string') return;
      const params = new URLSearchParams(data.search);
      if (params.get('state') !== state) return;
      try { if (popup.location.pathname !== '/oauth.html') return; } catch { return; }
      const grant = fromParams(params);
      settle(grant, grant ? undefined : 'The login server did not return an assertion.');
    };
    window.addEventListener('message', onMessage);
    const poll = setInterval(() => {
      try {
        if (popup.closed) { settle(null); return; }
        if (popup.location?.origin === location.origin && popup.location.pathname === '/oauth.html') {
          const query = popup.name.startsWith('ps-oauth:') ? popup.name.slice(9) : popup.location.search;
          const grant = fromParams(new URLSearchParams(query));
          if (grant) settle(grant);
        }
      } catch { /* still cross-origin */ }
    }, 500);
    const onAbort = () => settle(null, 'Login was cancelled.');
    const timeout = setTimeout(() => settle(null, 'Authorization timed out. Open sign-in again to retry.'), 5 * 60_000);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** Web Locks serialize rotation across tabs; without them keep the valid token
 * until expiry rather than race a destructive refresh in shared storage. */
export async function currentOAuthToken(signal: AbortSignal): Promise<StoredToken | null> {
  const refresh = async () => {
    const stored = storedOAuthToken();
    if (!stored || signal.aborted) return null;
    if (Date.now() - stored.issuedAt < TOKEN_LIFETIME / 2) return stored;
    const replacement = await refreshOAuthToken(stored.token, signal);
    if (signal.aborted || storedOAuthToken()?.token !== stored.token) return storedOAuthToken();
    if (!replacement) return stored;
    if (!saveOAuthToken(replacement, stored.user)) return { token: replacement, user: stored.user, issuedAt: Date.now() };
    return storedOAuthToken();
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('arena-oauth-refresh', { signal }, refresh);
  }
  return storedOAuthToken();
}

export const __testables = { parseAssertionResponse };
