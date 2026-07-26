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

const OAUTH_ROOT = 'https://play.pokemonshowdown.com/api';
const TOKEN_KEY = 'arena-ps-oauth-token';
const TOKEN_META_KEY = 'arena-ps-oauth-meta';
/** Tokens live two weeks server-side; refresh once past half-life. */
const TOKEN_LIFETIME = 14 * 24 * 60 * 60 * 1000;

export const oauthClientId = (): string =>
  (import.meta.env.VITE_PS_OAUTH_CLIENT_ID as string | undefined)?.trim() || '';

export const oauthConfigured = (): boolean => !!oauthClientId();

export type OAuthGrant = { assertion: string; token: string; user: string };

type StoredToken = { token: string; user: string; issuedAt: number };

export const storedOAuthToken = (): StoredToken | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const meta = JSON.parse(localStorage.getItem(TOKEN_META_KEY) || '{}') as Partial<StoredToken>;
    if (typeof meta.issuedAt !== 'number' || Date.now() - meta.issuedAt > TOKEN_LIFETIME) {
      clearOAuthToken();
      return null;
    }
    return { token, user: meta.user || '', issuedAt: meta.issuedAt };
  } catch {
    return null;
  }
};

export const saveOAuthToken = (token: string, user: string, issuedAt = Date.now()): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_META_KEY, JSON.stringify({ user, issuedAt } satisfies Omit<StoredToken, 'token'>));
};

export const clearOAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_META_KEY);
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

export const authorizeUrl = (challstr: string): string => {
  const url = new URL(`${OAUTH_ROOT}/oauth/authorize`);
  // A static page, not an SPA route: the popup shouldn't boot a second copy
  // of the client, and this path resolves identically in dev and production.
  url.searchParams.set('redirect_uri', `${location.origin}/oauth.html`);
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
export const requestOAuthGrant = (challstr: string): Promise<OAuthGrant> =>
  new Promise((resolve, reject) => {
    const popup = window.open(authorizeUrl(challstr), 'ps-oauth', 'popup=1,width=500,height=700');
    if (!popup) {
      reject(new Error('The login popup was blocked. Allow popups for this site and try again.'));
      return;
    }
    let settled = false;
    const settle = (grant: OAuthGrant | null, error?: string) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(poll);
      try { popup.close(); } catch { /* already closed */ }
      if (grant) resolve(grant);
      else reject(new Error(error || 'Login was cancelled.'));
    };
    const fromParams = (params: URLSearchParams): OAuthGrant | null => {
      const assertion = params.get('assertion');
      const token = params.get('token');
      const user = params.get('user') || '';
      if (!assertion || assertion.startsWith(';') || !token) return null;
      return { assertion, token, user };
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const data = event.data as { type?: string; search?: string };
      if (data?.type !== 'ps-oauth' || typeof data.search !== 'string') return;
      const grant = fromParams(new URLSearchParams(data.search));
      settle(grant, grant ? undefined : 'The login server did not return an assertion.');
    };
    window.addEventListener('message', onMessage);
    const poll = setInterval(() => {
      try {
        if (popup.closed) { settle(null); return; }
        if (popup.location?.origin === location.origin) {
          const grant = fromParams(new URLSearchParams(popup.location.search));
          if (grant) settle(grant);
        }
      } catch { /* still cross-origin */ }
    }, 500);
  });

export const __testables = { parseAssertionResponse };
