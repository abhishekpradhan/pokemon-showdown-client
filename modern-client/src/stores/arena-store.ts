import { create } from 'zustand';
import {
  addBattleChoice,
  battleFromRequest,
  battleDecisionState,
  buildBattleCommand,
  demoBattle,
  emptyBattle,
  createBattleChoiceSession,
  type ArenaBattle,
  type BattleChoice,
  type BattleChoiceSession,
  type BattleChoiceState,
  type BattleDecisionState,
  type BattleRoomMode,
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
import {
  parseFormats,
  parseQueryResponse,
  parseRoomList,
  parseSearchUpdate,
  toId,
  type RoomList,
} from '../compat/protocol-parsers';
import {
  exportPackedTeam,
  exportTeam,
  importPackedTeam,
  importTeams,
  loadStoredTeams,
  saveStoredTeams,
  validateStoredTeam,
  validateTeamSets,
  type PackedTeam,
  type StoredTeam,
  type TeamValidationResult,
} from '../compat/team-store';

type SearchState = 'idle' | 'searching';

export type FormatOption = {
  id: string;
  name: string;
  section?: string;
  searchShow?: boolean;
  team?: boolean;
  challengeShow?: boolean;
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

export type TeamEditorState = {
  editingTeamId?: string;
  draftName: string;
  draftFormat: string;
  draftText: string;
  dirty: boolean;
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
  searchFormats: string[];
  battle: ArenaBattle;
  battles: Record<string, ArenaBattle>;
  choiceSessionByRoom: Record<string, BattleChoiceSession>;
  choiceDraftByRoom: Record<string, BattleDecisionState['draft']>;
  choiceErrorByRoom: Record<string, string | undefined>;
  battleModeByRoom: Record<string, BattleRoomMode>;
  rooms: Record<string, RoomState>;
  roomList: RoomList;
  activeTeam: PackedTeam;
  teams: StoredTeam[];
  activeTeamId?: string;
  teamNotice?: string;
  loginPending: boolean;
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
  refreshRoomList: (format?: string) => void;
  sendRoomMessage: (roomId: string, message: string) => void;
  setSelectedFormat: (format: string) => void;
  setActiveTeam: (team: PackedTeam) => void;
  importTeamText: (text: string, name?: string, format?: string) => void;
  selectTeam: (teamId: string) => void;
  deleteTeam: (teamId: string) => void;
  renameTeam: (teamId: string, name: string) => void;
  duplicateTeam: (teamId: string) => void;
  updateTeamFormat: (teamId: string, format: string) => void;
  replaceTeamFromText: (teamId: string, text: string) => void;
  validateTeamForFormat: (teamId?: string, formatId?: string) => TeamValidationResult;
  exportActiveTeam: () => string;
  startSearch: () => void;
  cancelSearch: () => void;
  submitBattleChoice: (choice: BattleChoice | PokemonSet, roomId?: string) => void;
  submitBattleTarget: (target: number, roomId?: string) => void;
  getBattleDecision: (roomId?: string) => BattleDecisionState;
  resetBattleChoiceSession: (roomId?: string) => void;
  undoBattleChoice: (roomId?: string) => void;
  toggleBattleTimer: (roomId?: string) => void;
  forfeitBattle: (roomId?: string) => void;
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
const sampleStoredTeam: StoredTeam = {
  id: 'sample-gen9ou',
  name: 'Arena sample',
  format: 'gen9ou',
  packed: sampleTeam,
  sets: importTeams(sampleTeam, 'gen9ou')[0]?.sets || [],
  updatedAt: Date.now(),
};

const initialTeams = () => {
  const stored = loadStoredTeams();
  return stored.length ? stored : [sampleStoredTeam];
};
const bootstrappedTeams = initialTeams();

const protocol = new ProtocolClient();
let loginTimeout: number | undefined;
let cancelSearchTimeout: number | undefined;

const clearLoginTimeout = () => {
  if (loginTimeout) window.clearTimeout(loginTimeout);
  loginTimeout = undefined;
};

const scheduleLoginTimeout = () => {
  clearLoginTimeout();
  loginTimeout = window.setTimeout(() => {
    const state = useArenaStore.getState();
    if (state.loginPending) useArenaStore.setState({ loginPending: false, lastError: 'The server did not confirm that name. Try again or reconnect.' });
  }, 8_000);
};

const clearCancelSearchTimeout = () => {
  if (cancelSearchTimeout) window.clearTimeout(cancelSearchTimeout);
  cancelSearchTimeout = undefined;
};

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

const sanitizeProtocolLog = (raw: string) => raw
  .replace(/(\|challstr\|)[^\r\n]*/g, '$1[redacted]')
  .replace(/(\/trn\s+[^,\r\n|]+,0,)[^\r\n|]+/g, '$1[redacted]');

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
    useArenaStore.setState(state => ({
      connection: event.state,
      connectionReason: event.reason,
      loginPending: event.state === 'offline' || event.state === 'error' ? false : state.loginPending,
      lastError: state.loginPending && (event.state === 'offline' || event.state === 'error') ? 'Connection closed before the name was confirmed.' : state.lastError,
    }));
    if (event.state === 'connected') {
      const state = useArenaStore.getState();
      Object.values(state.rooms)
        .filter(room => room.connected && room.id !== 'lobby')
        .forEach(room => state.protocol.send(`/join ${room.id}`));
    }
  } else if (event.type === 'frame') {
    useArenaStore.getState().handleFrame(event.frame);
  } else if (event.type === 'send') {
    useArenaStore.setState(state => ({
      rawProtocolLog: state.protocolLogEnabled ? [`>> ${sanitizeProtocolLog(event.message)}`, ...state.rawProtocolLog].slice(0, 240) : state.rawProtocolLog,
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
  searchFormats: [],
  battle: emptyBattle,
  battles: import.meta.env.MODE === 'test' || import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true' ? { [demoBattle.id]: demoBattle } : {},
  choiceSessionByRoom: {},
  choiceDraftByRoom: {},
  choiceErrorByRoom: {},
  battleModeByRoom: {},
  rooms: {},
  roomList: { rooms: [] },
  activeTeam: bootstrappedTeams[0]?.packed || sampleTeam,
  teams: bootstrappedTeams,
  activeTeamId: bootstrappedTeams[0]?.id,
  loginPending: false,
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
    if (get().connection !== 'connected') {
      set({ lastError: 'Connect to the server before choosing a name.' });
      return;
    }
    set({ loginPending: true, lastError: undefined });
    scheduleLoginTimeout();
    get().protocol.send(`/trn ${trimmed}`);
  },
  login: async ({ name, password }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!password) return get().chooseName(trimmed);
    if (get().connection !== 'connected') {
      set({ lastError: 'Connect to the server before logging in.' });
      return;
    }
    const { challstr, server } = get();
    const body = new URLSearchParams({ act: 'login', name: trimmed, pass: password, challstr });
    set({ loginPending: true, lastError: undefined });
    scheduleLoginTimeout();
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
        clearLoginTimeout();
        set({ loginPending: false, lastError: data.error || 'Login did not return an assertion.' });
      }
    } catch (error) {
      clearLoginTimeout();
      set({ loginPending: false, lastError: error instanceof Error ? error.message : 'Login failed.' });
    }
  },
  joinRoom: roomId => get().protocol.send(`/join ${toId(roomId)}`),
  leaveRoom: roomId => get().protocol.send('/leave', toId(roomId)),
  refreshRoomList: format => {
    const suffix = format ? ` ${toId(format)},,` : '';
    get().protocol.send(`/cmd roomlist${suffix}`);
  },
  sendRoomMessage: (roomId, message) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    get().protocol.send(trimmed.startsWith('/') ? trimmed : trimmed, toId(roomId));
  },
  setSelectedFormat: selectedFormat => set({ selectedFormat }),
  setActiveTeam: activeTeam => set({ activeTeam: importPackedTeam(activeTeam), activeTeamId: undefined }),
  importTeamText: (text, name, format) => {
    const imported = importTeams(text, format || get().selectedFormat);
    if (!imported.length) {
      set({ teamNotice: 'No Pokemon sets were found in that import.', lastError: 'Team import failed.' });
      return;
    }
    const invalid = imported.find(team => !validateTeamSets(team.sets).ok);
    if (invalid) {
      const validation = validateTeamSets(invalid.sets);
      set({ teamNotice: undefined, lastError: validation.errors.join(' ') || 'Team import failed validation.' });
      return;
    }
    const teams = imported.map((team, index) => ({ ...team, name: name?.trim() || team.name || `Imported team ${index + 1}` }));
    set(state => {
      const nextTeams = [...teams, ...state.teams.filter(existing => !teams.some(team => team.id === existing.id))];
      saveStoredTeams(nextTeams);
      return {
        teams: nextTeams,
        activeTeamId: teams[0].id,
        activeTeam: teams[0].packed,
        teamNotice: `${teams.length} team${teams.length === 1 ? '' : 's'} imported.`,
        lastError: undefined,
      };
    });
  },
  selectTeam: teamId => {
    const team = get().teams.find(entry => entry.id === teamId);
    if (!team) return;
    set({ activeTeamId: team.id, activeTeam: team.packed, teamNotice: `${team.name} selected.` });
  },
  deleteTeam: teamId => {
    set(state => {
      const deleted = state.teams.find(team => team.id === teamId);
      const teams = state.teams.filter(team => team.id !== teamId);
      const activeTeam = state.activeTeamId === teamId ? teams[0] : state.teams.find(team => team.id === state.activeTeamId);
      saveStoredTeams(teams);
      return {
        teams,
        activeTeamId: activeTeam?.id,
        activeTeam: activeTeam?.packed || '',
        teamNotice: deleted ? `${deleted.name} deleted.` : 'Team deleted.',
        lastError: undefined,
      };
    });
  },
  renameTeam: (teamId, name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ lastError: 'Team name cannot be empty.' });
      return;
    }
    set(state => {
      const teams = state.teams.map(team => team.id === teamId ? { ...team, name: trimmed, updatedAt: Date.now() } : team);
      saveStoredTeams(teams);
      return { teams, teamNotice: 'Team renamed.', lastError: undefined };
    });
  },
  duplicateTeam: teamId => {
    const team = get().teams.find(entry => entry.id === teamId);
    if (!team) return;
    const copy: StoredTeam = {
      ...team,
      id: `${toId(team.name)}-copy-${Date.now()}`,
      name: `${team.name} copy`,
      updatedAt: Date.now(),
    };
    set(state => {
      const teams = [copy, ...state.teams];
      saveStoredTeams(teams);
      return { teams, activeTeamId: copy.id, activeTeam: copy.packed, teamNotice: `${copy.name} created.`, lastError: undefined };
    });
  },
  updateTeamFormat: (teamId, format) => {
    set(state => {
      const teams = state.teams.map(team => team.id === teamId ? { ...team, format, updatedAt: Date.now() } : team);
      saveStoredTeams(teams);
      return { teams, teamNotice: 'Team format updated.', lastError: undefined };
    });
  },
  replaceTeamFromText: (teamId, text) => {
    const current = get().teams.find(team => team.id === teamId);
    if (!current) {
      get().importTeamText(text);
      return;
    }
    const imported = importTeams(text, current.format);
    const replacement = imported[0];
    if (!replacement) {
      set({ lastError: 'No Pokemon sets were found in that import.', teamNotice: undefined });
      return;
    }
    const validation = validateTeamSets(replacement.sets);
    if (!validation.ok) {
      set({ lastError: validation.errors.join(' '), teamNotice: undefined });
      return;
    }
    set(state => {
      const updatedTeam: StoredTeam = {
        ...current,
        sets: replacement.sets,
        packed: replacement.packed,
        updatedAt: Date.now(),
      };
      const teams = state.teams.map(team => team.id === teamId ? updatedTeam : team);
      saveStoredTeams(teams);
      return {
        teams,
        activeTeam: state.activeTeamId === teamId ? updatedTeam.packed : state.activeTeam,
        teamNotice: `${current.name} updated.`,
        lastError: undefined,
      };
    });
  },
  validateTeamForFormat: (teamId, formatId) => {
    const team = get().teams.find(entry => entry.id === (teamId || get().activeTeamId));
    const selectedFormat = get().formats.find(format => format.id === (formatId || get().selectedFormat));
    if (selectedFormat?.team === false) return { ok: true, errors: [], warnings: [] };
    return validateStoredTeam(team);
  },
  exportActiveTeam: () => {
    const team = get().teams.find(entry => entry.id === get().activeTeamId);
    return team ? exportTeam(team.packed) : exportTeam(get().activeTeam);
  },
  startSearch: () => {
    const { protocol: client, selectedFormat, activeTeam, activeTeamId, formats, connection, named, searchState } = get();
    const format = formats.find(entry => entry.id === selectedFormat);
    const validation = get().validateTeamForFormat(activeTeamId, selectedFormat);
    const blockers = [
      connection !== 'connected' ? 'Connect to a PS-compatible server before searching.' : '',
      !named ? 'Choose a name before searching.' : '',
      searchState === 'searching' ? 'You are already searching.' : '',
      !format?.searchShow ? 'This format is not available for ladder search.' : '',
      format?.team !== false && !activeTeamId ? 'Select or import a team before searching this format.' : '',
      format?.team !== false && !validation.ok ? validation.errors.join(' ') : '',
    ].filter(Boolean);
    if (blockers.length) {
      set({ lastError: blockers.join(' ') });
      return;
    }
    if (format?.team !== false && activeTeam) client.send(`/utm ${exportPackedTeam(activeTeam)}`);
    client.send(`/search ${selectedFormat}`);
    set({ searchState: 'searching', searchFormats: [selectedFormat], notifications: 3, lastError: undefined });
  },
  cancelSearch: () => {
    clearCancelSearchTimeout();
    get().protocol.send('/cancelsearch');
    cancelSearchTimeout = window.setTimeout(() => {
      const state = useArenaStore.getState();
      if (state.searchState === 'searching') useArenaStore.setState({ searchState: 'idle', searchFormats: [], lastError: 'Search cancel was sent, but the server did not confirm it.' });
    }, 4_000);
  },
  submitBattleChoice: (choice, roomId) => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    const session = get().choiceSessionByRoom[battle.id];
    const choiceState: BattleChoiceState = 'cmd' in choice ? {
      kind: 'move',
      slot: choice.slot,
      activeIndex: choice.activeIndex,
      tera: choice.cmd.includes('terastallize'),
      mega: choice.cmd.includes('mega'),
      ultra: choice.cmd.includes('ultra'),
      z: choice.cmd.includes('zmove'),
      max: choice.cmd.includes('dynamax') || choice.cmd.includes(' max'),
    } : battle.requestType === 'team' ? {
      kind: 'team',
      order: [choice.slot],
    } : {
      kind: 'switch',
      slot: choice.slot,
    };
    const logLine = buildBattleCommand(choice, battle.rqid);
    if (!session) {
      set(state => ({ choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: 'No active battle request.' } }));
      return;
    }
    const result = addBattleChoice(session, choiceState);
    if (!result.ok) {
      set(state => ({
        choiceSessionByRoom: { ...state.choiceSessionByRoom, [battle.id]: result.session },
        choiceDraftByRoom: { ...state.choiceDraftByRoom, [battle.id]: result.draft },
        choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: result.error },
      }));
      return;
    }
    if (result.command) get().protocol.send(result.command, roomId || battle.id);
    set(state => {
      const updated = {
        ...battle,
        log: [result.message || logLine, ...battle.log].slice(0, 8),
        waiting: result.complete,
        choiceError: undefined,
        choiceDraft: result.draft,
      };
      return {
        battle: updated,
        battles: { ...state.battles, [battle.id]: updated },
        choiceSessionByRoom: { ...state.choiceSessionByRoom, [battle.id]: result.session },
        choiceDraftByRoom: { ...state.choiceDraftByRoom, [battle.id]: result.draft },
        choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: undefined },
      };
    });
  },
  submitBattleTarget: (target, roomId) => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    const session = get().choiceSessionByRoom[battle.id];
    const pending = session?.draft.pendingMove;
    if (!session || !pending) {
      set(state => ({ choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: 'No move is waiting for a target.' } }));
      return;
    }
    const result = addBattleChoice(session, { ...pending, target });
    if (result.command) get().protocol.send(result.command, roomId || battle.id);
    set(state => {
      const updated = {
        ...battle,
        waiting: result.complete,
        log: [result.complete ? 'Battle choice sent.' : result.message || 'Target selected.', ...battle.log].slice(0, 8),
        choiceDraft: result.draft,
        choiceError: result.error,
      };
      return {
        battle: updated,
        battles: { ...state.battles, [battle.id]: updated },
        choiceSessionByRoom: { ...state.choiceSessionByRoom, [battle.id]: result.session },
        choiceDraftByRoom: { ...state.choiceDraftByRoom, [battle.id]: result.draft },
        choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: result.error },
      };
    });
  },
  getBattleDecision: roomId => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    return battleDecisionState(
      battle.id,
      battle,
      get().choiceSessionByRoom[battle.id],
      get().choiceErrorByRoom[battle.id]
    );
  },
  resetBattleChoiceSession: roomId => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    const session = get().choiceSessionByRoom[battle.id];
    const nextSession = session ? createBattleChoiceSession(session.request) : undefined;
    set(state => ({
      choiceSessionByRoom: nextSession ? { ...state.choiceSessionByRoom, [battle.id]: nextSession } : state.choiceSessionByRoom,
      choiceDraftByRoom: { ...state.choiceDraftByRoom, [battle.id]: { choices: [] } },
      choiceErrorByRoom: { ...state.choiceErrorByRoom, [battle.id]: undefined },
      battles: { ...state.battles, [battle.id]: { ...battle, choiceDraft: { choices: [] }, choiceError: undefined } },
    }));
  },
  undoBattleChoice: roomId => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    if (battle.noCancel) {
      get().recordBattleEvent('This request cannot be cancelled.', battle.id);
      return;
    }
    get().protocol.send('/undo', roomId || battle.id);
    get().recordBattleEvent('Choice cancellation sent.', battle.id);
  },
  toggleBattleTimer: roomId => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    get().protocol.send('/timer on', roomId || battle.id);
    get().recordBattleEvent('Battle timer command sent.', battle.id);
  },
  forfeitBattle: roomId => {
    const battle = get().battles[roomId || get().battle.id] || get().battle;
    get().protocol.send('/forfeit', roomId || battle.id);
    get().recordBattleEvent('Forfeit command sent.', battle.id);
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
      rawProtocolLog: state.protocolLogEnabled ? [`<< ${sanitizeProtocolLog(frame.raw)}`, ...state.rawProtocolLog].slice(0, 240) : state.rawProtocolLog,
    }));

    const roomId = frame.roomId || 'lobby';

    for (const line of frame.lines) {
      switch (line.command) {
      case 'challstr':
        set({ challstr: line.args.join('|') });
        break;
      case 'updateuser':
        clearLoginTimeout();
        set({
          username: line.args[0] || 'Guest Player',
          named: line.args[1] === '1',
          connection: 'connected',
          loginPending: false,
          lastError: undefined,
        });
        break;
      case 'nametaken':
        clearLoginTimeout();
        set({ loginPending: false, lastError: line.args.slice(1).join('|') || `${line.args[0] || 'That name'} is not available.` });
        break;
      case 'formats':
        set(state => {
          const parsed = parseFormats(line.args);
          const formats = parsed.length ? parsed : state.formats;
          const selectedFormat = formats.some(format => format.id === state.selectedFormat) ? state.selectedFormat : formats[0]?.id || state.selectedFormat;
          return { formats, selectedFormat };
        });
        break;
      case 'updatesearch': {
        const update = parseSearchUpdate(line.args.join('|'));
        if (!update) break;
        clearCancelSearchTimeout();
        set({
          searchFormats: update.searching,
          searchState: update.searching.length ? 'searching' : 'idle',
          lastError: undefined,
        });
        break;
      }
      case 'popup':
        set({ lastError: line.args.join('|') || 'Server popup received.' });
        break;
      case 'error':
        set({ lastError: line.args.join('|') || 'Server error.' });
        break;
      case 'updatechallenges':
        set({ notifications: Math.max(get().notifications, 1) });
        break;
      case 'queryresponse': {
        const response = parseQueryResponse(line);
        if (!response) break;
        if (response.id === 'roomlist') {
          const roomList = parseRoomList(response.data);
          if (roomList) set({ roomList });
        }
        break;
      }
      case 'pm': {
        const from = line.args[0] || 'pm';
        const to = line.args[1] || '';
        const message = line.args.slice(2).join('|');
        const other = toId(from) === toId(get().username) ? to : from;
        const pmRoom = `pm-${toId(other) || 'system'}`;
        set(state => ({
          rooms: {
            ...state.rooms,
            [pmRoom]: appendRoomChat(state.rooms[pmRoom] || {
              id: pmRoom,
              title: other || 'Private message',
              type: 'pm',
              connected: true,
              users: [],
              chat: [],
              log: [],
            }, {
              kind: 'pm',
              user: from,
              message,
              timestamp: Date.now(),
            }),
          },
          notifications: state.notifications + 1,
        }));
        break;
      }
      case 'init': {
        const type = line.args[0] || (roomId.startsWith('battle-') ? 'battle' : 'chat');
        const initialBattle = { ...emptyBattle, id: roomId, format: roomId.split('-')[1] || 'Battle' };
        set(state => ({
          rooms: upsertRoom(state.rooms, roomId, {
            id: roomId,
            title: roomId,
            type,
            connected: true,
          }),
          battles: type === 'battle' ? { ...state.battles, [roomId]: state.battles[roomId] || initialBattle } : state.battles,
          battle: type === 'battle' ? state.battles[roomId] || initialBattle : state.battle,
          battleModeByRoom: type === 'battle' ? { ...state.battleModeByRoom, [roomId]: 'waiting' } : state.battleModeByRoom,
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
          const previous = state.battles[roomId] || { ...emptyBattle, id: roomId };
          const updated = battleFromRequest(roomId, request, previous);
          const session = createBattleChoiceSession(request);
          return {
            battle: updated,
            battles: { ...state.battles, [roomId]: updated },
            searchState: 'idle',
            choiceSessionByRoom: { ...state.choiceSessionByRoom, [roomId]: session },
            choiceDraftByRoom: { ...state.choiceDraftByRoom, [roomId]: session.draft },
            choiceErrorByRoom: { ...state.choiceErrorByRoom, [roomId]: undefined },
            battleModeByRoom: { ...state.battleModeByRoom, [roomId]: updated.mode || 'player' },
          };
        });
        break;
      }
      case 'player':
        set(state => {
          const battle = state.battles[roomId] || { ...emptyBattle, id: roomId };
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
            const battle = state.battles[roomId] || { ...emptyBattle, id: roomId };
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
