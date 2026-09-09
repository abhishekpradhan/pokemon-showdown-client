// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import login from '../api/action';
import replay from '../api/replay';
import { readBoundedBody } from './proxy';

const request = (
  body: BodyInit = 'act=getassertion&userid=alice&challstr=4%7Ctest',
  headers: Record<string, string> = {},
) =>
  new Request('https://arena.example/api/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://arena.example',
      ...headers,
    },
    body,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('production proxy boundary', () => {
  it('serves assertions when hosted fetch rejects the error redirect mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        if (options.redirect === 'error') throw new TypeError('Hosted fetch cannot use this redirect mode');
        return Promise.resolve(new Response('signed-assertion'));
      }),
    );
    const response = await login(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('signed-assertion');
  });

  it('never follows upstream redirects or leaks their contents into diagnostics', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('private-token-content', {
        status: 307,
        headers: { Location: 'https://another.example/?token=private-token' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await login(request());
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).not.toContain('private-token');
    expect(log).toHaveBeenCalledWith('Upstream request failed', {
      service: 'login',
      stage: 'upstream-redirect',
      kind: 'Error',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-token');
  });

  it('rejects redirects immediately even when upstream body cancellation stalls', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 302 })));
    expect((await login(request())).status).toBe(502);
    expect(cancel).toHaveBeenCalledTimes(1);
  }, 1000);

  it('forwards allowed requests without cookies and prevents upstream active HTML or cookies escaping', async () => {
    vi.stubEnv('PS_LOGIN_SERVER', 'https://login.example/action.php');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('assertion', { headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'bad=value' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const response = await login(request(undefined, { Cookie: 'secret', Authorization: 'Bearer secret' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('assertion');
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://login.example/action.php');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Cookie');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects origins, methods, content types, actions and duplicate fields before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await login(request(undefined, { Origin: 'https://other.example' }))).status).toBe(403);
    expect((await login(request(undefined, { Origin: 'null' }))).status).toBe(403);
    expect((await login(new Request('https://arena.example/api/action'))).status).toBe(405);
    expect((await login(request('{}', { 'Content-Type': 'application/json' }))).status).toBe(415);
    expect((await login(request('act=login&userid=alice&pass=never'))).status).toBe(400);
    expect((await login(request('act=getassertion&act=logout&userid=alice&challstr=test'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts bytes without Content-Length and cancels oversized streams', async () => {
    expect(
      (await login(request(`act=getassertion&userid=alice&challstr=${'界'.repeat(23_000)}`))).status,
    ).toBe(413);
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(40));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(readBoundedBody(stream, 64, AbortSignal.timeout(1000))).rejects.toThrow('Body too large');
    expect(cancelled).toBe(true);
  });

  it('terminates a stalled body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise(() => {});
      },
    });
    await expect(readBoundedBody(stream, 64, AbortSignal.timeout(10))).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('bounds upstream responses and does not expose upstream failure details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sensitive upstream detail')));
    const unavailable = await login(request());
    expect(unavailable.status).toBe(502);
    expect(await unavailable.text()).not.toContain('sensitive');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(300_000))));
    expect((await login(request())).status).toBe(502);
  });

  it('uses the verified legacy uploadreplay login-server contract', async () => {
    vi.stubEnv('PS_LOGIN_SERVER', 'https://login.example/action.php');
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await replay(
          request(
            new URLSearchParams({
              serverid: 'custom',
              id: 'custom-gen9ou-123',
              log: '|turn|1',
              password: 'private',
            }),
          ),
        )
      ).status,
    ).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://login.example/action.php');
    const forwarded = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(Object.fromEntries(forwarded)).toEqual({
      act: 'uploadreplay',
      serverid: 'custom',
      id: 'custom-gen9ou-123',
      log: '|turn|1',
      password: 'private',
    });
    expect((await replay(request('id=../../bad&log=test'))).status).toBe(400);
    expect((await replay(request('id=gen9ou-123&log=test&serverid=showdown&act=login'))).status).toBe(400);
  });
});
