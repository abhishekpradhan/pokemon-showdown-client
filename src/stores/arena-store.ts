import { setRoomError } from '../rooms/errors';
import { create } from 'zustand';
import type { ChallengeDetails } from '../compat/battle-invitations';
import {
  addBattleChoice,
  battleDecisionState,
  battleSupport,
  buildBattleCommand,
  createBattleChoiceSession,
  demoBattle,
  type BattleSideID,
  type BattleChoice,
  type BattleChoiceState,
  type BattleDecisionState,
  type PokemonSet,
} from '../compat/battle-adapter';
import { getAssertion, type AssertionOutcome } from '../compat/login-server';
import {
  beginAuthentication,
  cancelAuthentication,
  expectAuthenticationIdentity,
} from '../compat/auth-session';
import { sanitizeProtocolLog } from '../compat/diagnostics';
import { replayUploadUrl } from '../compat/replay-upload';
import { useWorkspaceStore } from './workspace-store';
import { avatarName, isPublicAvatar } from '../preferences/avatars';
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
import { toId, type ChatRoomList, type RoomList } from '../compat/protocol-parsers';
import {
  exportPackedTeam,
  importPackedTeam,
  importTeams,
  loadStoredTeams,
  hasStoredTeamLibrary,
  importTeamLibrary,
  packTeam,
  createTeamId,
  saveTeamDraft,
  type TeamDraft,
  type TeamSet,
  saveStoredTeams,
  validateStoredTeam,
  validateTeamSets,
  type PackedTeam,
  type StoredTeam,
  type TeamValidationResult,
} from '../compat/team-store';
import { createEngineBattle, feedLine, onEngineReady, projectEngineBattle } from '../battle/engine';
import { battleEventFromLine, routeFrame } from '../protocol/router';
import {
  assertionFromToken,
  clearOAuthToken,
  currentOAuthToken,
  OAUTH_STORAGE_KEY,
  oauthConfigured,
  requestOAuthGrant,
  saveOAuthToken,
  storedOAuthToken,
} from '../compat/ps-oauth';
import { appendLog, newBattleRoom, newPmRoom, patchRoom, updateBattleRoom, upsert } from '../rooms/registry';
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
  details?: Record<string, ChallengeDetails>;
  to: { to: string; format: string } | null;
};

export type UserCardDetails = {
  userid: string;
  name: string;
  group: string;
  avatar?: string;
  status?: string;
  rooms: string[];
  online?: boolean;
};

export type ArenaState = {
  // ── Session ──
  username: string;
  /** Global group symbol from `|updateuser|` (e.g. `+`, `%`, `@`). */
  userGroup: string;
  avatar?: string;
  serverLanguage?: string;
  named: boolean;
  challstr: string;
  connection: ConnectionState;
  loginPending: boolean;
  loginStage?: 'authorization' | 'confirmation';
  lastError?: string;
  sessionNotice?: string;
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

  // ── Rooms (the registry: chat, PMs and battles in one map) ──
  rooms: Record<string, Room>;
  activeRoomId?: string;
  roomErrors: Record<string, string>;

  // ── Teams ──
  activeTeam: PackedTeam;
  teams: StoredTeam[];
  activeTeamId?: string;
  teamNotice?: string;
  teamValidation?: {
    state: 'validating' | 'valid' | 'invalid';
    format: string;
    message?: string;
    requestedAt: number;
  };
  saveTeamDraftToLibrary: (draft: TeamDraft) => StoredTeam | undefined;
  replaceTeamLibrary: (teams: StoredTeam[]) => boolean;
  reloadTeamLibrary: () => void;
  validateTeamOnServer: (sets: TeamSet[], format: string) => void;

  // ── Preferences / diagnostics ──
  hardcoreMode: boolean;
  protocolLogEnabled: boolean;
  rawProtocolLog: string[];
  /** Replay publish flow per battle: /savereplay → server payload → upload proxy. */
  replayStatuses: Record<
    string,
    {
      roomId: string;
      state: 'saving' | 'uploaded' | 'failed';
      url?: string;
      error?: string;
      requestedAt: number;
    }
  >;
  finishReplay: (roomId: string, result: { url?: string; error?: string }) => void;

  // ── Actions ──
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  setServer: (input: string) => boolean;
  resetServer: () => void;
  chooseName: (name: string) => Promise<void>;
  /** `|queryresponse|userdetails|` cache, keyed by userid. */
  userCards: Record<string, UserCardDetails>;
  requestUserDetails: (name: string) => void;
  applyAvatarPreference: () => boolean;
  /** Opens (creating if needed) the PM room with `name`; returns its room id. */
  openPmWith: (name: string) => string;
  /** OAuth2 sign-in: the password is only ever typed on play.pokemonshowdown.com. */
  loginWithOAuth: () => Promise<void>;
  cancelLogin: () => void;
  resumeSession: (challstr: string) => Promise<void>;
  oauthAvailable: boolean;
  oauthLinked: boolean;
  logout: () => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => boolean;
  focusRoom: (roomId?: string) => void;
  refreshRoomList: (format?: string) => void;
  refreshChatRooms: () => void;
  sendRoomMessage: (roomId: string, message: string) => boolean;
  setSelectedFormat: (format: string) => void;
  importTeamText: (text: string, name?: string, format?: string) => void;
  selectTeam: (teamId: string) => void;
  deleteTeam: (teamId: string) => void;
  renameTeam: (teamId: string, name: string) => void;
  duplicateTeam: (teamId: string) => void;
  updateTeamFormat: (teamId: string, format: string) => void;
  replaceTeamFromText: (teamId: string, text: string) => void;
  validateTeamForFormat: (teamId?: string, formatId?: string) => TeamValidationResult;
  startSearch: () => void;
  cancelSearch: () => void;
  sendChallenge: (user: string, format?: string) => void;
  acceptChallenge: (user: string) => void;
  rejectChallenge: (user: string) => void;
  cancelChallenge: () => void;
  inviteBattlePlayer: (roomId: string, slot: BattleSideID, user: string) => boolean;
  revokeBattleInvitation: (roomId: string, slot: BattleSideID) => boolean;
  submitBattleChoice: (choice: BattleChoice | PokemonSet | BattleChoiceState, roomId?: string) => void;
  submitBattleTarget: (target: number, roomId?: string) => void;
  getBattleDecision: (roomId?: string) => BattleDecisionState;
  resetBattleChoiceSession: (roomId?: string) => void;
  undoBattleChoice: (roomId?: string) => void;
  toggleBattleTimer: (roomId?: string) => void;
  forfeitBattle: (roomId?: string) => void;
  recordBattleEvent: (event: string, roomId?: string) => void;
  sendBattleChat: (message: string, roomId?: string) => boolean;
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

const sampleTeam = importPackedTeam(
  `Iron Valiant||boosterenergy|quarkdrive|moonblast,closecombat,thunderbolt,encore|Jolly|,,,252,4,252|||||]Dragapult||choicespecs|infiltrator|shadowball,dracometeor,uturn,flamethrower|Timid|,,,252,4,252|||||`,
);
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
  return hasStoredTeamLibrary() ? stored : [sampleStoredTeam];
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
      cancelAuthentication();
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
 * Only the requested named identity in `|updateuser|` confirms the handshake,
 * so the confirmation timeout is armed here, when `/trn` actually goes out —
 * never while the login server is still being waited on.
 */
const applyAssertion = (name: string, outcome: AssertionOutcome) => {
  if (outcome.kind === 'assertion') {
    scheduleLoginTimeout();
    expectAuthenticationIdentity(name);
    useArenaStore.getState().protocol.send(`/trn ${name},0,${outcome.assertion}`);
    return;
  }
  clearLoginTimeout();
  cancelAuthentication();
  // Registered names never get a password prompt here: sign-in for them is
  // OAuth on play.pokemonshowdown.com, which is what both messages point to.
  if (outcome.kind === 'needs-password') {
    useArenaStore.setState({
      loginPending: false,
      lastError: `${name} is registered. Use “Sign in with Pokémon Showdown” to authorize your account.`,
    });
    return;
  }
  if (outcome.kind === 'needs-google') {
    useArenaStore.setState({
      loginPending: false,
      lastError: `${name} uses Google sign-in. Use “Sign in with Pokémon Showdown” and sign in there.`,
    });
    return;
  }
  useArenaStore.setState({ loginPending: false, lastError: outcome.message });
};

/** Resolves an optional room id to the battle room it names, if any. */
const battleRoomFor = (state: ArenaState, roomId?: string): BattleRoom | undefined => {
  const id = roomId || state.activeRoomId;
  const room = id ? state.rooms[id] : undefined;
  return room?.type === 'battle' ? room : undefined;
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  username: 'Guest',
  replayStatuses: {},
  userGroup: '',
  named: false,
  challstr: '',
  connection: 'offline',
  loginPending: false,
  userCards: {},
  oauthAvailable: oauthConfigured(),
  oauthLinked: !!storedOAuthToken(),
  server: loadStoredServer(),
  protocol,

  formats: defaultFormats,
  selectedFormat: 'gen9ou',
  searchState: 'idle',
  searchFormats: [],
  roomList: { rooms: [] },
  chatRoomList: { rooms: [], sectionTitles: [] },
  challenges: { from: {}, to: null },

  rooms: demoRooms(),
  roomErrors: {},
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
  applyAvatarPreference: () => {
    const { named, username, connection, protocol } = get();
    const avatar = useWorkspaceStore.getState().preferredAvatar;
    if (!named || connection !== 'connected' || !isPublicAvatar(avatar)) return false;
    if (protocol.send(`/avatar ${avatar}`) === false) return false;
    // /avatar replies with chat HTML, not updateuser. /query shares its queue;
    // /cmd userdetails bypasses throttling and can read before /avatar applies.
    return protocol.send(`/query userdetails ${toId(username)}`) !== false;
  },
  setServer: input => {
    const server = parseServerInput(input, get().server);
    if (!server) {
      set({ lastError: 'That does not look like a server address.' });
      return false;
    }
    saveStoredServer(server);
    cancelAuthentication();
    clearLoginTimeout();
    // Rooms belong to the old server; drop them rather than show stale
    // sessions against a server that has never heard of them.
    set({
      server,
      rooms: {},
      roomErrors: {},
      userCards: {},
      roomList: { rooms: [] },
      chatRoomList: { rooms: [], sectionTitles: [] },
      challenges: { from: {}, to: null },
      activeRoomId: undefined,
      named: false,
      username: 'Guest',
      loginPending: false,
      searchState: 'idle',
      searchFormats: [],
      replayStatuses: {},
      challstr: '',
      lastError: undefined,
    });
    get().protocol.setServer(server);
    return true;
  },
  resetServer: () => {
    const server = getDefaultServerConfig();
    get().setServer(`${server.secure ? 'wss' : 'ws'}://${server.host}:${server.port}${server.prefix}`);
    saveStoredServer(null);
  },

  cancelLogin: () => {
    cancelAuthentication();
    clearLoginTimeout();
    set({ loginPending: false });
  },
  resumeSession: async challstr => {
    const attempt = beginAuthentication();
    const current = () =>
      attempt.current() && get().challstr === challstr && get().connection === 'connected';
    try {
      const stored = oauthConfigured() ? await currentOAuthToken(attempt.signal) : null;
      if (!current()) return;
      if (stored) {
        const result = await assertionFromToken(challstr, stored.token, attempt.signal);
        if (!current()) return;
        if (!result) {
          if (storedOAuthToken()?.token === stored.token) clearOAuthToken();
          set({ oauthLinked: false });
          return;
        }
        const name = result.user || stored.user;
        if (!name) return;
        set({ loginPending: true, loginStage: 'confirmation', oauthLinked: true });
        scheduleLoginTimeout();
        expectAuthenticationIdentity(name);
        get().protocol.send(`/trn ${name},0,${result.assertion}`);
      } else {
        let name = '';
        try {
          name = sessionStorage.getItem('arena-guest-name') || '';
        } catch {
          /* optional */
        }
        if (!name) return;
        const outcome = await getAssertion(toId(name), challstr, attempt.signal);
        if (!current()) return;
        set({ loginPending: true, loginStage: 'confirmation' });
        applyAssertion(name, outcome);
      }
    } catch (error) {
      if (current())
        set({
          loginPending: false,
          sessionNotice:
            error instanceof Error ? error.message : 'Sign-in could not be restored. Try signing in again.',
        });
    }
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

    set({ loginPending: true, loginStage: 'confirmation', lastError: undefined });
    const attempt = beginAuthentication();
    // A previous attempt's confirmation timer must not fire into this one. The
    // new timer is armed by applyAssertion once /trn is sent; the login-server
    // round trip itself is bounded inside getAssertion.
    clearLoginTimeout();
    try {
      const outcome = await getAssertion(userid, challstr, attempt.signal);
      if (!attempt.current() || get().challstr !== challstr) return;
      if (outcome.kind === 'assertion') {
        try {
          sessionStorage.setItem('arena-guest-name', trimmed);
        } catch {
          /* optional */
        }
      }
      applyAssertion(trimmed, outcome);
    } catch (error) {
      if (!attempt.current()) return;
      set({
        loginPending: false,
        lastError: error instanceof Error ? error.message : 'Could not reach the login server.',
      });
    }
  },
  loginWithOAuth: async () => {
    const { challstr, connection } = get();
    if (connection !== 'connected') {
      set({ lastError: 'Connect to the server before signing in.' });
      return;
    }
    if (!challstr) {
      set({ lastError: 'Still handshaking with the server. Try again in a moment.' });
      return;
    }
    set({ loginPending: true, loginStage: 'authorization', lastError: undefined });
    const attempt = beginAuthentication();
    clearLoginTimeout();
    try {
      const grant = await requestOAuthGrant(challstr, attempt.signal);
      if (!attempt.current() || get().challstr !== challstr) return;
      const saved = saveOAuthToken(grant.token, grant.user);
      try {
        sessionStorage.removeItem('arena-guest-name');
      } catch {
        /* optional */
      }
      set({
        loginPending: true,
        oauthLinked: true,
        loginStage: 'confirmation',
        sessionNotice: saved
          ? undefined
          : 'Signed in for this session. Browser storage is blocked, so sign-in cannot be remembered.',
      });
      scheduleLoginTimeout();
      const name = grant.user || get().username;
      expectAuthenticationIdentity(name);
      get().protocol.send(`/trn ${name},0,${grant.assertion}`);
    } catch (error) {
      if (!attempt.current()) return;
      clearLoginTimeout();
      set({
        loginPending: false,
        lastError: error instanceof Error ? error.message : 'Sign-in failed.',
      });
    }
  },

  logout: async () => {
    get().cancelLogin();
    const { protocol: client } = get();
    client.send('/logout');
    clearOAuthToken();
    try {
      sessionStorage.removeItem('arena-guest-name');
    } catch {
      /* optional */
    }
    set({ named: false, username: 'Guest', oauthLinked: false, lastError: undefined });
  },

  joinRoom: roomId => {
    const id = toId(roomId)
      ? roomId
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '')
      : '';
    if (!id) return;
    if (id.startsWith('pm-')) {
      get().openPmWith(id.slice(3));
      return;
    }
    if (id.startsWith('battle-') && !battleSupport(id.split('-')[1]).supported) {
      set(state => ({
        roomErrors: setRoomError(
          state.roomErrors,
          id,
          battleSupport(id.split('-')[1]).reason ||
            'Unsupported battle format. Open this battle in the official client.',
        ),
      }));
      return;
    }
    if (get().connection !== 'connected') {
      set(state => ({ roomErrors: setRoomError(state.roomErrors, id, 'Reconnect to join this room.') }));
      return;
    }
    set(state => ({ activeRoomId: id, roomErrors: setRoomError(state.roomErrors, id) }));
    get().protocol.send(`/join ${id}`);
  },
  leaveRoom: roomId => {
    const id = roomId.trim().toLowerCase();
    const room = get().rooms[id];
    if (!room) return false;
    if (room.type === 'battle' && room.battle.mode === 'player' && !room.battle.ended) {
      if (!window.confirm('Forfeit this battle and leave? This counts as a loss.')) return false;
      get().forfeitBattle(id);
    }
    if (room.type !== 'pm') get().protocol.send('/leave', id);
    set(state => ({
      activeRoomId: state.activeRoomId === id ? undefined : state.activeRoomId,
      roomErrors: setRoomError(state.roomErrors, id),
      rooms: upsert(
        state.rooms,
        room.type === 'battle'
          ? {
              ...newBattleRoom(id),
              title: room.title,
              connected: false,
            }
          : { ...room, connected: false },
      ),
    }));
    set(state => {
      const closed = Object.values(state.rooms).filter(item => !item.connected);
      if (closed.length <= 12) return state;
      const rooms = { ...state.rooms };
      let roomErrors = state.roomErrors;
      for (const item of closed.slice(0, -12)) {
        delete rooms[item.id];
        roomErrors = setRoomError(roomErrors, item.id);
      }
      return { rooms, roomErrors };
    });
    return true;
  },
  focusRoom: activeRoomId =>
    set(state => {
      if (document.hidden) activeRoomId = undefined;
      // No-op when nothing changes — components call this from effects, and a
      // fresh state object here would re-fire them forever.
      const room = activeRoomId ? state.rooms[activeRoomId] : undefined;
      if (state.activeRoomId === activeRoomId && (!room || room.unread === 0)) return state;
      return {
        activeRoomId,
        rooms: room && room.unread > 0 ? patchRoom(state.rooms, activeRoomId!, { unread: 0 }) : state.rooms,
      };
    }),
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
    if (!trimmed) return false;
    const ignore = trimmed.match(/^\/(unignore|ignore)\s+(.+)$/i);
    if (ignore) {
      const preferences = useWorkspaceStore.getState();
      const id = toId(ignore[2]);
      preferences.setPreference(
        'ignoredUsers',
        ignore[1].toLowerCase() === 'unignore'
          ? preferences.ignoredUsers.filter(user => user !== id)
          : [...new Set([...preferences.ignoredUsers, id])],
      );
      return true;
    }
    const state = get();
    if (state.connection !== 'connected' || (!state.named && !trimmed.startsWith('/'))) {
      set({ lastError: 'Not sent. Connect and choose a name before sending a message.' });
      return false;
    }
    const room = state.rooms[roomId];
    if (room?.type === 'pm') {
      return state.protocol.send(`/pm ${room.partner}, ${trimmed}`) !== false;
    }
    return state.protocol.send(trimmed, roomId.trim().toLowerCase()) !== false;
  },

  setSelectedFormat: selectedFormat => set({ selectedFormat }),
  replaceTeamLibrary: teams => {
    const result = saveStoredTeams(teams);
    if (!result.ok) {
      set({ teamNotice: undefined, lastError: result.error });
      return false;
    }
    const active = teams.find(team => team.id === get().activeTeamId) || teams[0];
    set({ teams, activeTeamId: active?.id, activeTeam: active?.packed || '', lastError: undefined });
    return true;
  },
  reloadTeamLibrary: () => {
    const teams = loadStoredTeams();
    const active = teams.find(team => team.id === get().activeTeamId) || teams[0];
    set({
      teams,
      activeTeamId: active?.id,
      activeTeam: active?.packed || '',
      teamNotice: 'Library reloaded. Open drafts are preserved.',
      lastError: undefined,
    });
  },
  saveTeamDraftToLibrary: draft => {
    const existing = get().teams.find(team => team.id === draft.teamId);
    if (existing && draft.baseUpdatedAt !== undefined && draft.baseUpdatedAt !== existing.updatedAt) {
      set({
        lastError:
          'The saved team changed since this draft was opened. Duplicate your draft to save a copy, or reload the saved version before replacing it.',
        teamNotice: undefined,
      });
      return;
    }
    const team: StoredTeam = {
      id: draft.teamId || createTeamId(),
      name: draft.name.trim() || 'Untitled team',
      format: draft.format,
      folder: draft.folder.trim(),
      sets: structuredClone(draft.sets),
      packed: packTeam(draft.sets),
      updatedAt: Date.now(),
    };
    const previous = get().teams;
    const teams = previous.some(entry => entry.id === team.id)
      ? previous.map(entry => (entry.id === team.id ? team : entry))
      : [team, ...previous];
    if (!get().replaceTeamLibrary(teams)) return;
    set({
      activeTeamId: team.id,
      activeTeam: team.packed,
      teamNotice: `${team.name} saved in this browser.`,
    });
    return team;
  },
  importTeamText: (text, name, format) => {
    try {
      const imported = importTeamLibrary(text, format || get().selectedFormat).map(team => ({
        ...team,
        name: name?.trim() || team.name,
      }));
      if (!imported.length) {
        set({ lastError: 'No teams were found in that import.', teamNotice: undefined });
        return;
      }
      if (!get().replaceTeamLibrary([...imported, ...get().teams])) return;
      set({
        activeTeamId: imported[0].id,
        activeTeam: imported[0].packed,
        teamNotice: `${imported.length} team(s) imported.`,
      });
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : 'Team import failed.',
        teamNotice: undefined,
      });
    }
  },
  selectTeam: teamId => {
    const team = get().teams.find(entry => entry.id === teamId);
    if (team) set({ activeTeamId: team.id, activeTeam: team.packed });
  },
  deleteTeam: teamId => {
    const deleted = get().teams.find(team => team.id === teamId);
    if (!deleted) return;
    const recovery = saveTeamDraft({
      key: `deleted-${createTeamId()}`,
      name: `${deleted.name} (deleted)`,
      format: deleted.format,
      folder: deleted.folder || '',
      sets: deleted.sets,
      updatedAt: Date.now(),
    });
    if (!recovery.ok) {
      set({ lastError: recovery.error });
      return;
    }
    if (get().replaceTeamLibrary(get().teams.filter(team => team.id !== teamId)))
      set({ teamNotice: `${deleted.name} moved to recoverable drafts.` });
  },
  renameTeam: (teamId, name) => {
    if (!name.trim()) {
      set({ lastError: 'Team name cannot be empty.' });
      return;
    }
    if (
      get().replaceTeamLibrary(
        get().teams.map(team =>
          team.id === teamId ? { ...team, name: name.trim(), updatedAt: Date.now() } : team,
        ),
      )
    )
      set({ teamNotice: 'Team renamed.' });
  },
  duplicateTeam: teamId => {
    const team = get().teams.find(entry => entry.id === teamId);
    if (team)
      get().saveTeamDraftToLibrary({
        key: '',
        name: `${team.name} copy`,
        format: team.format,
        folder: team.folder || '',
        sets: team.sets,
        updatedAt: Date.now(),
      });
  },
  updateTeamFormat: (teamId, format) => {
    if (
      get().replaceTeamLibrary(
        get().teams.map(team => (team.id === teamId ? { ...team, format, updatedAt: Date.now() } : team)),
      )
    )
      set({ teamNotice: 'Team format updated.' });
  },
  replaceTeamFromText: (teamId, text) => {
    const current = get().teams.find(team => team.id === teamId);
    if (!current) {
      get().importTeamText(text);
      return;
    }
    try {
      const replacement = importTeamLibrary(text, current.format)[0];
      if (!replacement) {
        set({ lastError: 'No team found in the import.' });
        return;
      }
      get().saveTeamDraftToLibrary({
        key: teamId,
        teamId,
        name: current.name,
        format: current.format,
        folder: current.folder || '',
        sets: replacement.sets,
        updatedAt: Date.now(),
      });
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : 'Team import failed.' });
    }
  },
  validateTeamOnServer: (sets, format) => {
    if (get().connection !== 'connected') {
      set({ lastError: 'Connect to validate this team with the server.' });
      return;
    }
    if (get().teamValidation?.state === 'validating') return;
    const requestedAt = Date.now();
    set({ teamValidation: { state: 'validating', format, requestedAt }, lastError: undefined });
    get().protocol.send(`/utm ${packTeam(sets)}`);
    get().protocol.send(`/vtm ${format}`);
    window.setTimeout(() => {
      const current = get().teamValidation;
      if (current?.state === 'validating' && current.requestedAt === requestedAt)
        set({
          teamValidation: {
            ...current,
            state: 'invalid',
            message: 'No validation response received. Reconnect and retry.',
          },
        });
    }, 15_000);
  },
  validateTeamForFormat: (teamId, formatId) => {
    const team = get().teams.find(entry => entry.id === (teamId || get().activeTeamId));
    const selectedFormat = get().formats.find(format => format.id === (formatId || get().selectedFormat));
    if (selectedFormat?.team === false) return { ok: true, errors: [], warnings: [] };
    return team ? validateTeamSets(team.sets, formatId || get().selectedFormat) : validateStoredTeam(team);
  },

  startSearch: () => {
    const {
      protocol: client,
      selectedFormat,
      activeTeam,
      activeTeamId,
      formats,
      connection,
      named,
      searchState,
    } = get();
    const format = formats.find(entry => entry.id === selectedFormat);
    const validation = get().validateTeamForFormat(activeTeamId, selectedFormat);
    const blockers = [
      connection !== 'connected' ? 'Connect to a PS-compatible server before searching.' : '',
      !named ? 'Choose a name before searching.' : '',
      searchState === 'searching' ? 'You are already searching.' : '',
      !format?.searchShow ? 'This format is not available for ladder search.' : '',
      battleSupport(selectedFormat).reason || '',
      format?.team !== false && !activeTeamId ? 'Select or import a team before searching this format.' : '',
      format?.team !== false && !validation.ok ? validation.errors.join(' ') : '',
    ].filter(Boolean);
    if (blockers.length) {
      set({ lastError: blockers.join(' ') });
      return;
    }
    if (format?.team !== false && activeTeam && client.send(`/utm ${exportPackedTeam(activeTeam)}`) === false)
      return;
    if (useWorkspaceStore.getState().privateBattles) client.send('/hidenext');
    if (client.send(`/search ${selectedFormat}`) === false) return;
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
    if (!toId(user) || toId(user) === toId(get().username)) {
      set({ lastError: 'Choose another player to challenge.' });
      return;
    }
    if (!battleSupport(formatId).supported || entry?.challengeShow === false || !entry) {
      set({ lastError: battleSupport(formatId).reason || 'This format is not available for challenges.' });
      return;
    }
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
      if (client.send(`/utm ${exportPackedTeam(activeTeam)}`) === false) return;
    }
    if (useWorkspaceStore.getState().privateBattles) client.send('/hidenext');
    if (client.send(`/challenge ${toId(user)}, ${formatId}`) === false) return;
    set(state => ({
      lastError: undefined,
      challenges: { ...state.challenges, to: { to: user, format: formatId } },
    }));
  },
  requestUserDetails: name => {
    const userid = toId(name);
    if (!userid) return;
    get().protocol.send(`/cmd userdetails ${userid}`);
  },
  openPmWith: name => {
    const partner = name.replace(/^[^A-Za-z0-9]/, '');
    const pmRoomId = `pm-${toId(partner) || 'system'}`;
    set(state => ({
      rooms: state.rooms[pmRoomId]
        ? patchRoom(state.rooms, pmRoomId, { connected: true })
        : upsert(state.rooms, newPmRoom(pmRoomId, partner) as Room),
    }));
    get().focusRoom(pmRoomId);
    return pmRoomId;
  },
  acceptChallenge: user => {
    const { challenges, formats, activeTeam } = get();
    const formatId = Object.entries(challenges.from).find(([name]) => toId(name) === toId(user))?.[1];
    const detail = challenges.details?.[toId(user)];
    if (get().connection !== 'connected' || !get().named || !formatId) {
      set({ lastError: 'Connect and choose a name before accepting an active challenge.' });
      return;
    }
    if (!battleSupport(formatId).supported) {
      set({ lastError: battleSupport(formatId).reason });
      return;
    }
    const teamFormat = detail?.teambuilderFormat ?? formatId;
    const entry = formats.find(item => item.id === toId(teamFormat));
    if (teamFormat && entry?.team !== false) {
      const validation = get().validateTeamForFormat(get().activeTeamId, toId(teamFormat));
      if (!validation.ok) {
        set({ lastError: `That challenge needs a valid team: ${validation.errors.join(' ')}` });
        return;
      }
      if (get().protocol.send(`/utm ${exportPackedTeam(activeTeam)}`) === false) {
        set({ lastError: 'The team was not sent. Reconnect before accepting this challenge.' });
        return;
      }
    }
    // Official /accept delegates to the server's stored /acceptbattle handler
    // for invitations. PM metadata intentionally does not transmit a command.
    if (get().protocol.send(`/accept ${toId(user)}`) === false) {
      set({ lastError: 'The challenge acceptance was not sent. Reconnect and retry.' });
      return;
    }
    set({ lastError: undefined });
  },
  rejectChallenge: user => {
    if (get().connection !== 'connected' || get().protocol.send(`/reject ${toId(user)}`) === false) {
      set({ lastError: 'The challenge rejection was not sent. Reconnect and retry.' });
      return;
    }
    set(state => {
      const from = { ...state.challenges.from };
      for (const name of Object.keys(from)) if (toId(name) === toId(user)) delete from[name];
      const details = { ...state.challenges.details };
      delete details[toId(user)];
      return {
        lastError: undefined,
        challenges: { ...state.challenges, from, ...(state.challenges.details ? { details } : {}) },
      };
    });
  },
  cancelChallenge: () => {
    if (get().connection !== 'connected' || get().protocol.send('/cancelchallenge') === false) {
      set({ lastError: 'The challenge cancellation was not sent. Reconnect and retry.' });
      return;
    }
    set(state => ({ lastError: undefined, challenges: { ...state.challenges, to: null } }));
  },
  inviteBattlePlayer: (roomId, slot, user) => {
    const state = get();
    const room = state.rooms[roomId];
    const seat = room?.type === 'battle' ? room.invitations?.find(entry => entry.slot === slot) : undefined;
    const userid = toId(user);
    if (!userid || userid === toId(state.username) || /[\r\n|,]/.test(user)) {
      set({ lastError: 'Choose another player to invite.' });
      return false;
    }
    if (room?.type !== 'battle' || !room.connected || room.result?.ended || !seat?.canInvite) {
      set({
        lastError: 'That battle seat is no longer available. Wait for the server to refresh the invitation.',
      });
      return false;
    }
    if (
      state.connection !== 'connected' ||
      !state.named ||
      state.protocol.send(`/invitebattle ${userid}, ${slot}`, roomId) === false
    ) {
      set({ lastError: 'The invitation was not sent. Connect and choose a name, then retry.' });
      return false;
    }
    set({ lastError: undefined });
    return true;
  },
  revokeBattleInvitation: (roomId, slot) => {
    const state = get();
    const room = state.rooms[roomId];
    const invited =
      room?.type === 'battle' ? room.invitations?.find(entry => entry.slot === slot)?.invited : undefined;
    if (
      room?.type !== 'battle' ||
      !room.connected ||
      !invited ||
      state.connection !== 'connected' ||
      !state.named ||
      state.protocol.send(`/uninvitebattle ${invited}`, roomId) === false
    ) {
      set({ lastError: 'The invitation could not be removed. Reconnect and check the current seat.' });
      return false;
    }
    set({ lastError: undefined });
    return true;
  },

  submitBattleChoice: (choice, roomId) => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    const { battle, choiceSession: session } = room;
    if (
      state.connection !== 'connected' ||
      !room.connected ||
      battle.ended ||
      battle.mode !== 'player' ||
      battle.supportReason ||
      battle.engineWarning
    ) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, target => ({
          ...target,
          choiceError: battle.supportReason || 'Reconnect to your active battle before choosing.',
        })),
      }));
      return;
    }

    const choiceState: BattleChoiceState =
      'kind' in choice
        ? choice
        : 'cmd' in choice
          ? {
              kind: 'move',
              slot: choice.slot,
              activeIndex: choice.activeIndex,
              tera: choice.cmd.includes('terastallize'),
              mega: choice.cmd.includes('mega'),
              ultra: choice.cmd.includes('ultra'),
              z: choice.cmd.includes('zmove'),
              max: choice.cmd.includes('dynamax') || choice.cmd.includes(' max'),
            }
          : battle.requestType === 'team'
            ? {
                kind: 'team',
                order: [choice.slot],
              }
            : {
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

    if (result.command && state.protocol.send(result.command, room.id) === false) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, target => ({
          ...target,
          choiceError: 'Your choice was not sent. Reconnect and try again.',
        })),
      }));
      return;
    }
    const logLine =
      result.message ||
      ('kind' in choice
        ? result.command
          ? 'Battle choice sent.'
          : 'Team selection updated.'
        : buildBattleCommand(choice, battle.rqid));
    set(current => ({
      rooms: updateBattleRoom(
        current.rooms,
        room.id,
        target =>
          appendLog(
            {
              ...target,
              battle: { ...target.battle, waiting: !!result.command, noCancel: result.session.noCancel },
              choicePending: !!result.command,
              choiceSession: result.session,
              choiceDraft: result.draft,
              choiceError: undefined,
            },
            logLine,
          ) as BattleRoom,
      ),
    }));
  },
  submitBattleTarget: (target, roomId) => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    if (
      state.connection !== 'connected' ||
      !room.connected ||
      room.battle.mode !== 'player' ||
      room.battle.ended ||
      room.battle.supportReason ||
      room.battle.engineWarning
    )
      return;
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
    if (result.command && state.protocol.send(result.command, room.id) === false) {
      set(current => ({
        rooms: updateBattleRoom(current.rooms, room.id, item => ({
          ...item,
          choiceError: 'Your choice was not sent. Reconnect and try again.',
        })),
      }));
      return;
    }
    set(current => ({
      rooms: updateBattleRoom(
        current.rooms,
        room.id,
        item =>
          appendLog(
            {
              ...item,
              battle: { ...item.battle, waiting: !!result.command, noCancel: result.session.noCancel },
              choicePending: !!result.command,
              choiceSession: result.session,
              choiceDraft: result.draft,
              choiceError: result.error,
            },
            result.complete ? 'Battle choice sent.' : result.message || 'Target selected.',
          ) as BattleRoom,
      ),
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
    if (
      room.choicePending ||
      room.choiceSession?.status === 'submitted' ||
      room.choiceSession?.status === 'cancelling'
    ) {
      state.undoBattleChoice(room.id);
      return;
    }
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
    if (
      !room.choicePending &&
      room.choiceSession?.status !== 'submitted' &&
      room.choiceSession?.status !== 'cancelling'
    ) {
      state.resetBattleChoiceSession(room.id);
      return;
    }
    if (room.battle.noCancel || room.choiceSession?.noCancel) {
      state.recordBattleEvent('This request cannot be cancelled.', room.id);
      return;
    }
    if (state.connection !== 'connected' || state.protocol.send('/undo', room.id) === false) return;
    set(current => ({
      rooms: updateBattleRoom(current.rooms, room.id, item => ({
        ...item,
        choiceSession: item.choiceSession ? { ...item.choiceSession, status: 'cancelling' } : undefined,
      })),
    }));
    state.recordBattleEvent('Choice cancellation sent.', room.id);
  },
  toggleBattleTimer: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room || state.connection !== 'connected' || room.battle.mode !== 'player' || room.battle.ended)
      return;
    const timerOn = !room.timer.on;
    state.protocol.send(`/timer ${timerOn ? 'on' : 'off'}`, room.id);
  },
  forfeitBattle: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room || state.connection !== 'connected' || room.battle.ended || room.battle.mode !== 'player')
      return;
    if (state.protocol.send('/forfeit', room.id) === false) return;
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
    if (!trimmed) return false;
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room || !room.connected || state.connection !== 'connected') return false;
    return state.protocol.send(trimmed, room.id) !== false;
  },
  saveReplay: roomId => {
    const state = get();
    const room = battleRoomFor(state, roomId);
    if (!room) return;
    if (state.connection !== 'connected' || !room.connected) {
      set({ lastError: 'Reconnect before saving this replay.' });
      return;
    }
    if (state.replayStatuses[room.id]?.state === 'saving') return;
    const requestedAt = Date.now();
    set(current => ({
      replayStatuses: {
        ...current.replayStatuses,
        [room.id]: { roomId: room.id, state: 'saving', requestedAt },
      },
    }));
    state.protocol.send('/savereplay', room.id);
    // Neither response path arriving within a sane window is a failure the
    // user can retry, not a spinner forever.
    window.setTimeout(() => {
      const current = useArenaStore.getState().replayStatuses[room.id];
      if (current?.requestedAt === requestedAt && current.state === 'saving')
        get().finishReplay(room.id, { error: 'The server did not confirm the save. Retry when connected.' });
    }, 30_000);
  },
  finishReplay: (roomId, result) =>
    set(state => {
      const current = state.replayStatuses[roomId];
      if (!current || current.state !== 'saving') return state;
      const status = {
        ...current,
        ...result,
        state: result.url ? ('uploaded' as const) : ('failed' as const),
      };
      return { replayStatuses: { ...state.replayStatuses, [roomId]: status } };
    }),

  toggleHardcore: hardcoreMode => set({ hardcoreMode }),
  toggleProtocolLog: protocolLogEnabled => set({ protocolLogEnabled }),

  handleFrame: frame => {
    set(state => ({
      rawProtocolLog: state.protocolLogEnabled
        ? [`<< ${sanitizeProtocolLog(frame.raw)}`, ...state.rawProtocolLog].slice(0, 240)
        : state.rawProtocolLog,
    }));
    routeFrame(frame, useArenaStore);
  },

  onLoginSettled: () => {
    clearLoginTimeout();
    const state = get();
    Object.values(state.rooms)
      .filter(
        room => room.connected && room.type !== 'pm' && room.id !== 'lobby' && room.id !== demoBattle.id,
      )
      .forEach(room => state.protocol.send(`/join ${room.id}`));
    if (state.named) {
      const preferences = useWorkspaceStore.getState();
      for (const id of preferences.autojoinRooms
        .filter(id => /^[a-z0-9-]+$/.test(id) && !id.startsWith('battle-'))
        .slice(0, 20))
        state.protocol.send(`/join ${id}`);
      if (preferences.preferredAvatar && preferences.preferredAvatar !== avatarName(state.avatar || ''))
        state.applyAvatarPreference();
      if (preferences.serverLanguage !== (state.serverLanguage || 'english'))
        state.protocol.send(`/language ${preferences.serverLanguage}`);
      if (preferences.blockPms) state.protocol.send('/blockpms');
      if (preferences.blockChallenges) state.protocol.send('/blockchallenges');
    }
  },
  onSearchSettled: () => clearCancelSearchTimeout(),
  onReplaySaved: data => {
    const { id, log, password } = data;
    if (!id || !log) return;
    const roomId = `battle-${id.replace(/^battle-/, '')}`;
    const pending = get().replayStatuses[roomId];
    if (!pending || pending.state !== 'saving') return;
    const serverId = get().server.id;
    const replayId = serverId !== 'showdown' ? `${toId(serverId.split(':')[0])}-${id}` : id;
    const current = () =>
      get().server.id === serverId && get().replayStatuses[roomId]?.requestedAt === pending.requestedAt;
    void (async () => {
      try {
        const body = new URLSearchParams({ id: replayId, log, serverid: toId(serverId.split(':')[0]) });
        if (password) body.set('password', password);
        const response = await fetch('/api/replay', {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(25_000),
        });
        const text = await response.text();
        if (!response.ok || /error|invalid/i.test(text.slice(0, 80))) {
          throw new Error(text.slice(0, 120) || `HTTP ${response.status}`);
        }
        const url = replayUploadUrl(text, `${replayId}${password ? `-${password}pw` : ''}`);
        if (!url) throw new Error('The replay service did not return a confirmed replay URL.');
        if (current()) get().finishReplay(roomId, { url });
      } catch (error) {
        if (current())
          get().finishReplay(roomId, { error: error instanceof Error ? error.message : 'Upload failed.' });
      }
    })();
  },
}));

// ── Protocol wiring ─────────────────────────────────────────────────────────

useWorkspaceStore.subscribe((preferences, previous) => {
  const state = useArenaStore.getState();
  if (!state.named || state.connection !== 'connected') return;
  if (preferences.preferredAvatar && preferences.preferredAvatar !== previous.preferredAvatar)
    state.applyAvatarPreference();
  if (preferences.serverLanguage !== previous.serverLanguage)
    state.protocol.send(`/language ${preferences.serverLanguage}`);
  if (preferences.blockPms !== previous.blockPms)
    state.protocol.send(preferences.blockPms ? '/blockpms' : '/unblockpms');
  if (preferences.blockChallenges !== previous.blockChallenges)
    state.protocol.send(preferences.blockChallenges ? '/blockchallenges' : '/unblockchallenges');
});

protocol.subscribe(event => {
  if (event.type === 'state') {
    if (event.state !== 'connected') {
      cancelAuthentication();
      clearLoginTimeout();
    }
    useArenaStore.setState(state => ({
      connection: event.state,
      loginPending: event.state !== 'connected' ? false : state.loginPending,
      ...(event.state !== 'connected' ? { named: false, challstr: '' } : {}),
      lastError:
        state.loginPending && (event.state === 'offline' || event.state === 'error')
          ? 'Connection closed before the name was confirmed.'
          : state.lastError,
    }));
  } else if (event.type === 'frame') {
    useArenaStore.getState().handleFrame(event.frame);
  } else if (event.type === 'send') {
    useArenaStore.setState(state => ({
      rawProtocolLog: state.protocolLogEnabled
        ? [`>> ${sanitizeProtocolLog(event.message)}`, ...state.rawProtocolLog].slice(0, 240)
        : state.rawProtocolLog,
    }));
  } else if (event.type === 'error') {
    useArenaStore.setState({ lastError: event.error.message, connection: protocol.state });
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== OAUTH_STORAGE_KEY) return;
    const token = storedOAuthToken();
    useArenaStore.setState({ oauthLinked: !!token });
    if (!token) {
      useArenaStore.getState().cancelLogin();
      if (useArenaStore.getState().named) {
        protocol.send('/logout');
        useArenaStore.setState({ named: false, username: 'Guest' });
      }
    }
  });
}

// Battles that opened before the engine chunk resolved buffered their raw
// lines. Replay them through fresh engine instances the moment it is ready.
onEngineReady(() => {
  const state = useArenaStore.getState();
  const pending = Object.values(state.rooms).filter(
    (room): room is BattleRoom =>
      room.type === 'battle' && room.connected && !room.engine && room.id !== demoBattle.id,
  );
  if (!pending.length) return;
  useArenaStore.setState(current => {
    let rooms = current.rooms;
    for (const room of pending) {
      rooms = updateBattleRoom(rooms, room.id, item => {
        const engine = createEngineBattle(toId(current.username));
        if (!engine) return item;
        // Replayed history still announces its most recent action — a battle
        // joined before the engine chunk resolved must not open on a silent
        // field.
        let lastEvent = item.lastEvent;
        for (const raw of item.rawLog) {
          feedLine(engine, raw);
          const parts = raw.split('|');
          if (parts.length > 1) {
            const event = battleEventFromLine(parts[1], parts.slice(2), item.perspective, lastEvent);
            if (event) lastEvent = event;
          }
        }
        return {
          ...item,
          lastEvent,
          engine,
          battle: {
            ...projectEngineBattle(engine, {
              roomId: item.id,
              perspective: item.perspective,
              result: item.result,
              lastRequest: item.lastRequest,
              waiting: item.choicePending || !!item.lastRequest?.wait,
              format: item.battle.format,
            }),
            timerOn: item.timer.on,
            logTruncated: item.battle.logTruncated,
            noCancel: item.choiceSession?.noCancel ?? item.battle.noCancel,
          },
        };
      });
    }
    return { rooms };
  });
});
