import { create } from 'zustand';
import {
  battleFromRequest,
  buildBattleCommand,
  commandForChoice,
  demoBattle,
  type ArenaBattle,
  type BattleChoice,
  type BattleRequest,
  type PokemonSet,
} from '../compat/battle-adapter';
import {
  getDefaultServerConfig,
  ProtocolClient,
  type ConnectionState,
  type PsFrame,
  type PsLine,
  type ServerConfig,
} from '../compat/protocol-client';
import { exportPackedTeam, importPackedTeam, type PackedTeam } from '../compat/team-store';

type SearchState = 'idle' | 'searching';

export type FormatOption = {
  id: string;
  name: string;
  section?: string;
  searchShow?: boolean;
  team?: boolean;
};

export type ChatMessage = {
  user: string;
  message: string;
  timestamp?: number;
  kind?: 'chat' | 'pm' | 'system' | 'error';
};

export type RoomState = {
  id: string;
  title: string;
  type: string;
  connected: boolean;
  users: string[];
  chat: ChatMessage[];
  log: string[];
};

type LoginCredentials = {
  name: string;
  password?: string;
};

type ArenaState = {
  username: string;
  named: boolean;
  challstr: string;
  connection: ConnectionState;
  connectionReason?: string;
  notifications: number;
  selectedFormat: string;
  formats: FormatOption[];
  searchState: SearchState;
  battle: ArenaBattle;
  battles: Record<string, ArenaBattle>;
  rooms: Record<string, RoomState>;
  activeTeam: PackedTeam;
  hardcoreMode: boolean;
  protocolLogEnabled: boolean;
  rawProtocolLog: string[];
  lastError?: string;
  server: ServerConfig;
  protocol: ProtocolClient;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  chooseName: (name: string) => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendRoomMessage: (roomId: string, message: string) => void;
  setSelectedFormat: (format: string) => void;
  setActiveTeam: (team: PackedTeam) => void;
  startSearch: () => void;
  cancelSearch: () => void;
  submitBattleChoice: (choice: BattleChoice | PokemonSet, roomId?: string) => void;
  recordBattleEvent: (event: string, roomId?: string) => void;
  sendBattleChat: (message: string, roomId?: string) => void;
  toggleHardcore: (checked: boolean) => void;
  toggleProtocolLog: (checked: boolean) => void;
  handleFrame: (frame: PsFrame) => void;
};

const defaultFormats: FormatOption[] = [
  { id: 'gen9ou', name: 'Gen 9 OU', team: true, searchShow: true },
  { id: 'gen9randombattle', name: 'Gen 9 Random Battle', searchShow: true },
  { id: 'gen9ubers', name: 'Gen 9 Ubers', team: true, searchShow: true },
  { id: 'gen9nationaldex', name: 'National Dex', team: true, searchShow: true },
  { id: 'gen9vgc2026regg', name: 'VGC 2026', team: true, searchShow: true },
];

const sampleTeam = importPackedTeam(`Iron Valiant||boosterenergy|quarkdrive|moonblast,closecombat,thunderbolt,encore|Jolly|,,,252,4,252|||||]Dragapult||choicespecs|infiltrator|shadowball,dracometeor,uturn,flamethrower|Timid|,,,252,4,252|||||`);

const protocol = new ProtocolClient();

const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const formatName = (id: string) => defaultFormats.find(format => format.id === id)?.name ||
  id.replace(/^gen(\d)/, 'Gen $1 ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, letter => letter.toUpperCase());

const upsertRoom = (rooms: Record<string, RoomState>, roomId: string, patch: Partial<RoomState>): Record<string, RoomState> => {
  const existing = rooms[roomId] || {
    id: roomId,
    title: roomId || 'Lobby',
    type: roomId.startsWith('battle-') ? 'battle' : 'chat',
    connected: false,
    users: [],
    chat: [],
    log: [],
  };
  return {
    ...rooms,
    [roomId]: { ...existing, ...patch },
  };
};

const appendRoomLog = (room: RoomState | undefined, line: string): RoomState => ({
  id: room?.id || 'lobby',
  title: room?.title || 'Lobby',
  type: room?.type || 'chat',
  connected: room?.connected ?? true,
  users: room?.users || [],
  chat: room?.chat || [],
  log: [line, ...(room?.log || [])].slice(0, 80),
});

const appendRoomChat = (room: RoomState | undefined, message: ChatMessage): RoomState => ({
  id: room?.id || 'lobby',
  title: room?.title || 'Lobby',
  type: room?.type || 'chat',
  connected: room?.connected ?? true,
  users: room?.users || [],
  chat: [...(room?.chat || []), message].slice(-120),
  log: room?.log || [],
});

const parseFormatLine = (raw: string, section: string): { format?: FormatOption; section: string } => {
  if (!raw) return { section };
  if (raw.startsWith(',')) return { section: raw.slice(1).trim() || section };

  const parts = raw.split(',');
  const id = toId(parts[0] || '');
  if (!id) return { section };
  const name = parts[1]?.trim() || formatName(id);
  return {
    section,
    format: {
      id,
      name,
      section,
      searchShow: raw.includes('searchShow') || !raw.includes('challengeShow'),
      team: !id.includes('random'),
    },
  };
};

const parseChatLine = (line: PsLine): ChatMessage | null => {
  switch (line.command) {
  case 'c':
  case 'chat':
    return { user: line.args[0] || 'system', message: line.args.slice(1).join('|') };
  case 'c:':
    return {
      timestamp: Number(line.args[0]) || undefined,
      user: line.args[1] || 'system',
      message: line.args.slice(2).join('|'),
    };
  case 'pm':
    return { kind: 'pm', user: line.args[0] || 'pm', message: `${line.args[1] || ''}: ${line.args.slice(2).join('|')}` };
  case 'error':
    return { kind: 'error', user: 'error', message: line.args.join('|') };
  case 'popup':
    return { kind: 'system', user: 'system', message: line.args.join('|') };
  default:
    return null;
  }
};

const battleLogLine = (line: PsLine) => {
  switch (line.command) {
  case 'turn':
    return `Turn ${line.args[0]} started.`;
  case 'switch':
  case 'drag':
    return `${line.args[0]} switched to ${line.args[1]}.`;
  case 'move':
    return `${line.args[0]} used ${line.args[1]}.`;
  case '-damage':
    return `${line.args[0]} took damage (${line.args[1]}).`;
  case '-heal':
    return `${line.args[0]} recovered HP (${line.args[1]}).`;
  case 'faint':
    return `${line.args[0]} fainted.`;
  case 'win':
    return `${line.args[0]} won the battle.`;
  case 'tie':
    return 'The battle ended in a tie.';
  case 'error':
    return line.args.join('|');
  default:
    return line.raw.startsWith('|') ? '' : line.raw;
  }
};

const parseBattleRequest = (line: PsLine): BattleRequest | null => {
  const raw = line.args.join('|');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BattleRequest;
  } catch {
    return null;
  }
};

protocol.subscribe(event => {
  if (event.type === 'state') {
    useArenaStore.setState({ connection: event.state, connectionReason: event.reason });
  } else if (event.type === 'frame') {
    useArenaStore.getState().handleFrame(event.frame);
  } else if (event.type === 'send') {
    useArenaStore.setState(state => ({
      rawProtocolLog: state.protocolLogEnabled ? [`>> ${event.message}`, ...state.rawProtocolLog].slice(0, 240) : state.rawProtocolLog,
    }));
  } else if (event.type === 'error') {
    useArenaStore.setState({ lastError: event.error.message, connection: 'error' });
  }
});

export const useArenaStore = create<ArenaState>((set, get) => ({
  username: 'Guest Player',
  named: false,
  challstr: '',
  connection: 'offline',
  notifications: 2,
  selectedFormat: 'gen9ou',
  formats: defaultFormats,
  searchState: 'idle',
  battle: demoBattle,
  battles: { [demoBattle.id]: demoBattle },
  rooms: {},
  activeTeam: sampleTeam,
  hardcoreMode: false,
  protocolLogEnabled: import.meta.env.DEV,
  rawProtocolLog: [],
  server: getDefaultServerConfig(),
  protocol,
  connect: () => get().protocol.connect(),
  disconnect: () => get().protocol.disconnect(),
  reconnect: () => get().protocol.reconnect(),
  chooseName: async name => {
    const trimmed = name.trim();
    if (!trimmed) return;
    get().protocol.send(`/trn ${trimmed}`);
  },
  login: async ({ name, password }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!password) return get().chooseName(trimmed);
    const { challstr, server } = get();
    const body = new URLSearchParams({ act: 'login', name: trimmed, pass: password, challstr });
    try {
      const response = await fetch(server.loginServer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const text = await response.text();
      const data = JSON.parse(text.startsWith(']') ? text.slice(1) : text) as { assertion?: string; error?: string };
      if (data.assertion) {
        get().protocol.send(`/trn ${trimmed},0,${data.assertion}`);
      } else {
        set({ lastError: data.error || 'Login did not return an assertion.' });
      }
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : 'Login failed.' });
    }
  },
  joinRoom: roomId => get().protocol.send(`/join ${toId(roomId)}`),
  leaveRoom: roomId => get().protocol.send('/leave', toId(roomId)),
  sendRoomMessage: (roomId, message) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    get().protocol.send(trimmed.startsWith('/') ? trimmed : trimmed, toId(roomId));
  },
  setSelectedFormat: selectedFormat => set({ selectedFormat }),
  setActiveTeam: activeTeam => set({ activeTeam: importPackedTeam(activeTeam) }),
  startSearch: () => {
    const { protocol: client, selectedFormat, activeTeam, formats } = get();
    const format = formats.find(entry => entry.id === selectedFormat);
    if (format?.team !== false && activeTeam) client.send(`/utm ${exportPackedTeam(activeTeam)}`);
    client.send(`/search ${selectedFormat}`);
    set({ searchState: 'searching', notifications: 3 });
  },
  cancelSearch: () => {
    get().protocol.send('/cancelsearch');
    set({ searchState: 'idle' });
  },
  submitBattleChoice: (choice, roomId) => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    const command = commandForChoice(choice, battle.rqid);
    const logLine = buildBattleCommand(choice, battle.rqid);
    get().protocol.send(command, roomId || battle.id);
    set(state => ({
      battle: {
        ...battle,
        log: [logLine, ...battle.log].slice(0, 8),
        waiting: true,
      },
      battles: {
        ...state.battles,
        [battle.id]: {
          ...battle,
          log: [logLine, ...battle.log].slice(0, 8),
          waiting: true,
        },
      },
    }));
  },
  recordBattleEvent: (event, roomId) => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    set(state => ({
      battle: { ...battle, log: [event, ...battle.log].slice(0, 8) },
      battles: { ...state.battles, [battle.id]: { ...battle, log: [event, ...battle.log].slice(0, 8) } },
    }));
  },
  sendBattleChat: (message, roomId) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    get().protocol.send(trimmed, roomId || get().battle.id);
    set(state => {
      const battle = state.battles[roomId || state.battle.id] || state.battle;
      const updated = {
        ...battle,
        chat: [...battle.chat, { user: state.username, message: trimmed }].slice(-8),
      };
      return { battle: updated, battles: { ...state.battles, [updated.id]: updated } };
    });
  },
  toggleHardcore: hardcoreMode => set({ hardcoreMode }),
  toggleProtocolLog: protocolLogEnabled => set({ protocolLogEnabled }),
  handleFrame: frame => {
    set(state => ({
      rawProtocolLog: state.protocolLogEnabled ? [`<< ${frame.raw}`, ...state.rawProtocolLog].slice(0, 240) : state.rawProtocolLog,
    }));

    let collectingFormats = false;
    let currentSection = '';
    const roomId = frame.roomId || 'lobby';

    for (const line of frame.lines) {
      if (collectingFormats && line.command === 'format') {
        const parsed = parseFormatLine(line.raw, currentSection);
        currentSection = parsed.section;
        if (parsed.format) {
          set(state => {
            const exists = state.formats.some(format => format.id === parsed.format!.id);
            return { formats: exists ? state.formats : [...state.formats, parsed.format!] };
          });
        }
        continue;
      }

      switch (line.command) {
      case 'challstr':
        set({ challstr: line.args.join('|') });
        break;
      case 'updateuser':
        set({
          username: line.args[0] || 'Guest Player',
          named: line.args[1] === '1',
          connection: 'connected',
        });
        break;
      case 'formats':
        collectingFormats = true;
        break;
      case 'init': {
        const type = line.args[0] || (roomId.startsWith('battle-') ? 'battle' : 'chat');
        set(state => ({
          rooms: upsertRoom(state.rooms, roomId, {
            id: roomId,
            title: roomId,
            type,
            connected: true,
          }),
          battles: type === 'battle' ? { ...state.battles, [roomId]: state.battles[roomId] || { ...demoBattle, id: roomId } } : state.battles,
          battle: type === 'battle' ? state.battles[roomId] || { ...demoBattle, id: roomId } : state.battle,
        }));
        break;
      }
      case 'deinit':
        set(state => ({ rooms: upsertRoom(state.rooms, roomId, { connected: false }) }));
        break;
      case 'noinit':
        set(state => ({
          lastError: line.args.join(' '),
          rooms: upsertRoom(state.rooms, roomId, { connected: false }),
        }));
        break;
      case 'title':
        set(state => ({ rooms: upsertRoom(state.rooms, roomId, { title: line.args.join('|') || roomId }) }));
        break;
      case 'users':
        set(state => ({ rooms: upsertRoom(state.rooms, roomId, { users: line.args.join('|').split(',').filter(Boolean) }) }));
        break;
      case 'request': {
        const request = parseBattleRequest(line);
        if (!request) break;
        set(state => {
          const previous = state.battles[roomId] || { ...demoBattle, id: roomId };
          const updated = battleFromRequest(roomId, request, previous);
          return {
            battle: updated,
            battles: { ...state.battles, [roomId]: updated },
            searchState: 'idle',
          };
        });
        break;
      }
      case 'player':
        set(state => {
          const battle = state.battles[roomId] || { ...demoBattle, id: roomId };
          const slot = line.args[0];
          const name = line.args[1] || (slot === 'p1' ? battle.p1.name : battle.p2.name);
          const updated = slot === 'p1' ?
            { ...battle, p1: { ...battle.p1, name } } :
            { ...battle, p2: { ...battle.p2, name } };
          return { battle: updated, battles: { ...state.battles, [roomId]: updated } };
        });
        break;
      case 'turn':
        set(state => {
          const battle = state.battles[roomId] || state.battle;
          const updated = { ...battle, turn: Number(line.args[0]) || battle.turn, waiting: false };
          return { battle: updated, battles: { ...state.battles, [updated.id]: updated } };
        });
        break;
      default: {
        const chat = parseChatLine(line);
        if (chat) {
          set(state => ({
            rooms: { ...state.rooms, [roomId]: appendRoomChat(state.rooms[roomId], chat) },
            lastError: chat.kind === 'error' ? chat.message : state.lastError,
          }));
        }
        const logLine = roomId.startsWith('battle-') ? battleLogLine(line) : '';
        if (logLine) {
          set(state => {
            const battle = state.battles[roomId] || { ...state.battle, id: roomId };
            const updated = { ...battle, log: [logLine, ...battle.log].slice(0, 12) };
            return {
              battle: updated,
              battles: { ...state.battles, [roomId]: updated },
              rooms: { ...state.rooms, [roomId]: appendRoomLog(state.rooms[roomId], logLine) },
            };
          });
        }
      }
      }
    }
  },
}));
