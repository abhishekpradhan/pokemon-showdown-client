import corpus from '../test/fixtures/protocol-corpus.json';
import { parsePsFrame } from '../compat/protocol-client';
import { useArenaStore } from '../stores/arena-store';
import { loadEngine } from '../battle/engine';

const initial = useArenaStore.getState();
beforeAll(async () => { await loadEngine(); });
afterEach(() => { useArenaStore.setState(initial, true); });

describe('recorded pinned-server protocol corpus', () => {
  for (const recording of corpus.cases) {
    it(`projects ${recording.scenario} ${recording.seat} ownership and replaces its reconnect transcript`, () => {
      useArenaStore.setState({ rooms: {}, roomErrors: {}, rawProtocolLog: [], protocolLogEnabled: false, username: recording.username,
        named: true, connection: 'connected', activeRoomId: undefined });
      const frames = recording.frames.map(parsePsFrame);
      for (const frame of frames) useArenaStore.getState().handleFrame(frame);
      const roomId = frames[0].roomId;
      const room = useArenaStore.getState().rooms[roomId];
      if (room.type !== 'battle') throw new Error('Recorded battle was not initialized.');
      expect(room.battle.gameType).toBe(recording.scenario);
      expect(room.battle.playerSide).toBe(recording.seat);
      expect(room.battle.mode).toBe('player');
      expect(room.battle.turn).toBe(recording.scenario === 'triples' ? 3 : 2);
      expect(room.battle.team).toHaveLength(6);
      expect(room.lastRequest?.side?.id).toBe(recording.seat);
      expect(room.lastRequest?.side?.pokemon).toHaveLength(6);
      expect(room.lastRequest?.side?.pokemon?.every(pokemon => pokemon.ident.match(new RegExp(`^${recording.seat}[a-c]?:`)))).toBe(true);
      const sides = room.battle.sides || [];
      expect(sides).toHaveLength(['multi', 'freeforall'].includes(recording.scenario) ? 4 : 2);
      expect(new Set(sides.map(side => side.id)).size).toBe(sides.length);
      expect(sides.find(side => side.id === recording.seat)?.name).toBe(recording.username);
      const rawCount = room.rawLog.length;
      const oldEngine = room.engine;
      for (const frame of frames) useArenaStore.getState().handleFrame(frame);
      const restored = useArenaStore.getState().rooms[roomId];
      if (restored.type !== 'battle') throw new Error('Reconnect transcript lost battle state.');
      expect(restored.engine).not.toBe(oldEngine);
      expect(restored.rawLog).toHaveLength(rawCount);
      expect(restored.battle.playerSide).toBe(recording.seat);
      expect(restored.battle.team).toHaveLength(6);
    });
  }
});
