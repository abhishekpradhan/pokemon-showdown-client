import {
  buildMoveDeck,
  createBattleChoiceSession,
  requestFlags,
  type BattleRequest,
} from '../compat/battle-adapter';
import { createEngineBattle, feedLine, projectEngineBattle } from '../battle/engine';
import { describeBattleLine } from '../compat/battle-text';
import type { PsFrame, PsLine } from '../compat/protocol-client';
import {
  parseChatRoomList,
  parseFormats,
  parseQueryResponse,
  parseRoomList,
  parseSearchUpdate,
  toId,
} from '../compat/protocol-parsers';
import {
  appendChat,
  appendLog,
  newBattleRoom,
  newChatRoom,
  newPmRoom,
  patchRoom,
  updateBattleRoom,
  upsert,
} from '../rooms/registry';
import type { BattleRoom, ChatMessage, Room } from '../rooms/types';
import type { ArenaState } from '../stores/arena-store';

/**
 * The protocol router: every server frame enters here and is dispatched to
 * global handlers or to the room that owns it. This replaces a ~300-line
 * switch that lived inside store state updates.
 */

export type ArenaStoreApi = {
  getState: () => ArenaState;
  setState: (partial: Partial<ArenaState> | ((state: ArenaState) => Partial<ArenaState>)) => void;
};

/** Chat-ish lines that can appear in any room. */
const parseChatLine = (line: PsLine): ChatMessage | null => {
  switch (line.command) {
  case 'c':
  case 'chat': {
    const message = line.args.slice(1).join('|');
    if (message.startsWith('/me ')) return { kind: 'me', user: line.args[0] || '', message: message.slice(4) };
    if (message.startsWith('/announce ')) return { kind: 'announce', user: line.args[0] || '', message: message.slice(10) };
    return { user: line.args[0] || 'system', message };
  }
  case 'c:': {
    const message = line.args.slice(2).join('|');
    const base = { timestamp: (Number(line.args[0]) || 0) * 1000 || undefined, user: line.args[1] || 'system' };
    if (message.startsWith('/me ')) return { ...base, kind: 'me', message: message.slice(4) };
    if (message.startsWith('/announce ')) return { ...base, kind: 'announce', message: message.slice(10) };
    return { ...base, message };
  }
  case 'raw':
  case 'html':
    return { kind: 'html', user: '', message: line.args.join('|') };
  case 'uhtml':
    // args[0] is the uhtml name; the rest is markup.
    return { kind: 'html', user: '', message: line.args.slice(1).join('|') };
  case 'error':
    return { kind: 'error', user: 'error', message: line.args.join('|') };
  case '-message':
  case 'message':
    return { kind: 'system', user: 'system', message: line.args.join('|') };
  default:
    return null;
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

/** `|inactive|Time left: 150 sec this turn | 300 sec total` and friends. */
const parseTimerLine = (text: string) => {
  const seconds = [...text.matchAll(/(\d+) sec/g)].map(match => Number(match[1]));
  return {
    secondsLeft: seconds[0],
    totalLeft: seconds[1] ?? seconds[0],
  };
};

// ── Global (roomless) commands ──────────────────────────────────────────────

const handleGlobal = (line: PsLine, store: ArenaStoreApi): boolean => {
  const { setState, getState } = store;

  switch (line.command) {
  case 'challstr':
    setState({ challstr: line.args.join('|') });
    return true;

  case 'updateuser': {
    const rawName = line.args[0] || '';
    const hasGroupPrefix = /^[^A-Za-z0-9]/.test(rawName);
    setState({
      username: (hasGroupPrefix ? rawName.slice(1) : rawName) || 'Guest',
      userGroup: hasGroupPrefix ? rawName.charAt(0).trim() : '',
      named: line.args[1] === '1',
      avatar: line.args[2] || undefined,
      connection: 'connected',
      loginPending: false,
      needsPassword: false,
      lastError: undefined,
    });
    getState().onLoginSettled();
    return true;
  }

  case 'nametaken':
    setState({
      loginPending: false,
      lastError: line.args.slice(1).join('|') || `${line.args[0] || 'That name'} is not available.`,
    });
    getState().onLoginSettled();
    return true;

  case 'formats':
    setState(state => {
      const parsed = parseFormats(line.args);
      const formats = parsed.length ? parsed : state.formats;
      const selectedFormat = formats.some(format => format.id === state.selectedFormat) ?
        state.selectedFormat :
        formats[0]?.id || state.selectedFormat;
      return { formats, selectedFormat };
    });
    return true;

  case 'updatesearch': {
    const update = parseSearchUpdate(line.args.join('|'));
    if (!update) return true;
    getState().onSearchSettled();
    setState({
      searchFormats: update.searching,
      searchState: update.searching.length ? 'searching' : 'idle',
      lastError: undefined,
    });
    return true;
  }

  case 'updatechallenges': {
    try {
      const data = JSON.parse(line.args.join('|')) as {
        challengesFrom?: Record<string, string>;
        challengeTo?: { to: string; format: string } | null;
      };
      const from = data.challengesFrom || {};
      setState(() => ({
        challenges: { from, to: data.challengeTo || null },
      }));
    } catch {
      // Malformed challenge payloads are not actionable.
    }
    return true;
  }

  case 'popup': {
    const text = line.args.join('|');
    // The main server uploads replays itself and answers /savereplay with a
    // popup; third-party servers hand the client a payload via queryresponse.
    const saving = getState().replayStatus;
    if (saving?.state === 'saving' && /replay/i.test(text)) {
      if (/upload|saved|available/i.test(text)) {
        const id = (saving.roomId || '').replace(/^battle-/, '');
        setState({
          replayStatus: {
            ...saving,
            state: 'uploaded',
            url: `https://replay.pokemonshowdown.com/${id}`,
          },
        });
      } else {
        setState({ replayStatus: { ...saving, state: 'failed', error: text.replace(/\|\|/g, ' ').trim() } });
      }
      return true;
    }
    setState({ lastError: text || 'Server popup received.' });
    return true;
  }

  case 'pm': {
    const from = line.args[0] || 'pm';
    const to = line.args[1] || '';
    const message = line.args.slice(2).join('|');
    const state = getState();
    const partner = toId(from) === toId(state.username) ? to : from;
    const pmRoomId = `pm-${toId(partner) || 'system'}`;
    // Challenge plumbing rides over PMs; don't render it as chat.
    if (message.startsWith('/challenge') || message.startsWith('/nonotify')) return true;
    setState(current => {
      const existing = current.rooms[pmRoomId] || newPmRoom(pmRoomId, partner.replace(/^[^A-Za-z0-9]/, ''));
      const focused = current.activeRoomId === pmRoomId;
      const chatMessage: ChatMessage = {
        kind: 'pm',
        user: from.replace(/^[^A-Za-z0-9]/, ''),
        message,
        timestamp: Date.now(),
      };
      return {
        rooms: upsert(current.rooms, appendChat(existing, chatMessage, focused) as Room),
      };
    });
    return true;
  }

  case 'queryresponse': {
    const response = parseQueryResponse(line);
    if (!response) return true;
    if (response.id === 'roomlist') {
      const roomList = parseRoomList(response.data);
      if (roomList) setState({ roomList });
    }
    if (response.id === 'rooms') {
      const chatRoomList = parseChatRoomList(response.data);
      if (chatRoomList) setState({ chatRoomList });
    }
    if (response.id === 'savereplay') {
      getState().onReplaySaved(response.data as { id?: string; log?: string; password?: string });
    }
    return true;
  }

  default:
    return false;
  }
};

// ── Room lifecycle ──────────────────────────────────────────────────────────

const handleLifecycle = (roomId: string, line: PsLine, store: ArenaStoreApi): boolean => {
  const { setState } = store;

  switch (line.command) {
  case 'init': {
    const type = line.args[0] || (roomId.startsWith('battle-') ? 'battle' : 'chat');
    setState(state => {
      const existing = state.rooms[roomId];
      let room: Room = existing ?
        ({ ...existing, connected: true } as Room) :
        type === 'battle' ? newBattleRoom(roomId) : newChatRoom(roomId);
      if (room.type === 'battle' && !room.engine) {
        const engine = createEngineBattle(toId(state.username));
        if (engine) room = { ...room, engine };
      }
      return {
        rooms: upsert(state.rooms, room),
        activeRoomId: roomId,
      };
    });
    return true;
  }

  case 'deinit':
    setState(state => ({
      rooms: patchRoom(state.rooms, roomId, { connected: false }),
      activeRoomId: state.activeRoomId === roomId ? undefined : state.activeRoomId,
    }));
    return true;

  case 'noinit':
    setState(state => ({
      lastError: line.args.join(' '),
      rooms: patchRoom(state.rooms, roomId, { connected: false }),
    }));
    return true;

  case 'title':
    setState(state => ({ rooms: patchRoom(state.rooms, roomId, { title: line.args.join('|') || roomId }) }));
    return true;

  case 'users':
    setState(state => ({
      rooms: patchRoom(state.rooms, roomId, {
        users: line.args.join('|').split(',').slice(1).filter(Boolean),
      }),
    }));
    return true;

  case 'j':
  case 'join':
  case 'J':
    setState(state => {
      const room = state.rooms[roomId];
      if (!room) return state;
      const user = (line.args[0] || '').replace(/^[^A-Za-z0-9]/, '');
      if (!user || room.users.includes(user)) return state;
      return { rooms: upsert(state.rooms, { ...room, users: [...room.users, user] } as Room) };
    });
    return true;

  case 'l':
  case 'leave':
  case 'L':
    setState(state => {
      const room = state.rooms[roomId];
      if (!room) return state;
      const user = toId(line.args[0] || '');
      return {
        rooms: upsert(state.rooms, {
          ...room,
          users: room.users.filter(existing => toId(existing) !== user),
        } as Room),
      };
    });
    return true;

  default:
    return false;
  }
};

// ── Battle rooms ────────────────────────────────────────────────────────────

const handleBattleLine = (roomId: string, line: PsLine, store: ArenaStoreApi) => {
  const { setState, getState } = store;
  const username = getState().username;
  const userId = toId(username);

  if (line.command === 'inactive' || line.command === 'inactiveoff') {
    const text = line.args.join('|');
    setState(state => ({
      rooms: updateBattleRoom(state.rooms, roomId, room => ({
        ...room,
        rawLog: [...room.rawLog, line.raw],
        timer: line.command === 'inactiveoff' ?
          { ...room.timer, on: false } :
          { on: true, ...parseTimerLine(text), asOf: Date.now() },
        battle: { ...room.battle, timerOn: line.command === 'inactive' },
      })),
    }));
    return;
  }

  const chat = parseChatLine(line);
  const pretty = chat ? '' : describeBattleLine(line);
  const request = line.command === 'request' ? parseBattleRequest(line) : null;

  setState(state => {
    let searchState = state.searchState;
    let activeRoomId = state.activeRoomId;

    const rooms = updateBattleRoom(state.rooms, roomId, room => {
      let next: typeof room = { ...room, rawLog: [...room.rawLog, line.raw] };

      // Perspective and result are protocol facts the engine does not model.
      if (line.command === 'player') {
        const side = line.args[0] === 'p2' ? 'p2' : 'p1';
        const name = toId(line.args[1] || '');
        const displayName = line.args[1] || '';
        const rating = Number(line.args[3]) || 0;
        const mine = !!name && name === userId;
        next = {
          ...next,
          perspective: mine ? side : next.perspective,
          // Names also land on the placeholder view so the pre-engine window
          // (the second or two before the chunk resolves) is not blank.
          battle: {
            ...next.battle,
            [side]: { name: displayName || next.battle[side].name, rating },
            playerSide: mine ? side : next.battle.playerSide,
            mode: mine ? 'player' : next.battle.mode,
          },
        };
      }
      if (line.command === 'win') next = { ...next, result: { winner: line.args[0], ended: true } };
      if (line.command === 'tie') next = { ...next, result: { ended: true } };

      // Field choreography and the action banner: which side acted or got
      // hit (for CSS animation), plus the human-readable line the field
      // announces. Without this, a move resolving is invisible outside the
      // log panel — HP just quietly changes.
      const event = battleEventFromLine(line.command, line.args, next.perspective, next.lastEvent);
      if (event) next = { ...next, lastEvent: event };

      if (request) {
        const perspective = request.side?.id === 'p1' || request.side?.id === 'p2' ?
          request.side.id :
          next.perspective;
        const flags = requestFlags(request);
        const defender = next.battle.opponentActive;
        next = {
          ...next,
          perspective,
          lastRequest: request,
          choiceSession: createBattleChoiceSession(request),
          choiceDraft: { choices: [] },
          choiceError: undefined,
          choicePending: false,
          // Request-derived view state applies with or without the engine —
          // the deck and decision flags must never wait on a chunk load.
          battle: {
            ...next.battle,
            rqid: request.rqid,
            requestType: flags.requestType,
            noCancel: flags.noCancel,
            trapped: flags.trapped,
            maybeTrapped: flags.maybeTrapped,
            targetable: flags.targetable,
            teamPreviewSize: flags.teamPreviewSize,
            waiting: !!request.wait,
            mode: 'player',
            playerSide: perspective ?? next.battle.playerSide,
            moves: buildMoveDeck(
              request,
              defender?.terastallized ? [defender.terastallized] : defender?.types,
              next.battle.format
            ),
          },
        };
        searchState = 'idle';
        activeRoomId = roomId;
      }

      // The engine consumes every line, chat included — it ignores what it
      // does not care about. Absent engine (chunk still loading), lines sit
      // in rawLog and the engine-ready flush replays them.
      if (next.engine) {
        feedLine(next.engine, line.raw);
        next = {
          ...next,
          battle: projectEngineBattle(next.engine, {
            roomId,
            perspective: next.perspective,
            result: next.result,
            lastRequest: next.lastRequest,
            waiting: next.choicePending || !!next.lastRequest?.wait,
            format: next.battle.format,
          }),
        };
      }

      if (chat) next = appendChat(next, chat, state.activeRoomId === roomId) as typeof next;
      if (pretty) next = appendLog(next, pretty) as typeof next;
      return next;
    });

    return {
      rooms,
      searchState,
      activeRoomId,
      lastError: chat?.kind === 'error' ? chat.message : state.lastError,
    };
  });
};

// ── Entry point ─────────────────────────────────────────────────────────────

type FieldEvent = NonNullable<BattleRoom['lastEvent']>;

/** Outcome notes arrive as their own lines right after the damage they describe. */
const NOTE_LINES: Record<string, string> = {
  '-supereffective': "It's super effective!",
  '-resisted': 'Not very effective…',
  '-crit': 'A critical hit!',
  '-immune': 'It had no effect.',
  '-miss': 'The attack missed!',
};

export function battleEventFromLine(
  command: string,
  args: string[],
  perspective: 'p1' | 'p2' | null | undefined,
  previous?: FieldEvent
): FieldEvent | undefined {
  if (NOTE_LINES[command] && previous) {
    return { ...previous, kind: 'note', at: Date.now(), label: NOTE_LINES[command] };
  }
  if (command !== 'move' && command !== '-damage' && command !== 'faint') return undefined;
  const ident = /^(p[12])([a-z])?: ?(.*)$/.exec(args[0] || '');
  if (!ident) return undefined;
  const ownSide = perspective ?? 'p1';
  const side = ident[1] === ownSide ? 'near' : 'far';
  const slot = ident[2] ? ident[2].charCodeAt(0) - 97 : 0;
  const kind = command === 'move' ? 'attack' : command === 'faint' ? 'faint' : 'hit';
  // A hit is part of the action already announced — it must not clear the
  // banner mid-sequence, only move the shake to the target.
  const label = command === 'move' ? `${ident[3]} used ${args[1]}!` :
    command === 'faint' ? `${ident[3]} fainted!` : previous?.label;
  return { kind, side, slot, at: Date.now(), label };
}

export function routeFrame(frame: PsFrame, store: ArenaStoreApi) {
  const roomId = frame.roomId || 'lobby';

  for (const line of frame.lines) {
    if (!frame.roomId && handleGlobal(line, store)) continue;
    if (handleLifecycle(roomId, line, store)) continue;
    // Global commands can also arrive addressed to a room (e.g. lobby chat
    // frames carry |users| handled above; battle frames carry |request|).
    if (frame.roomId && handleGlobal(line, store)) continue;

    const room = store.getState().rooms[roomId];
    if (room?.type === 'battle' || roomId.startsWith('battle-')) {
      handleBattleLine(roomId, line, store);
      continue;
    }

    const chat = parseChatLine(line);
    if (chat) {
      store.setState(state => {
        const target = state.rooms[roomId] || newChatRoom(roomId, roomId === 'lobby' ? 'Lobby' : roomId);
        return {
          rooms: upsert(state.rooms, appendChat(target, chat, state.activeRoomId === roomId) as Room),
          lastError: chat.kind === 'error' ? chat.message : state.lastError,
        };
      });
    }
  }
}
