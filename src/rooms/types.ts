import type {
  ArenaBattle,
  BattleChoiceDraft,
  BattleChoiceSession,
  BattleRequest,
} from '../compat/battle-adapter';

/**
 * The room registry.
 *
 * Pokémon Showdown is room-based: the lobby, chat rooms, battles and PMs are
 * all rooms with a shared lifecycle (join → traffic → leave). The client used
 * to smear battle state across seven parallel maps keyed by room id — the
 * shape that bred the side-assignment and request-wipe bugs. One discriminated
 * union, one map.
 */

export type ChatMessage = {
  user: string;
  message: string;
  timestamp?: number;
  kind?: 'chat' | 'pm' | 'system' | 'error' | 'announce' | 'me' | 'html';
};

export type RoomBase = {
  id: string;
  title: string;
  connected: boolean;
  users: string[];
  chat: ChatMessage[];
  /** Human-readable event lines (battle rooms: pretty protocol text). */
  log: string[];
  /** Messages since the room was last focused. */
  unread: number;
};

export type ChatRoom = RoomBase & { type: 'chat' };

export type PmRoom = RoomBase & {
  type: 'pm';
  /** The other participant. */
  partner: string;
};

export type BattleTimer = {
  on: boolean;
  /** Seconds left for our decision, as of `asOf` (epoch ms). */
  secondsLeft?: number;
  totalLeft?: number;
  asOf?: number;
};

export type BattleRoom = RoomBase & {
  type: 'battle';
  battle: ArenaBattle;
  /** Raw protocol lines, in order — feeds the engine, replays and /savereplay. */
  rawLog: string[];
  choiceSession?: BattleChoiceSession;
  choiceDraft: BattleChoiceDraft;
  choiceError?: string;
  /** Last |request| payload; replayed when the dex chunk finishes loading. */
  lastRequest?: BattleRequest;
  timer: BattleTimer;
};

export type Room = ChatRoom | PmRoom | BattleRoom;

export const isBattleRoom = (room: Room | undefined): room is BattleRoom => room?.type === 'battle';
export const isChatRoom = (room: Room | undefined): room is ChatRoom => room?.type === 'chat';
export const isPmRoom = (room: Room | undefined): room is PmRoom => room?.type === 'pm';
