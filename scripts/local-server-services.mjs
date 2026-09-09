import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

/** Real loopback HTTP through the production adapters. This intentionally models
 * only the published token/replay contracts, not registered-provider identity. */
export async function verifyLocalServices(directory) {
  const events = [];
  let token = 'local-initial-token';
  let revoked = false;
  let replayMode = 'success';
  let replayRequests = 0;
  let providerFailure;
  const handleRequest = async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Content-Type', 'text/plain');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/api/oauth/api/getassertion') {
      events.push('assertion');
      const accepted =
        url.searchParams.get('client_id') === 'arena-local' &&
        url.searchParams.get('token') === token &&
        !revoked;
      response.end(
        `]${JSON.stringify(accepted ? { success: true, user: 'ArenaRegistered', data: `${url.searchParams.get('challenge')};local-signature` } : { success: false })}`,
      );
    } else if (url.pathname === '/api/oauth/api/refreshtoken') {
      events.push('refresh');
      const accepted =
        url.searchParams.get('client_id') === 'arena-local' &&
        url.searchParams.get('token') === token &&
        !revoked;
      if (accepted) token = 'local-rotated-token';
      response.end(`]${JSON.stringify({ success: accepted ? token : false })}`);
    } else if (url.pathname === '/action.php') {
      replayRequests++;
      let body = '';
      for await (const chunk of request) body += chunk;
      const form = new URLSearchParams(body);
      assert.equal(form.get('act'), 'uploadreplay');
      assert.equal(form.get('serverid'), 'arenalocal');
      assert.equal(form.get('password'), 'local-private-token');
      assert.equal(form.get('id'), 'arenalocal-gen9ou-1');
      assert(form.get('log').startsWith('|gen|9'));
      assert.equal(request.headers.cookie, undefined);
      assert.equal(request.headers.authorization, undefined);
      events.push(`legacy-replay-${replayMode}`);
      if (replayMode === 'redirect') {
        response.writeHead(302, { Location: 'https://example.invalid/must-not-follow' });
        response.end('not an upload');
      } else response.end('success:arenalocal-gen9ou-1-local-private-tokenpw');
    } else {
      response.statusCode = 404;
      response.end('Unknown local test endpoint');
    }
  };
  const provider = createServer((request, response) => {
    void handleRequest(request, response).catch(error => {
      providerFailure = error;
      response.statusCode = 500;
      response.end('Local provider contract assertion failed.');
    });
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${provider.address().port}`;
  const originalLogin = process.env.PS_LOGIN_SERVER;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const storage = new Map();
  let pendingLock = Promise.resolve();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name, options, callback) => {
        const job = pendingLock.then(() => {
          if (options.signal.aborted) throw options.signal.reason;
          return callback();
        });
        pendingLock = job.catch(() => {});
        return job;
      },
    },
  });
  try {
    process.env.PS_LOGIN_SERVER = `${origin}/action.php`;
    const file = join(directory, 'arena-services.mjs');
    await build({
      stdin: {
        contents: `export * from './src/compat/ps-oauth.ts'; export {default as replay} from './api/replay.ts';`,
        resolveDir: resolve('.'),
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: file,
      define: {
        'import.meta.env': JSON.stringify({
          VITE_PS_OAUTH_ROOT: `${origin}/api`,
          VITE_PS_OAUTH_CLIENT_ID: 'arena-local',
        }),
      },
    });
    const service = await import(pathToFileURL(file).href);
    service.saveOAuthToken(token, 'ArenaRegistered', Date.now() - 8 * 86_400_000);
    const priorToken = token;
    const current = await Promise.all([
      service.currentOAuthToken(new AbortController().signal),
      service.currentOAuthToken(new AbortController().signal),
    ]);
    assert.equal(
      events.filter(event => event === 'refresh').length,
      1,
      'Concurrent sessions must rotate once under the shared lock.',
    );
    assert(current.every(record => record.token === token && record.user === 'ArenaRegistered'));
    assert.equal(
      await service.assertionFromToken('1|old', priorToken),
      null,
      'Provider must reject a rotated token.',
    );
    const assertion = await service.assertionFromToken('2|new-challenge', token);
    assert.equal(assertion.user, 'ArenaRegistered');
    assert.equal(assertion.assertion, '2|new-challenge;local-signature');
    revoked = true;
    assert.equal(await service.assertionFromToken('3|revoked', token), null);
    service.clearOAuthToken();
    assert.equal(service.storedOAuthToken(), null);
    service.saveOAuthToken('expired', 'ArenaRegistered', Date.now() - 15 * 86_400_000);
    assert.equal(service.storedOAuthToken(), null);

    const body = new URLSearchParams({
      id: 'arenalocal-gen9ou-1',
      serverid: 'arenalocal',
      log: '|gen|9\n|turn|1',
      password: 'local-private-token',
    });
    const request = (extra = {}) =>
      new Request(`${origin}/api/replay`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'unrelated-user-cookie',
          Authorization: 'Bearer unrelated',
          ...extra,
        },
        body,
      });
    const uploaded = await service.replay(request());
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.headers.get('cache-control'), 'no-store');
    assert.equal(await uploaded.text(), 'success:arenalocal-gen9ou-1-local-private-tokenpw');
    assert.equal((await service.replay(request({ Origin: 'https://other.example' }))).status, 403);
    assert.equal(replayRequests, 1, 'Cross-origin publish must stop before the local provider.');
    replayMode = 'redirect';
    assert.equal((await service.replay(request())).status, 502);
    assert.equal(replayRequests, 2, 'The replay proxy must never follow a redirect.');
    assert.ifError(providerFailure);
    return {
      provider: 'synthetic loopback HTTP, published OAuth token and legacy replay contracts',
      tokenRotation: true,
      concurrentRefreshes: 1,
      rotatedTokenRejected: true,
      revocation: true,
      expiry: true,
      privateLegacyReplay: true,
      crossOriginBlocked: true,
      redirectBlocked: true,
      events,
    };
  } finally {
    if (originalLogin === undefined) delete process.env.PS_LOGIN_SERVER;
    else process.env.PS_LOGIN_SERVER = originalLogin;
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
    if (locksDescriptor) Object.defineProperty(navigator, 'locks', locksDescriptor);
    else delete navigator.locks;
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
  }
}
