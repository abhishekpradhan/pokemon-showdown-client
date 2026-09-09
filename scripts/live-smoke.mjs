/** Opt-in real guest handshake. LIVE_APP_URL checks a deployment's actual proxy;
 * the default direct-provider mode remains an advisory infrastructure check.
 * Sends only a signed ephemeral rename and a read-only lobby join. */
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

class SmokeFailure extends Error {}

export function resolveLoginTarget(env) {
  if (env.LIVE_APP_URL !== undefined) {
    let app;
    try {
      app = new URL(env.LIVE_APP_URL);
    } catch {
      throw new SmokeFailure('LIVE_APP_URL must be an absolute application origin.');
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(app.hostname);
    if (
      app.username ||
      app.password ||
      app.pathname !== '/' ||
      app.search ||
      app.hash ||
      (app.protocol !== 'https:' && !(app.protocol === 'http:' && loopback))
    ) {
      throw new SmokeFailure(
        'LIVE_APP_URL must be an HTTPS origin without credentials, path, query or fragment (HTTP is allowed for loopback).',
      );
    }
    return { endpoint: `${app.origin}/api/action`, origin: app.origin, mode: 'deployed-proxy' };
  }
  let endpoint;
  try {
    endpoint = new URL(env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php');
  } catch {
    throw new SmokeFailure('PS_LOGIN_SERVER must be an absolute HTTP(S) URL.');
  }
  if (
    !['https:', 'http:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  ) {
    throw new SmokeFailure('PS_LOGIN_SERVER must be an HTTP(S) URL without credentials or fragment.');
  }
  return { endpoint: endpoint.href, mode: 'direct-provider' };
}

export async function runLiveSmoke({
  env = process.env,
  WebSocketImpl = globalThis.WebSocket,
  fetchImpl = globalThis.fetch,
  output = console,
  timeoutMs = 25_000,
} = {}) {
  if (env.LIVE_PS_TESTS !== '1') {
    output.log('Skipping live PS smoke test. Set LIVE_PS_TESTS=1 to run it.');
    return { skipped: true };
  }
  if (!WebSocketImpl)
    throw new SmokeFailure('This runtime does not provide WebSocket; use supported Node 22 or 24.');
  const target = resolveLoginTarget(env);
  const host = env.VITE_PS_SERVER_HOST || 'sim3.psim.us';
  const port = Number(env.VITE_PS_SERVER_PORT || 443);
  const prefix = env.VITE_PS_SERVER_PREFIX || '/showdown';
  const secure = (env.VITE_PS_SERVER_SECURE || 'true') !== 'false';
  const url = `${secure ? 'wss' : 'ws'}://${host}:${port}${prefix}/websocket`;
  const name = `ArenaSmoke${randomBytes(4).toString('hex')}`;
  const userid = name.toLowerCase();
  const checks = { challstr: false, assertion: false, named: false, formats: false, lobby: false };
  output.log(`mode       ${target.mode}${target.origin ? ` (${target.origin})` : ''}`);

  return new Promise((resolveResult, reject) => {
    let socket;
    let settled = false;
    let requestingAssertion = false;
    const abort = new AbortController();
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      abort.abort();
      socket?.close();
      if (error) {
        output.error(`checks: ${JSON.stringify(checks)}`);
        reject(new SmokeFailure(error));
      } else {
        output.log('Live PS smoke test passed:', JSON.stringify(checks));
        resolveResult({ mode: target.mode, ...checks });
      }
    };
    const timeout = setTimeout(
      () => finish('Timed out before the signed guest handshake completed.'),
      timeoutMs,
    );
    try {
      socket = new WebSocketImpl(url);
    } catch {
      finish('Unable to open the configured simulator socket.');
      return;
    }
    socket.addEventListener('open', () => output.log('connected  simulator'));
    socket.addEventListener('error', () => finish('Unable to connect to the configured simulator.'));
    socket.addEventListener('close', () => {
      if (!settled) finish('Simulator disconnected before the guest handshake completed.');
    });

    const handleFrame = async frame => {
      for (const line of frame.split('\n')) {
        if (settled) return;
        if (line.startsWith('|challstr|') && !requestingAssertion) {
          requestingAssertion = true;
          checks.challstr = true;
          const response = await fetchImpl(target.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...(target.origin ? { Origin: target.origin } : {}),
            },
            body: new URLSearchParams({
              act: 'getassertion',
              userid,
              challstr: line.slice('|challstr|'.length),
            }),
            signal: abort.signal,
            redirect: 'error',
          });
          if (settled) {
            void response.body?.cancel().catch(() => {});
            return;
          }
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            finish(
              `The ${target.mode === 'deployed-proxy' ? 'deployed assertion proxy' : 'login server'} returned HTTP ${response.status}.`,
            );
            return;
          }
          const assertion = (await response.text()).trim();
          if (settled) return;
          if (!/^[^;<\r\n]+;[^<\r\n]+$/.test(assertion)) {
            finish('The assertion endpoint refused the fresh guest name or returned an invalid response.');
            return;
          }
          checks.assertion = true;
          output.log('assertion  signed response received');
          socket.send(`|/trn ${name},0,${assertion}`);
          socket.send('|/join lobby');
        }
        // Connection's initial unnamed update and acknowledgements for another
        // name cannot satisfy this check. The simulator verifies the signature.
        if (line.startsWith('|updateuser|')) {
          const [, , rawName, named] = line.split('|');
          if (named === '1' && rawName.replace(/^[^A-Za-z0-9]/, '') === name) {
            checks.named = true;
            output.log('named      simulator acknowledged the ephemeral guest');
            if (rawName.startsWith('‽') || rawName.startsWith('!')) {
              checks.lobby = true;
              output.log('lobby      waived (datacenter IP account restriction)');
            }
          }
        }
        if (line.startsWith('|nametaken|')) {
          finish('The simulator rejected the ephemeral guest name.');
          return;
        }
        if (line.startsWith('|formats|')) checks.formats = true;
        if (line.startsWith('|init|chat')) checks.lobby = true;
      }
      if (Object.values(checks).every(Boolean)) finish();
    };
    socket.addEventListener('message', event => {
      void handleFrame(String(event.data)).catch(() =>
        finish('The assertion request or simulator handshake failed.'),
      );
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runLiveSmoke();
  } catch (error) {
    console.error(`FAIL: ${error instanceof SmokeFailure ? error.message : 'Live smoke execution failed.'}`);
    process.exitCode = 1;
  }
}
