import { parseLadderData, parseLocalLadderHtml, requestPublicLadder, requestServerLadder } from './ladder';
import { parsePsFrame, type ProtocolMessageHandler } from './protocol-client';

describe('ladder adapters', () => {
  it('retains useful ratings and all returned standings beyond the first 100', () => {
    const rows = parseLadderData({
      toplist: Array.from({ length: 500 }, (_, index) => ({
        username: `Player${index}`,
        elo: '1550',
        gxe: '65.1',
        rpr: '1800',
        rprd: '120',
        coil: '2700',
        w: 10,
        l: 5,
      })),
    });
    expect(rows).toHaveLength(500);
    expect(rows[0]).toMatchObject({
      elo: 1550,
      gxe: 65.1,
      glicko: 1800,
      deviation: 120,
      coil: 2700,
      record: '10–5',
    });
  });
  it('extracts custom-server table text without rendering HTML or executable markup', () => {
    const rows = parseLocalLadderHtml(
      '<script>alert(1)</script><table><tr><th>Rank</th></tr><tr><td>1</td><td><b>Alice</b></td><td>1500</td><td>64.5%</td><td>1800 ± 90</td></tr></table>',
    );
    expect(rows[0]).toMatchObject({
      rank: 1,
      username: 'Alice',
      elo: 1500,
      gxe: 64.5,
      glicko: 1800,
      deviation: 90,
    });
    expect(document.querySelector('script')).toBeNull();
  });
  it('looks up exact users independently from the top standings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            username: 'UnrankedYet',
            ratings: { gen9ou: { elo: 1034, rpr: 1450, rprd: 170, w: 2, l: 3 } },
          }),
        ),
      ),
    );
    const rows = await requestPublicLadder(
      'https://pokemonshowdown.com',
      'gen9ou',
      'UnrankedYet',
      true,
      new AbortController().signal,
    );
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      'https://pokemonshowdown.com/users/unrankedyet.json',
    );
    expect(rows[0]).toMatchObject({ username: 'UnrankedYet', rank: 0, elo: 1034 });
    vi.unstubAllGlobals();
  });
  it('serializes cancelled prefix requests because responses have no request ID', async () => {
    let handler: ProtocolMessageHandler | undefined;
    const protocol = {
      send: vi.fn(),
      subscribe: (listener: ProtocolMessageHandler) => {
        handler = listener;
        return () => {
          handler = undefined;
        };
      },
    };
    const oldController = new AbortController();
    const first = requestServerLadder(protocol, 'gen9ou', 'Old', oldController.signal);
    await Promise.resolve();
    await Promise.resolve();
    oldController.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = requestServerLadder(protocol, 'gen9ou', 'New', new AbortController().signal);
    await Promise.resolve();
    expect(protocol.send).toHaveBeenCalledTimes(1);
    handler?.({
      type: 'frame',
      frame: parsePsFrame('|queryresponse|laddertop|["gen9ou", {"toplist":[{"username":"Old"}]}]'),
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(protocol.send).toHaveBeenLastCalledWith('/cmd laddertop gen9ou ,new');
    handler?.({
      type: 'frame',
      frame: parsePsFrame('|queryresponse|laddertop|["gen9ou", {"toplist":[{"username":"New"}]}]'),
    });
    await expect(second).resolves.toEqual([expect.objectContaining({ username: 'New' })]);
  });
});
