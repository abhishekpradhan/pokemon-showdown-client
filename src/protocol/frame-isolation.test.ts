import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useArenaStore } from '../stores/arena-store';
import { parsePsFrame } from '../compat/protocol-client';
import { clientErrors, resetClientErrors } from '../compat/diagnostics';

const initial = useArenaStore.getState();
const frame = (raw: string) => useArenaStore.getState().handleFrame(parsePsFrame(raw));

beforeEach(() => {
  resetClientErrors();
  useArenaStore.setState({
    ...initial,
    username: 'Alice',
    named: true,
    connection: 'connected',
    rooms: {},
    roomList: { rooms: [] },
    chatRoomList: { rooms: [], sectionTitles: [] },
    replayStatuses: {},
    lastError: undefined,
  });
});
afterEach(() => {
  useArenaStore.setState(initial, true);
  resetClientErrors();
});

describe('frame error isolation', () => {
  it('applies the lines that follow a throwing line in the same frame', () => {
    useArenaStore.setState({
      onReplaySaved: () => {
        throw new Error('synthetic store failure');
      },
    });
    expect(() =>
      frame('|queryresponse|savereplay|{"id":"gen9ou-1","log":"|start"}\n|c|Bob|still delivered'),
    ).not.toThrow();
    expect(useArenaStore.getState().rooms.lobby.chat).toEqual([
      expect.objectContaining({ user: 'Bob', message: 'still delivered' }),
    ]);
    // The failure is kept for diagnostics with the payload stripped.
    expect(clientErrors()).toEqual([
      expect.objectContaining({
        source: 'router',
        message: 'Error: synthetic store failure',
        context: '|queryresponse|[private payload omitted]',
      }),
    ]);
  });

  it('applies later lines of a room frame after a throwing one', () => {
    useArenaStore.setState({
      onReplaySaved: () => {
        throw new Error('synthetic store failure');
      },
    });
    frame(
      '>battle-gen9ou-7\n|init|battle\n|queryresponse|savereplay|{"id":"gen9ou-7","log":"x"}\n|player|p1|Alice\n|win|Alice',
    );
    const room = useArenaStore.getState().rooms['battle-gen9ou-7'];
    if (room?.type !== 'battle') throw new Error('expected battle');
    expect(room.perspective).toBe('p1');
    expect(room.result).toEqual({ winner: 'Alice', ended: true });
  });

  it('ignores a null savereplay payload instead of throwing', () => {
    useArenaStore.setState({
      replayStatuses: { 'battle-gen9ou-1': { roomId: 'battle-gen9ou-1', state: 'saving', requestedAt: 1 } },
    });
    expect(() => frame('|queryresponse|savereplay|null')).not.toThrow();
    expect(() => frame('|queryresponse|savereplay|"gen9ou-1"')).not.toThrow();
    expect(() => frame('|queryresponse|userdetails|null')).not.toThrow();
    expect(useArenaStore.getState().replayStatuses['battle-gen9ou-1'].state).toBe('saving');
    expect(clientErrors()).toEqual([]);
  });

  it('skips null directory entries and keeps the rest of the list', () => {
    frame(
      '|queryresponse|roomlist|{"rooms":{"battle-gen9ou-1":null,"battle-gen9ou-2":{"p1":"Alice","p2":"Bob"}}}',
    );
    expect(useArenaStore.getState().roomList.rooms.map(room => room.id)).toEqual(['battle-gen9ou-2']);
    frame('|queryresponse|rooms|{"chat":[null,{"title":"Lobby","userCount":3,"section":"Official"}]}');
    expect(useArenaStore.getState().chatRoomList.rooms.map(room => room.id)).toEqual(['lobby']);
    expect(clientErrors()).toEqual([]);
  });
});
