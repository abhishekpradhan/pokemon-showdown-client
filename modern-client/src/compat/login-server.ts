/**
 * Client for the Pokémon Showdown login server (`action.php`).
 *
 * The login server sends no `Access-Control-Allow-Origin` header, so a client
 * served from any other origin cannot call it directly from the browser. Every
 * request therefore goes through our own same-origin proxy (`/api/action`),
 * implemented as a serverless function in production and as a Vite dev proxy
 * locally. `VITE_PS_ACTION_URL` overrides the path for self-hosted setups.
 */

export const ACTION_URL = import.meta.env.VITE_PS_ACTION_URL || '/api/action';

export type AssertionOutcome =
  | { kind: 'assertion'; assertion: string }
  | { kind: 'needs-password' }
  | { kind: 'needs-google' }
  | { kind: 'error'; message: string };

const INTERFERENCE =
  'Something is interfering with the connection to the login server. ' +
  'Your network or internet provider may be blocking Pokémon Showdown.';

export class LoginServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginServerError';
  }
}

async function post(body: URLSearchParams, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch(ACTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new LoginServerError('Could not reach the login server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new LoginServerError(`The login server returned an error (HTTP ${response.status}).`);
  }
  return response.text();
}

/** Raw `act=` query. Returns the response body verbatim. */
export async function rawQuery(act: string, data: Record<string, string>, signal?: AbortSignal) {
  return post(new URLSearchParams({ ...data, act }), signal);
}

/** JSON `act=` query. The login server prefixes JSON responses with `]`. */
export async function jsonQuery<T>(act: string, data: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const text = (await rawQuery(act, data, signal)).trim();
  try {
    return JSON.parse(text.startsWith(']') ? text.slice(1) : text) as T;
  } catch {
    throw new LoginServerError(INTERFERENCE);
  }
}

/**
 * Normalizes a raw assertion. The login server overloads the assertion string
 * to signal auth requirements: `;` means the name is registered and needs a
 * password, `;;@gmail` means it is a Google-linked account, and any other
 * `;;`-prefixed value carries an error message.
 */
export function interpretAssertion(raw: string | null | undefined): AssertionOutcome {
  if (!raw) return { kind: 'error', message: 'The login server did not return an assertion.' };

  let assertion = raw;
  // Strip an interstitial page injected by a captive portal or MitM proxy.
  if (assertion.slice(0, 14).toLowerCase() === '<!doctype html') {
    const endIndex = assertion.indexOf('>');
    if (endIndex > 0) assertion = assertion.slice(endIndex + 1);
  }
  assertion = assertion.replace(/^[\r\n]+/, '').trim();

  if (assertion.includes('<')) return { kind: 'error', message: INTERFERENCE };
  if (assertion === ';') return { kind: 'needs-password' };
  if (assertion === ';;@gmail') return { kind: 'needs-google' };
  if (assertion.startsWith(';;')) return { kind: 'error', message: assertion.slice(2) };
  if (!assertion || assertion.includes('\n')) return { kind: 'error', message: INTERFERENCE };

  return { kind: 'assertion', assertion };
}

/** Requests an assertion for an unregistered (guest) name. */
export async function getAssertion(userid: string, challstr: string, signal?: AbortSignal) {
  return interpretAssertion(await rawQuery('getassertion', { userid, challstr }, signal));
}

type LoginResponse = {
  assertion?: string;
  actionsuccess?: boolean;
  error?: string;
  curuser?: { loggedin?: boolean; username?: string; userid?: string };
};

/** Logs into a registered account and returns its assertion. */
export async function loginWithPassword(
  name: string,
  pass: string,
  challstr: string,
  signal?: AbortSignal
): Promise<AssertionOutcome & { username?: string }> {
  const data = await jsonQuery<LoginResponse>('login', { name, pass, challstr }, signal);
  if (!data?.curuser?.loggedin) {
    return { kind: 'error', message: data?.error || 'Incorrect password.' };
  }
  return { ...interpretAssertion(data.assertion), username: data.curuser.username };
}

/** Best-effort session teardown; failures are not surfaced to the user. */
export async function logout(userid: string) {
  try {
    await rawQuery('logout', { userid });
  } catch {
    // The socket-level `/logout` is what actually ends the session.
  }
}
