/**
 * Same-origin proxy for the Pokémon Showdown login server.
 *
 * `action.php` sends no CORS headers, so a browser on any origin other than
 * play.pokemonshowdown.com cannot call it. This function gives the client a
 * same-origin endpoint to talk to instead.
 *
 * The upstream is fixed (overridable only by a server-side env var), so this is
 * not an open proxy. Request bodies carry passwords and assertions and are
 * never logged.
 */

const UPSTREAM = process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php';

// action.php responses are small; this caps abuse of the proxy.
const MAX_BODY_BYTES = 64 * 1024;

export const config = { runtime: 'nodejs' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Only POST is supported.', {
      status: 405,
      headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' },
    });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response('Request body too large.', {
      status: 413,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // action.php varies its response on the client, and rejects some
        // user agents outright.
        'User-Agent': request.headers.get('user-agent') || 'pokemon-showdown-client',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return new Response('The login server did not respond.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      // Assertions are single-use credentials — never cache them anywhere.
      'Cache-Control': 'no-store',
    },
  });
}
