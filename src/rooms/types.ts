import type { Battle } from '@pkmn/client';
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
  /** Named |uhtml| blocks (polls, tour cards) update in place by this key. */
  uhtmlName?: string;
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

export type BracketNode = {
  team?: string;
  state?: string;
  result?: string;
  score?: number[];
  children?: BracketNode[];
};

export type TournamentState = {
  format: string;
  generator: string;
  playerCap: number;
  isStarted: boolean;
  isJoined: boolean;
  /** Signup roster from join/leave; the bracket takes over once started. */
  players: string[];
  bracketData?: { type: string; rootNode?: BracketNode; tableHeaders?: { cols: string[]; rows: string[] }; tableContents?: Array<Array<{ state?: string; result?: string; score?: number[] } | null>> };
  /** Opponents you can /tour challenge right now, and those challenging you. */
  challenges: string[];
  challengeBys: string[];
  challenged?: string | null;
  challenging?: string | null;
  teambuilderFormat?: string;
  error?: string;
  results?: string[][];
  /** Your live tournament battle, from |tournament|battlestart|. */
  currentBattle?: string;
  ended?: boolean;
};

export type ChatRoom = RoomBase & { type: 'chat'; tournament?: TournamentState };

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
  /** Projected view the components render. */
  battle: ArenaBattle;
  /** The @pkmn/client battle; absent until the engine chunk loads, at which
      point rawLog is replayed through a fresh instance. */
  engine?: Battle;
  /** Our seat when playing; null while spectating. */
  perspective: 'p1' | 'p2' | null;
  /** Tracked from |win|/|tie| — the engine does not model game end. */
  result?: { winner?: string; ended: boolean };
  /** Raw protocol lines, in order — feeds the engine, replays and /savereplay. */
  rawLog: string[];
  choiceSession?: BattleChoiceSession;
  choiceDraft: BattleChoiceDraft;
  choiceError?: string;
  /** True between submitting a choice and the next |request|. */
  choicePending: boolean;
  lastRequest?: BattleRequest;
  timer: BattleTimer;
  /** Drives transient field animation (lunge/shake/faint) and the action
   * banner — `label` is the human line ("Vespiquen used Toxic!"). */
  lastEvent?: {
    kind: 'attack' | 'hit' | 'faint' | 'note';
    side: 'near' | 'far';
    slot?: number;
    at: number;
    label?: string;
  };
};

export type Room = ChatRoom | PmRoom | BattleRoom;

export const isBattleRoom = (room: Room | undefined): room is BattleRoom => room?.type === 'battle';
export const isChatRoom = (room: Room | undefined): room is ChatRoom => room?.type === 'chat';
export const isPmRoom = (room: Room | undefined): room is PmRoom => room?.type === 'pm';
