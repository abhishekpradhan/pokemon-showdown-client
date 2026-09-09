import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useArenaStore } from './arena-store';
import { useWorkspaceStore } from './workspace-store';
import { parsePsFrame } from '../compat/protocol-client';
import { appendChat, newChatRoom } from '../rooms/registry';

const initial = useArenaStore.getState();
const frame = (raw: string) => useArenaStore.getState().handleFrame(parsePsFrame(raw));
const send = vi.fn(() => true);
beforeEach(() => {
  sessionStorage.clear();
  useArenaStore.setState({
    ...initial,
    username: 'Alice',
    named: true,
    connection: 'connected',
    rooms: {},
    roomErrors: {},
    replayStatuses: {},
    replayStatus: undefined,
    lastError: undefined,
    protocol: { send } as unknown as typeof initial.protocol,
  });
  useWorkspaceStore.setState({ ignoredUsers: [], blockPms: false, blockChallenges: false });
  send.mockClear();
});
afterEach(() => {
  useArenaStore.getState().cancelLogin();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('session and social regressions', () => {
  it('reconciles PM echoes once and reopens a locally closed PM without joining it', () => {
    const state = useArenaStore.getState();
    state.openPmWith('Bob');
    expect(state.sendRoomMessage('pm-bob', 'hello')).toBe(true);
    expect(useArenaStore.getState().rooms['pm-bob'].chat).toHaveLength(0);
    frame('|pm| Alice| Bob|hello');
    expect(useArenaStore.getState().rooms['pm-bob'].chat).toHaveLength(1);
    state.leaveRoom('pm-bob');
    state.openPmWith('Bob');
    expect(useArenaStore.getState().rooms['pm-bob'].connected).toBe(true);
    expect(send).not.toHaveBeenCalledWith('/join pm-bob');
    expect(send).not.toHaveBeenCalledWith('/leave', 'pm-bob');
  });
  it('retains unsent messages in the composer contract while offline', () => {
    useArenaStore.setState({ connection: 'offline' });
    expect(useArenaStore.getState().sendRoomMessage('pm-bob', 'hello')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it('background and utility views accumulate unread without changing the active route', () => {
    useArenaStore.setState({ activeRoomId: undefined });
    frame('|pm| Bob| Alice|hello');
    expect(useArenaStore.getState().rooms['pm-bob'].unread).toBe(1);
    useArenaStore.getState().focusRoom('pm-bob');
    expect(useArenaStore.getState().rooms['pm-bob'].unread).toBe(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    frame('|pm| Bob| Alice|second');
    expect(useArenaStore.getState().rooms['pm-bob'].unread).toBe(1);
  });
  it('applies local ignores and private-message controls', () => {
    useWorkspaceStore.setState({ ignoredUsers: ['bob'] });
    frame('|pm| Bob| Alice|hidden');
    expect(useArenaStore.getState().rooms['pm-bob']).toBeUndefined();
    useWorkspaceStore.setState({ ignoredUsers: [], blockPms: true });
    frame('|pm| Bob| Alice|hidden');
    expect(useArenaStore.getState().rooms['pm-bob']).toBeUndefined();
  });
  it('handles PM challenge directives and cancellation', () => {
    frame('|pm| Bob| Alice|/challenge gen9randombattle|');
    expect(useArenaStore.getState().challenges.from.Bob).toBe('gen9randombattle');
    frame('|pm| Bob| Alice|/challenge');
    expect(useArenaStore.getState().challenges.from.Bob).toBeUndefined();
  });
  it('replaces reconnect snapshots instead of duplicating chat or engine state', () => {
    frame('>lobby\n|init|chat\n|c|Bob|hello');
    frame('>lobby\n|init|chat\n|c|Bob|hello');
    expect(useArenaStore.getState().rooms.lobby.chat).toHaveLength(1);
  });
  it('keeps failed joins actionable and remembers offline presence', () => {
    frame('>private-room\n|noinit|joinfailed|This room is private.');
    expect(useArenaStore.getState().roomErrors['private-room']).toBe('This room is private.');
    frame('|queryresponse|userdetails|{"userid":"bob","rooms":false}');
    expect(useArenaStore.getState().userCards.bob.online).toBe(false);
  });
  it('does not close an active battle when the player cancels forfeiting', () => {
    frame('>battle-gen9ou-1\n|init|battle\n|player|p1|Alice\n|player|p2|Bob');
    const room = useArenaStore.getState().rooms['battle-gen9ou-1'];
    if (room.type !== 'battle') throw new Error('expected battle');
    useArenaStore.setState({ rooms: { [room.id]: { ...room, battle: { ...room.battle, mode: 'player' } } } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(useArenaStore.getState().leaveRoom(room.id)).toBe(false);
    expect(useArenaStore.getState().rooms[room.id].connected).toBe(true);
    expect(send).not.toHaveBeenCalledWith('/forfeit', room.id);
  });
  it('stale guest assertions cannot rename after logout', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(done => {
            resolve = done;
          }),
      ),
    );
    useArenaStore.setState({ challstr: '1|abc', named: false });
    const pending = useArenaStore.getState().chooseName('Bob');
    await useArenaStore.getState().logout();
    resolve(new Response('signed-assertion'));
    await pending;
    expect(send.mock.calls.flat().join(' ')).not.toContain('/trn');
    expect(useArenaStore.getState().named).toBe(false);
  });
  it('retains bounded chat history beyond 200 messages and replaces named HTML in place', () => {
    let room = newChatRoom('lobby');
    for (let i = 0; i < 2050; i++)
      room = appendChat(room, { user: 'Bob', message: String(i) }, true) as typeof room;
    expect(room.chat).toHaveLength(2000);
    expect(room.chat[0].message).toBe('50');
    room = appendChat(room, { user: '', message: 'first', uhtmlName: 'poll' }, true) as typeof room;
    room = appendChat(room, { user: '', message: 'updated', uhtmlName: 'poll' }, false) as typeof room;
    expect(room.chat.filter(entry => entry.uhtmlName === 'poll')).toHaveLength(1);
    expect(room.unread).toBe(0);
  });
  it('routes validation popups into the validation panel', () => {
    useArenaStore.setState({ teamValidation: { state: 'validating', format: 'gen9ou', requestedAt: 1 } });
    frame('|popup|Your team is valid for this format.');
    expect(useArenaStore.getState().teamValidation?.state).toBe('valid');
    expect(useArenaStore.getState().lastError).toBeUndefined();
  });
  it('models actual tournament challenges, errors and results', () => {
    frame('>lobby\n|init|chat\n|tournament|create|gen9ou|Round Robin|4\n|tournament|join|Alice');
    frame(
      '>lobby\n|tournament|update|{"isStarted":true,"challengeBys":["Bob"],"challenged":"Bob","challenging":null,"teambuilderFormat":"gen9ou"}',
    );
    let room = useArenaStore.getState().rooms.lobby;
    if (room.type !== 'chat') throw new Error('expected chat');
    expect(room.tournament).toMatchObject({ isJoined: true, challenged: 'Bob', challenging: null });
    frame('>lobby\n|tournament|error|InvalidTeam');
    room = useArenaStore.getState().rooms.lobby;
    if (room.type !== 'chat') throw new Error('expected chat');
    expect(room.tournament?.error).toContain('InvalidTeam');
    frame('>lobby\n|tournament|end|{"results":[["Alice"],["Bob"]]}');
    room = useArenaStore.getState().rooms.lobby;
    if (room.type !== 'chat') throw new Error('expected chat');
    expect(room.tournament).toMatchObject({ ended: true, results: [['Alice'], ['Bob']] });
  });
  it('associates concurrent authoritative private replay URLs with their battles', () => {
    for (const id of ['battle-gen9ou-10', 'battle-gen9ou-20']) {
      frame(`>${id}\n|init|battle`);
      useArenaStore.getState().saveReplay(id);
    }
    frame('|popup|Your replay is available: https://replay.pokemonshowdown.com/gen9ou-20-secretpw');
    frame('|popup|Your replay is available: https://replay.pokemonshowdown.com/gen9ou-10');
    expect(useArenaStore.getState().replayStatuses['battle-gen9ou-20'].url).toBe(
      'https://replay.pokemonshowdown.com/gen9ou-20-secretpw',
    );
    expect(useArenaStore.getState().replayStatuses['battle-gen9ou-10'].url).toBe(
      'https://replay.pokemonshowdown.com/gen9ou-10',
    );
  });
});
