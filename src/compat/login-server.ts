/**
 * Client for the Pokémon Showdown login server (`action.php`).
 *
 * The login server sends no `Access-Control-Allow-Origin` header, so a client
 * served from any other origin cannot call it directly from the browser. Every
 * request therefore goes through our own same-origin proxy (`/api/action`),
 * implemented as a serverless function in production and as a Vite dev proxy
 * locally. `VITE_PS_ACTION_URL` overrides the path for self-hosted setups.
 *
 * Only guest assertions go this way. Registered sign-in is OAuth (`ps-oauth`):
 * a password is never collected by this client.
 */

export const ACTION_URL = import.meta.env.VITE_PS_ACTION_URL || '/api/action';

/**
 * Upper bound on one login-server round trip. A hung proxy must surface as an
 * error the user can act on, not as a sign-in dialog that never settles.
 */
export const LOGIN_SERVER_TIMEOUT = 20_000;

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

/**
 * A signal that aborts when the caller cancels or when the request has run
 * for `ms`. The two are distinguishable by reason: the caller's cancellation
 * keeps its own `AbortError`, the deadline aborts with a `TimeoutError`.
 */
function boundedSignal(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The login server did not respond in time.', 'TimeoutError')),
    ms,
  );
  const forward = () => controller.abort(signal?.reason);
  if (signal?.aborted) forward();
  else signal?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

async function post(body: URLSearchParams, signal?: AbortSignal): Promise<string> {
  const request = boundedSignal(signal, LOGIN_SERVER_TIMEOUT);
  try {
    const response = await fetch(ACTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: request.signal,
    });
    if (!response.ok) {
      throw new LoginServerError(`The login server returned an error (HTTP ${response.status}).`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof LoginServerError) throw error;
    const name = (error as Error)?.name;
    if (name === 'AbortError') throw error;
    if (name === 'TimeoutError') {
      throw new LoginServerError(
        'The login server did not respond in time. Check your connection and try again.',
      );
    }
    throw new LoginServerError('Could not reach the login server. Check your connection and try again.');
  } finally {
    request.release();
  }
}

/** Raw `act=` query. Returns the response body verbatim. */
export async function rawQuery(act: string, data: Record<string, string>, signal?: AbortSignal) {
  return post(new URLSearchParams({ ...data, act }), signal);
}

/**
 * Normalizes a raw assertion. The login server overloads the assertion string
 * to signal auth requirements: `;` means the name is registered (real servers
 * still send it, and it routes the user to OAuth), `;;@gmail` means it is a
 * Google-linked account, and any other `;;`-prefixed value carries an error
 * message.
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
