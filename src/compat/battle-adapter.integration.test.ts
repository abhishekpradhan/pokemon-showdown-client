import { vi } from 'vitest';
import { loadEngine } from '../battle/engine';
import { parsePsFrame } from './protocol-client';
import { useArenaStore } from '../stores/arena-store';
import type { BattleRequest } from './battle-adapter';

const roomId = 'battle-gen9ou-request-regression';
const request = (): BattleRequest => ({
  rqid: 21,
  side: {
    id: 'p1',
    name: 'Alice',
    pokemon: [
      {
        ident: 'p1: Pikachu',
        details: 'Pikachu',
        condition: '211/211',
        active: true,
        moves: ['tackle'],
        stats: { atk: 146, def: 116, spa: 136, spd: 136, spe: 216 },
        ability: 'static',
        item: 'lightball',
      },
      {
        ident: 'p1: Bulbasaur',
        details: 'Bulbasaur',
        condition: '231/231',
        moves: ['tackle'],
        ability: 'overgrow',
        item: '',
      },
    ],
  },
  active: [{ moves: [{ move: 'Tackle', id: 'tackle', pp: 56, maxpp: 56, target: 'normal' }] }],
});
const frame = (text: string) => useArenaStore.getState().handleFrame(parsePsFrame(`>${roomId}\n${text}`));
const room = () => {
  const value = useArenaStore.getState().rooms[roomId];
  if (value?.type !== 'battle') throw new Error('Missing battle');
  return value;
};

describe('authoritative battle request lifecycle', () => {
  const send = vi.fn((_command: string, _roomId?: string) => true);
  beforeAll(async () => {
    await loadEngine();
  });
  beforeEach(() => {
    send.mockClear();
    useArenaStore.setState({
      rooms: {},
      username: 'Alice',
      named: true,
      connection: 'connected',
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
    });
    frame(
      '|init|battle\n|gametype|singles\n|gen|9\n|player|p1|Alice\n|player|p2|Bob\n|start\n|switch|p1a: Pikachu|Pikachu|211/211\n|switch|p2a: Bulbasaur|Bulbasaur|100/100',
    );
    frame(`|request|${JSON.stringify(request())}`);
  });

  it('rejects a second submission and recovers a server-rejected choice', () => {
    const choice = room().battle.moves[0];
    useArenaStore.getState().submitBattleChoice(choice, roomId);
    useArenaStore.getState().submitBattleChoice(choice, roomId);
    expect(send.mock.calls.filter(([command]) => command.startsWith('/choose'))).toHaveLength(1);
    frame('|error|[Invalid choice] The move is unavailable.');
    expect(room().choicePending).toBe(false);
    expect(room().choiceError).toContain('Invalid choice');
    useArenaStore.getState().submitBattleChoice(choice, roomId);
    expect(send.mock.calls.filter(([command]) => command.startsWith('/choose'))).toHaveLength(2);
  });

  it('repairs trapped and disabled callbacks without changing visible room focus', () => {
    useArenaStore.setState({ activeRoomId: 'lobby' });
    frame('|callback|trapped|0');
    expect(room().lastRequest?.active?.[0]?.trapped).toBe(true);
    expect(room().choicePending).toBe(false);
    frame('|callback|cant|0|move: Disable|tackle');
    expect(room().lastRequest?.active?.[0]?.moves?.[0].disabled).toBe(true);
    frame(`|request|${JSON.stringify(request())}`);
    expect(useArenaStore.getState().activeRoomId).toBe('lobby');
  });

  it('waits for authoritative cancellation and restores saved choices on rejoin', () => {
    frame('|sentchoice|move 1');
    expect(room().choiceSession?.status).toBe('submitted');
    useArenaStore.getState().undoBattleChoice(roomId);
    expect(send).toHaveBeenCalledWith('/undo', roomId);
    expect(room().choiceSession?.status).toBe('cancelling');
    frame('|sentchoice|');
    expect(room().choicePending).toBe(false);
    expect(room().choiceSession?.status).toBe('drafting');
  });

  it('keeps timer state authoritative across engine projection and opponent notices', () => {
    frame('|inactive|Time left: 150 sec this turn | 300 sec total');
    const timer = room().timer;
    frame('|turn|2');
    expect(room().battle.timerOn).toBe(true);
    frame('|inactive|Bob has 20 seconds left.');
    expect(room().timer.secondsLeft).toBe(150);
    expect(room().timer.asOf).toBe(timer.asOf);
    frame('|win|Alice');
    expect(room().timer.on).toBe(false);
  });

  it('preserves draft and chat when offline and only echoes authoritative chat', () => {
    useArenaStore.setState({ connection: 'offline' });
    useArenaStore.getState().submitBattleChoice(room().battle.moves[0], roomId);
    expect(send).not.toHaveBeenCalled();
    expect(useArenaStore.getState().sendBattleChat('hello', roomId)).toBe(false);
    useArenaStore.setState({ connection: 'connected' });
    expect(useArenaStore.getState().sendBattleChat('hello', roomId)).toBe(true);
    expect(room().chat).toHaveLength(0);
    frame('|c|Alice|hello');
    expect(room().chat).toHaveLength(1);
  });

  it('ignores older requests, rejects malformed nested moves and withdraws null requests', () => {
    frame(`|request|${JSON.stringify({ ...request(), rqid: 20 })}`);
    expect(room().lastRequest?.rqid).toBe(21);
    frame(
      `|request|${JSON.stringify({ ...request(), active: [{ moves: [{ move: 'Tackle' }], canZMove: { invalid: true } }] })}`,
    );
    expect(room().choiceSession).toBeUndefined();
    expect(room().choiceError).toContain('invalid battle request');
    expect(room().battle.moves).toEqual([]);
    frame(`|request|${JSON.stringify(request())}`);
    frame('|request|null');
    expect(room().lastRequest).toBeUndefined();
    expect(room().choicePending).toBe(false);
    expect(room().choiceError).toBeUndefined();
  });

  it('retains our server-reported stats while waiting for the opponent', () => {
    expect(room().battle.active.stats?.spe).toBe(216);
    frame('|request|{"wait":true,"rqid":22}');
    expect(room().battle.active.stats?.spe).toBe(216);
    expect(room().battle.opponentActive.stats).toBeUndefined();
  });
});
