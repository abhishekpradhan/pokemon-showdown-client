import { create } from 'zustand';
import {
  addBattleChoice,
  battleDecisionState,
  buildBattleCommand,
  createBattleChoiceSession,
  demoBattle,
  type ArenaBattle,
  type BattleChoice,
  type BattleChoiceState,
  type BattleDecisionState,
  type PokemonSet,
} from '../compat/battle-adapter';
import {
  getAssertion,
  loginWithPassword,
  logout,
  type AssertionOutcome,
} from '../compat/login-server';
import {
  getDefaultServerConfig,
  loadStoredServer,
  parseServerInput,
  saveStoredServer,
  ProtocolClient,
  type ConnectionState,
  type PsFrame,
  type ServerConfig,
} from '../compat/protocol-client';
import {
  toId,
  type ChatRoomList,
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
import { createEngineBattle, feedLine, onEngineReady, projectEngineBattle } from '../battle/engine';
import { routeFrame } from '../protocol/router';
import {
  appendChat,
  appendLog,
  newBattleRoom,
  patchRoom,
  updateBattleRoom,
  upsert,
} from '../rooms/registry';
import type { BattleRoom, ChatMessage, Room } from '../rooms/types';

export type { ChatMessage, Room, BattleRoom };
export type { ChatRoom, PmRoom } from '../rooms/types';

type SearchState = 'idle' | 'searching';

export type FormatOption = {
  id: string;
  name: string;
  section?: string;
  searchShow?: boolean;
  team?: boolean;
  challengeShow?: boolean;
};

export type Challenges = {
  /** username → format id, straight from `|updatechallenges|`. */
  from: Record<string, string>;
  to: { to: string; format: string } | null;
};

type LoginCredentials = {
  name: string;
  password?: string;
};

export type ArenaState = {
  // ── Session ──
  username: string;
  /** Global group symbol from `|updateuser|` (e.g. `+`, `%`, `@`). */
  userGroup: string;
  avatar?: string;
  named: boolean;
  challstr: string;
  connection: ConnectionState;
  connectionReason?: string;
  loginPending: boolean;
  /** Set when the login server reports the chosen name is registered. */
  needsPassword: boolean;
  lastError?: string;
  server: ServerConfig;
  protocol: ProtocolClient;

  // ── Directory ──
  formats: FormatOption[];
  selectedFormat: string;
  searchState: SearchState;
  searchFormats: string[];
  roomList: RoomList;
  chatRoomList: ChatRoomList;
  challenges: Challenges;
  notifications: number;

  // ── Rooms (the registry: chat, PMs and battles in one map) ──
  rooms: Record<string, Room>;
  activeRoomId?: string;

  // ── Teams ──
  activeTeam: PackedTeam;
  teams: StoredTeam[];
  activeTeamId?: string;
  teamNotice?: string;

  // ── Preferences / diagnostics ──
  hardcoreMode: boolean;
  protocolLogEnabled: boolean;
  rawProtocolLog: string[];
  /** Last `/savereplay` payload from the server (Phase 4 uploads it). */
  pendingReplay?: { id?: string; log?: string; password?: string };

  // ── Actions ──
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  setServer: (input: string) => boolean;
  resetServer: () => void;
  chooseName: (name: string) => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  focusRoom: (roomId?: string) => void;
  clearNotifications: () => void;
  refreshRoomList: (format?: string) => void;
  refreshChatRooms: () => void;
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
  sendChallenge: (user: string, format?: string) => void;
  acceptChallenge: (user: string) => void;
  rejectChallenge: (user: string) => void;
  cancelChallenge: () => void;
  submitBattleChoice: (choice: BattleChoice | PokemonSet, roomId?: string) => void;
  submitBattleTarget: (target: number, roomId?: string) => void;
  getBattleDecision: (roomId?: string) => BattleDecisionState;
  resetBattleChoiceSession: (roomId?: string) => void;
  undoBattleChoice: (roomId?: string) => void;
  toggleBattleTimer: (roomId?: string) => void;
  forfeitBattle: (roomId?: string) => void;
  recordBattleEvent: (event: string, roomId?: string) => void;
  sendBattleChat: (message: string, roomId?: string) => void;
  saveReplay: (roomId?: string) => void;
  toggleHardcore: (checked: boolean) => void;
  toggleProtocolLog: (checked: boolean) => void;
  handleFrame: (frame: PsFrame) => void;

  // ── Router callbacks (settle timeouts owned by the store) ──
  onLoginSettled: () => void;
  onSearchSettled: () => void;
  onReplaySaved: (data: { id?: string; log?: string; password?: string }) => void;
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

const demoRooms = (): Record<string, Room> => {
  if (import.meta.env.MODE !== 'test' && import.meta.env.VITE_ENABLE_DEMO_FIXTURES !== 'true') return {};
  const room = newBattleRoom(demoBattle.id);
  return {
    [demoBattle.id]: {
      ...room,
      title: `${demoBattle.p1.name} vs ${demoBattle.p2.name}`,
      battle: demoBattle,
      log: [...demoBattle.log],
      chat: demoBattle.chat.map(entry => ({ user: entry.user, message: entry.message })),
    },
  };
};

const protocol = new ProtocolClient(loadStoredServer());
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
    if (state.loginPending) {
      useArenaStore.setState({
        loginPending: false,
        lastError: 'The server did not confirm that name. Try again or reconnect.',
      });
    }
  }, 8_000);
};

const clearCancelSearchTimeout = () => {
  if (cancelSearchTimeout) window.clearTimeout(cancelSearchTimeout);
  cancelSearchTimeout = undefined;
};

/**
 * Turns a login-server assertion into either a `/trn` handshake or a UI state.
 * The server confirms the name with `|updateuser|`, which clears loginPending.
 */
const applyAssertion = (name: string, outcome: AssertionOutcome) => {
  if (outcome.kind === 'assertion') {
    useArenaStore.getState().protocol.send(`/trn ${name},0,${outcome.assertion}`);
    return;
  }
  clearLoginTimeout();
  if (outcome.kind === 'needs-password') {
    useArenaStore.setState({
      loginPending: false,
      needsPassword: true,
      lastError: `${name} is a registered account. Enter its password to log in.`,
    });
    return;
  }
  if (outcome.kind === 'needs-google') {
    useArenaStore.setState({
      loginPending: false,
      needsPassword: false,
      lastError: `${name} is linked to a Google account, which this client does not support yet. Choose a different name.`,
    });
    return;
  }
  useArenaStore.setState({ loginPending: false, needsPassword: false, lastError: outcome.message });
};

const sanitizeProtocolLog = (raw: string) => raw
  .replace(/(\|challstr\|)[^\r\n]*/g, '$1[redacted]')
  .replace(/(\/trn\s+[^,\r\n|]+,0,)[^\r\n|]+/g, '$1[redacted]');

/** Resolves an optional room id to the battle room it names, if any. */
const battleRoomFor = (state: ArenaState, roomId?: string): BattleRoom | undefined => {
  const id = roomId || state.activeRoomId;
  const room = id ? state.rooms[id] : undefined;
  return room?.type === 'battle' ? room : undefined;
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  username: 'Guest',
  userGroup: '',
  named: false,
  challstr: '',
  connection: 'offline',
  loginPending: false,
  needsPassword: false,
  server: loadStoredServer(),
  protocol,

  formats: defaultFormats,
  selectedFormat: 'gen9ou',
  searchState: 'idle',
  searchFormats: [],
  roomList: { rooms: [] },
  chatRoomList: { rooms: [], sectionTitles: [] },
  challenges: { from: {}, to: null },
  notifications: 0,

  rooms: demoRooms(),
  activeRoomId: undefined,

  activeTeam: bootstrappedTeams[0]?.packed || sampleTeam,
  teams: bootstrappedTeams,
  activeTeamId: bootstrappedTeams[0]?.id,

  hardcoreMode: false,
  protocolLogEnabled: import.meta.env.DEV,
  rawProtocolLog: [],

  connect: () => get().protocol.connect(),
  disconnect: () => get().protocol.disconnect(),
  reconnect: () => get().protocol.reconnect(),
  setServer: input => {
    const server = parseServerInput(input, get().server);
    if (!server) {
      set({ lastError: 'That does not look like a server address.' });
      return false;
    }
    saveStoredServer(server);
    // Rooms belong to the old server; drop them rather than show stale
    // sessions against a server that has never heard of them.
    set({
      server,
      rooms: {},
      roomList: { rooms: [] },
      chatRoomList: { rooms: [], sectionTitles: [] },
      challenges: { from: {}, to: null },
      activeRoomId: undefined,
      named: false,
      challstr: '',
      lastError: undefined,
    });
    get().protocol.setServer(server);
    return true;
  },
  resetServer: () => {
    const server = getDefaultServerConfig();
    saveStoredServer(null);
    set({ server, named: false, challstr: '', lastError: undefined });
    get().protocol.setServer(server);
  },

  chooseName: async name => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const userid = toId(trimmed);
    if (!userid) {
      set({ lastError: 'Usernames must contain at least one letter or number.' });
      return;
    }
    const { challstr, connection } = get();
    if (connection !== 'connected') {
      set({ lastError: 'Connect to the server before choosing a name.' });
      return;
    }
    if (!challstr) {
      set({ lastError: 'Still handshaking with the server. Try again in a moment.' });
      return;
    }

    set({ loginPending: true, lastError: undefined, needsPassword: false });
    scheduleLoginTimeout();
    try {
      applyAssertion(trimmed, await getAssertion(userid, challstr));
    } catch (error) {
      clearLoginTimeout();
      set({
        loginPending: false,
        lastError: error instanceof Error ? error.message : 'Could not reach the login server.',
      });
    }
  },
  login: async ({ name, password }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!password) return get().chooseName(trimmed);
    const { challstr, connection } = get();
    if (connection !== 'connected') {
      set({ lastError: 'Connect to the server before logging in.' });
      return;
    }
    if (!challstr) {
      set({ lastError: 'Still handshaking with the server. Try again in a moment.' });
      return;
    }

    set({ loginPending: true, lastError: undefined, needsPassword: false });
    scheduleLoginTimeout();
    try {
      applyAssertion(trimmed, await loginWithPassword(trimmed, password, challstr));
    } catch (error) {
      clearLoginTimeout();
      set({
        loginPending: false,
        lastError: error instanceof Error ? error.message : 'Login failed.',
      });
    }
  },
  logout: async () => {
    const { username, protocol: client } = get();
    client.send('/logout');
    set({ named: false, username: 'Guest', needsPassword: false, lastError: undefined });
    await logout(toId(username));
  },

  joinRoom: roomId => {
    const id = toId(roomId) ? roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
    if (!id) return;
    set({ activeRoomId: id });
    get().protocol.send(`/join ${id}`);
  },
  leaveRoom: roomId => {
    const id = roomId.trim().toLowerCase();
    get().protocol.send('/leave', id);
    set(state => ({
      activeRoomId: state.activeRoomId === id ? undefined : state.activeRoomId,
      rooms: patchRoom(state.rooms, id, { connected: false }),
    }));
  },
  focusRoom: activeRoomId => set(state => ({
    activeRoomId,
    rooms: activeRoomId && state.rooms[activeRoomId] ?
      patchRoom(state.rooms, activeRoomId, { unread: 0 }) :
      state.rooms,
  })),
  clearNotifications: () => set({ notifications: 0 }),
  refreshRoomList: format => {
    const suffix = format ? ` ${toId(format)},,` : '';
    get().protocol.send(`/cmd roomlist${suffix}`);
  },
  refreshChatRooms: () => {
    // `/cmd rooms` is the chat directory; `/cmd roomlist` is battles only.
    get().protocol.send('/cmd rooms');
  },
  sendRoomMessage: (roomId, message) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const state = get();
    const room = state.rooms[roomId];
    if (room?.type === 'pm') {
      state.protocol.send(`/pm ${room.partner}, ${trimmed}`);
      set(current => ({
        rooms: upsert(current.rooms, appendChat(room, {
          kind: 'pm',
          user: current.username,
          message: trimmed,
          timestamp: Date.now(),
        }, true) as Room),
      }));
      return;
    }
    state.protocol.send(trimmed, roomId.trim().toLowerCase());
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
    set({ searchState: 'searching', searchFormats: [selectedFormat], lastError: undefined });
  },
  cancelSearch: () => {
    clearCancelSearchTimeout();
    get().protocol.send('/cancelsearch');
    cancelSearchTimeout = window.setTimeout(() => {
      const state = useArenaStore.getState();
      if (state.searchState === 'searching') {
        useArenaStore.setState({
          searchState: 'idle',
          searchFormats: [],
          lastError: 'Search cancel was sent, but the server did not confirm it.',
        });
      }
    }, 4_000);
  },

  sendChallenge: (user, format) => {
    const { protocol: client, selectedFormat, formats, activeTeam, named, connection } = get();
    const formatId = format || selectedFormat;
    const entry = formats.find(item => item.id === formatId);
    if (connection !== 'connected' || !named) {
      set({ lastError: 'Connect and choose a name before challenging.' });
      return;
    }
    if (entry?.team !== false) {
      const validation = get().validateTeamForFormat(get().activeTeamId, formatId);
      if (!validation.ok) {
        set({ lastError: validation.errors.join(' ') || 'Select a valid team for this format first.' });
        return;
      }
      client.send(`/utm ${exportPackedTeam(activeTeam)}`);
    }
    client.send(`/challenge ${toId(user)}, ${formatId}`);
    set({ lastError: undefined });
  },
  acceptChallenge: user => {
    const { challenges, formats, activeTeam } = get();
    const formatId = challenges.from[user] || challenges.from[toId(user)];
    const entry = formats.find(item => item.id === toId(formatId || ''));
    if (entry?.team !== false && formatId) {
      const validation = get().validateTeamForFormat(get().activeTeamId, toId(formatId));
      if (!validation.ok) {
        set({ lastError: `That challenge needs a valid team: ${validation.errors.join(' ')}` });
        return;
      }
      get().protocol.send(`/utm ${exportPackedTeam(activeTeam)}`);
    }
    get().protocol.send(`/accept ${toId(user)}`);
  },
  rejectChallenge: user => {
    get().protocol.send(`/reject ${toId(user)}`);
    set(state => {
      const from = { ...state.challenges.from };
      delete from[user];
      delete from[toId(user)];
      return { challenges: { ...state.challenges, from } };
    });
  },
  cancelChallenge: () => {
    get().protocol.send('/cancelchallenge');
    set(state => ({ challenges: { ...state.challenges, to: null } }));
  },

  submitBattleChoice: (choice, roomId) => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    const { battle, choiceSession: session } = room;

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

    if (!session) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, target => ({
          ...target,
          choiceError: 'No active battle request.',
        })),
      }));
      return;
    }

    const result = addBattleChoice(session, choiceState);
    if (!result.ok) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, target => ({
          ...target,
          choiceSession: result.session,
          choiceDraft: result.draft,
          choiceError: result.error,
        })),
      }));
      return;
    }

    if (result.command) state.protocol.send(result.command, room.id);
    const logLine = result.message || buildBattleCommand(choice, battle.rqid);
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, target => appendLog({
        ...target,
        battle: { ...target.battle, waiting: result.complete },
        choicePending: result.complete,
        choiceSession: result.session,
        choiceDraft: result.draft,
        choiceError: undefined,
      }, logLine) as BattleRoom),
    }));
  },
  submitBattleTarget: (target, roomId) => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    const pending = room.choiceSession?.draft.pendingMove;
    if (!room.choiceSession || !pending) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, item => ({
          ...item,
          choiceError: 'No move is waiting for a target.',
        })),
      }));
      return;
    }
    const result = addBattleChoice(room.choiceSession, { ...pending, target });
    if (result.command) state.protocol.send(result.command, room.id);
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => appendLog({
        ...item,
        battle: { ...item.battle, waiting: result.complete },
        choicePending: result.complete,
        choiceSession: result.session,
        choiceDraft: result.draft,
        choiceError: result.error,
      }, result.complete ? 'Battle choice sent.' : result.message || 'Target selected.') as BattleRoom),
    }));
  },
  getBattleDecision: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) {
      return battleDecisionState(roomId || '', {
        ...demoBattle,
        id: roomId || 'pending',
        mode: 'spectator',
      });
    }
    return battleDecisionState(room.id, room.battle, room.choiceSession, room.choiceError);
  },
  resetBattleChoiceSession: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => ({
        ...item,
        choiceSession: item.choiceSession ? createBattleChoiceSession(item.choiceSession.request) : undefined,
        choiceDraft: { choices: [] },
        choiceError: undefined,
      })),
    }));
  },
  undoBattleChoice: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    if (room.battle.noCancel) {
      state.recordBattleEvent('This request cannot be cancelled.', room.id);
      return;
    }
    state.protocol.send('/undo', room.id);
    state.recordBattleEvent('Choice cancellation sent.', room.id);
  },
  toggleBattleTimer: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    const timerOn = !room.battle.timerOn;
    state.protocol.send(`/timer ${timerOn ? 'on' : 'off'}`, room.id);
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => ({
        ...item,
        timer: { ...item.timer, on: timerOn },
        battle: { ...item.battle, timerOn },
      })),
    }));
  },
  forfeitBattle: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    state.protocol.send('/forfeit', room.id);
    state.recordBattleEvent('Forfeit command sent.', room.id);
  },
  recordBattleEvent: (event, roomId) => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => appendLog(item, event) as BattleRoom),
    }));
  },
  sendBattleChat: (message, roomId) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    state.protocol.send(trimmed, room.id);
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => appendChat(item, {
        user: current.username,
        message: trimmed,
        timestamp: Date.now(),
      }, true) as BattleRoom),
    }));
  },
  saveReplay: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    state.protocol.send('/savereplay', room.id);
  },

  toggleHardcore: hardcoreMode => set({ hardcoreMode }),
  toggleProtocolLog: protocolLogEnabled => set({ protocolLogEnabled }),

  handleFrame: frame => {
    set(state => ({
      rawProtocolLog: state.protocolLogEnabled ?
        [`<< ${sanitizeProtocolLog(frame.raw)}`, ...state.rawProtocolLog].slice(0, 240) :
        state.rawProtocolLog,
    }));
    routeFrame(frame, useArenaStore);
  },

  onLoginSettled: () => clearLoginTimeout(),
  onSearchSettled: () => clearCancelSearchTimeout(),
  onReplaySaved: data => set({ pendingReplay: data }),
}));

// ── Protocol wiring ─────────────────────────────────────────────────────────

protocol.subscribe(event => {
  if (event.type === 'state') {
    useArenaStore.setState(state => ({
      connection: event.state,
      connectionReason: event.reason,
      loginPending: event.state === 'offline' || event.state === 'error' ? false : state.loginPending,
      lastError: state.loginPending && (event.state === 'offline' || event.state === 'error') ?
        'Connection closed before the name was confirmed.' :
        state.lastError,
    }));
    if (event.state === 'connected') {
      const state = useArenaStore.getState();
      Object.values(state.rooms)
        .filter(room => room.connected && room.type !== 'pm' && room.id !== 'lobby' && room.id !== demoBattle.id)
        .forEach(room => state.protocol.send(`/join ${room.id}`));
    }
  } else if (event.type === 'frame') {
    useArenaStore.getState().handleFrame(event.frame);
  } else if (event.type === 'send') {
    useArenaStore.setState(state => ({
      rawProtocolLog: state.protocolLogEnabled ?
        [`>> ${sanitizeProtocolLog(event.message)}`, ...state.rawProtocolLog].slice(0, 240) :
        state.rawProtocolLog,
    }));
  } else if (event.type === 'error') {
    useArenaStore.setState({ lastError: event.error.message, connection: 'error' });
  }
});

// Battles that opened before the engine chunk resolved buffered their raw
// lines. Replay them through fresh engine instances the moment it is ready.
onEngineReady(() => {
  const state = useArenaStore.getState();
  const pending = Object.values(state.rooms)
    .filter((room): room is BattleRoom => room.type === 'battle' && !room.engine && room.id !== demoBattle.id);
  if (!pending.length) return;
  useArenaStore.setState(current => {
    let rooms = current.rooms;
    for (const room of pending) {
      rooms = updateBattleRoom(rooms, room.id, item => {
        const engine = createEngineBattle(toId(current.username));
        if (!engine) return item;
        for (const raw of item.rawLog) feedLine(engine, raw);
        return {
          ...item,
          engine,
          battle: projectEngineBattle(engine, {
            roomId: item.id,
            perspective: item.perspective,
            result: item.result,
            lastRequest: item.lastRequest,
            waiting: item.choicePending || !!item.lastRequest?.wait,
            format: item.battle.format,
          }),
        };
      });
    }
    return { rooms };
  });
});

// ── Selectors shared by components ──────────────────────────────────────────

export const selectBattleRooms = (state: ArenaState): BattleRoom[] =>
  Object.values(state.rooms).filter((room): room is BattleRoom => room.type === 'battle');

export const selectBattle = (state: ArenaState, roomId: string): ArenaBattle | undefined => {
  const room = state.rooms[roomId];
  return room?.type === 'battle' ? room.battle : undefined;
};
