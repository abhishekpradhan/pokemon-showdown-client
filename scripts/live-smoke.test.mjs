// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { resolveLoginTarget, runLiveSmoke } from './live-smoke.mjs';

const env = { LIVE_PS_TESTS: '1', LIVE_APP_URL: 'https://arena.example/' };
const output = () => ({ log: vi.fn(), error: vi.fn() });

function mockSimulator(acknowledge = true) {
  const sent = [];
  class Socket extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.frame('|updateuser| Guest 1|0|1\n|formats|test\n|challstr|1|synthetic'));
    }
    frame(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
    send(payload) {
      sent.push(payload);
      if (payload.startsWith('|/trn ')) {
        const name = payload.slice(6).split(',')[0];
        queueMicrotask(() => this.frame(`|updateuser| ${name}|${acknowledge ? '1' : '0'}|1`));
      }
      if (payload === '|/join lobby') queueMicrotask(() => this.frame('|init|chat'));
    }
    close() {}
  }
  return { WebSocketImpl: Socket, sent };
}

describe('deployed live smoke target', () => {
  it('uses the deployed origin proxy and preserves direct-provider default', () => {
    expect(resolveLoginTarget(env)).toEqual({ endpoint: 'https://arena.example/api/action', origin: 'https://arena.example', mode: 'deployed-proxy' });
    expect(resolveLoginTarget({})).toEqual({ endpoint: 'https://play.pokemonshowdown.com/action.php', mode: 'direct-provider' });
    expect(resolveLoginTarget({ LIVE_APP_URL: 'http://127.0.0.1:4173' }).endpoint).toBe('http://127.0.0.1:4173/api/action');
  });
  it.each(['', '/relative', 'ftp://arena.example', 'http://arena.example', 'https://user:secret@arena.example', 'https://arena.example/app', 'https://arena.example?secret=x', 'https://arena.example#fragment'])('rejects an unsafe or ambiguous application origin', LIVE_APP_URL => {
    expect(() => resolveLoginTarget({ LIVE_APP_URL })).toThrow('LIVE_APP_URL');
  });
  it('retains the opt-in gate before networking or configuration validation', async () => {
    const fetchImpl = vi.fn();
    expect(await runLiveSmoke({ env: { LIVE_APP_URL: 'invalid' }, fetchImpl, output: output() })).toEqual({ skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('deployed signed guest handshake', () => {
  it('posts to the actual app proxy and requires the named simulator acknowledgement', async () => {
    const simulator = mockSimulator();
    const fetchImpl = vi.fn(async () => new Response('synthetic-data;synthetic-signature'));
    const result = await runLiveSmoke({ env, ...simulator, fetchImpl, output: output() });
    expect(result).toEqual({ mode: 'deployed-proxy', challstr: true, assertion: true, named: true, formats: true, lobby: true });
    const [endpoint, request] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe('https://arena.example/api/action');
    expect(request.headers.Origin).toBe('https://arena.example');
    expect(request.body.get('act')).toBe('getassertion');
    expect(request.body.get('userid')).toMatch(/^arenasmoke[a-f0-9]{8}$/);
    expect(request.redirect).toBe('error');
    expect(simulator.sent).toHaveLength(2);
    expect(simulator.sent[0]).toMatch(/^\|\/trn ArenaSmoke[a-f0-9]{8},0,synthetic-data;synthetic-signature$/);
    expect(simulator.sent[1]).toBe('|/join lobby');
  });
  it('fails immediately on deployed HTTP502 without sending a rename or printing its body', async () => {
    const simulator = mockSimulator();
    const logger = output();
    await expect(runLiveSmoke({ env, ...simulator, fetchImpl: async () => new Response('private-upstream-body', { status: 502 }), output: logger })).rejects.toThrow('deployed assertion proxy returned HTTP 502');
    expect(simulator.sent).toEqual([]);
    expect(JSON.stringify([logger.log.mock.calls, logger.error.mock.calls])).not.toContain('private-upstream-body');
  });
  it('cannot pass with only an unnamed acknowledgement, even after a signed response', async () => {
    const simulator = mockSimulator(false);
    await expect(runLiveSmoke({ env, ...simulator, fetchImpl: async () => new Response('synthetic-data;synthetic-signature'), output: output(), timeoutMs: 30 })).rejects.toThrow('Timed out');
  });
});
