import { fetchReplay, MAX_REPLAY_LINES, normalizeReplayUrl, parseReplayLog, searchReplays, loadReplayCollection } from './replay-data';
const log = '|player|p1|Alice|\n|player|p2|Bob|\n|tier|[Gen 9] OU\n|start\n|turn|1';

describe('replay loading boundaries', () => {
  it('normalizes extensions separately from private identifiers, queries and fragments', () => {
    expect(normalizeReplayUrl('https://replay.pokemonshowdown.com/gen9ou-123-secretpw.log?token=abc&p2#turn3')).toMatchObject({ id: 'gen9ou-123-secretpw', dataUrl: 'https://replay.pokemonshowdown.com/gen9ou-123-secretpw.json?token=abc&p2', side: 'p2' });
    expect(normalizeReplayUrl('gen9ou-123').dataUrl).toBe('https://replay.pokemonshowdown.com/gen9ou-123.json');
  });
  it('extracts metadata and rejects invalid or overlong logs', () => {
    expect(parseReplayLog(log)).toMatchObject({ players: ['Alice', 'Bob'], format: '[Gen 9] OU' });
    expect(() => parseReplayLog('Hello')).toThrow('No battle protocol');
    expect(() => parseReplayLog(log + '\n'.concat('|message|x\n'.repeat(MAX_REPLAY_LINES)))).toThrow('50,000-line');
  });
  it('preserves returned privacy metadata and the original protected URL', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ log, private: 2, players: ['Alice', 'Bob'], format: '[Gen 9] OU' }))));
    const replay = await fetchReplay('https://replay.pokemonshowdown.com/gen9ou-123-secretpw', controller.signal);
    expect(replay.private).toBe(2); expect(replay.url).toContain('secretpw');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('secretpw.json'), { signal: controller.signal, credentials: 'omit' });
    vi.unstubAllGlobals();
  });
  it('uses upstream username search and sanitizes malformed result fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(']' + JSON.stringify([{ id: 'gen9ou-1', players: ['Alice', 'Bob'], format: { bad: true } }, { id: '../unsafe', players: ['Alice'] }]))));
    const results = await searchReplays('Alice', 'gen9ou', 2, new AbortController().signal);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get('username')).toBe('Alice'); expect(url.searchParams.get('page')).toBe('2');
    expect(results).toHaveLength(1); expect(results[0].format).toBeUndefined();
    vi.unstubAllGlobals();
  });
  it('supports legacy log-only hosts and skips malformed saved metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response(log)));
    const loaded = await fetchReplay('https://old.example/gen9ou-1.log?token=secret', new AbortController().signal);
    expect(loaded.players).toEqual(['Alice', 'Bob']);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe('https://old.example/gen9ou-1.log?token=secret');
    localStorage.setItem('ps-arena-replays-v1', JSON.stringify([{ id: 'x', url: 'javascript:alert(1)', players: [] }, { id: 'x', url: 'https://old.example/x', players: [null] }]));
    expect(loadReplayCollection()).toEqual([]);
    vi.unstubAllGlobals();
  });

});
