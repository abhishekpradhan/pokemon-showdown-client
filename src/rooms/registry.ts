import { emptyBattle } from '../compat/battle-adapter';
import type { BattleRoom, ChatMessage, ChatRoom, PmRoom, Room } from './types';

/** Pure helpers over the room map. All return new objects; nothing mutates. */

const CHAT_LIMIT = 200;
const LOG_LIMIT = 400;

export const newChatRoom = (id: string, title = ''): ChatRoom => ({
  type: 'chat',
  id,
  title: title || id,
  connected: true,
  users: [],
  chat: [],
  log: [],
  unread: 0,
});

export const newPmRoom = (id: string, partner: string): PmRoom => ({
  type: 'pm',
  id,
  title: partner,
  partner,
  connected: true,
  users: [],
  chat: [],
  log: [],
  unread: 0,
});

export const newBattleRoom = (id: string): BattleRoom => ({
  type: 'battle',
  id,
  title: id,
  connected: true,
  users: [],
  chat: [],
  log: [],
  unread: 0,
  battle: {
    ...emptyBattle,
    id,
    format: id.split('-')[1] || 'Battle',
    team: [],
    opponentTeam: [],
    log: [],
    chat: [],
    // Every battle starts as a spectator's view. A |request| or a |player|
    // line matching our username promotes it — never the other way around.
    mode: 'spectator',
    waiting: false,
    playerSide: undefined,
  },
  rawLog: [],
  choiceDraft: { choices: [] },
  timer: { on: false },
});

export const upsert = <R extends Room>(
  rooms: Record<string, Room>,
  room: R
): Record<string, Room> => ({ ...rooms, [room.id]: room });

export const patchRoom = (
  rooms: Record<string, Room>,
  id: string,
  patch: Partial<RoomPatchable>
): Record<string, Room> => {
  const room = rooms[id];
  if (!room) return rooms;
  return { ...rooms, [id]: { ...room, ...patch } as Room };
};

type RoomPatchable = Pick<Room, 'title' | 'connected' | 'users' | 'unread'>;

export const updateBattleRoom = (
  rooms: Record<string, Room>,
  id: string,
  update: (room: BattleRoom) => BattleRoom
): Record<string, Room> => {
  const room = rooms[id];
  if (room?.type !== 'battle') return rooms;
  return { ...rooms, [id]: update(room) };
};

export const appendChat = (room: Room, message: ChatMessage, focused: boolean): Room => ({
  ...room,
  chat: [...room.chat, message].slice(-CHAT_LIMIT),
  unread: focused ? 0 : room.unread + 1,
} as Room);

export const appendLog = (room: Room, line: string): Room => ({
  ...room,
  log: [line, ...room.log].slice(0, LOG_LIMIT),
} as Room);

export const battleRooms = (rooms: Record<string, Room>): BattleRoom[] =>
  Object.values(rooms).filter((room): room is BattleRoom => room.type === 'battle');

export const openRooms = (rooms: Record<string, Room>): Room[] =>
  Object.values(rooms).filter(room => room.connected);
