/**
 * Same-origin proxy for replay uploads.
 *
 * `/savereplay` hands the client a signed payload; publishing it means a POST
 * to replay.pokemonshowdown.com, which — like the login server — sends no
 * CORS headers. Same pattern as api/action.ts: fixed upstream, no body
 * logging, nothing cached.
 */

const UPSTREAM = process.env.PS_REPLAY_SERVER || 'https://replay.pokemonshowdown.com';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // battle logs can be long

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Only POST is supported.', {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
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
    upstream = await fetch(`${UPSTREAM}/api/replays/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': request.headers.get('user-agent') || 'pokemon-showdown-client',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return new Response('The replay server did not respond.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
