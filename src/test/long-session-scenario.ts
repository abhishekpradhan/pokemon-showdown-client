import { parsePsFrame } from '../compat/protocol-client';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';

/** Deterministic synthetic traffic, shared by unit coverage and the isolated
 * heap benchmark. No timers, network requests, wall-clock payloads or user data. */
export function exerciseLongSession(measureHeap?: () => number) {
  const initial = useArenaStore.getState();
  const previousPreferences = useWorkspaceStore.getState();
  let sent = 0;
  const protocol = { send: () => { sent++; return true; } } as unknown as typeof initial.protocol;
  useArenaStore.setState({ rooms: {}, roomErrors: {}, userCards: {}, rawProtocolLog: [], protocolLogEnabled: true,
    username: 'ArenaStress', named: true, connection: 'connected', activeRoomId: 'lobby', protocol });
  useWorkspaceStore.setState({ ignoredUsers: [], blockPms: false, blockChallenges: false, autojoinRooms: [] });
  let frames = 0;
  const apply = (raw: string) => { frames++; useArenaStore.getState().handleFrame(parsePsFrame(raw)); };
  const batches: number[] = [];
  try {
    for (const id of ['lobby', 'staff']) apply(`>${id}\n|init|chat\n|title|${id}`);
    for (let batch = 0; batch < 24; batch++) {
      const start = performance.now();
      for (let index = 0; index < 500; index++) {
        const sequence = batch * 500 + index;
        const id = sequence % 2 ? 'lobby' : 'staff';
        apply(`>${id}\n|c|ArenaReader|Synthetic message ${sequence}`);
        if (sequence % 25 === 0) apply(`>${id}\n|uhtmlchange|status|<p>Revision ${sequence}</p>`);
      }
      batches.push(performance.now() - start);
    }
    for (let index = 0; index < 320; index++) {
      const id = `stress-${index}`;
      apply(`>${id}\n|init|chat\n|c|ArenaReader|Transient room ${index}`);
      useArenaStore.getState().leaveRoom(id);
      useArenaStore.getState().openPmWith(`Temporary${index}`);
      apply(`|pm| Temporary${index}| ArenaStress|One private synthetic message`);
      useArenaStore.getState().leaveRoom(`pm-temporary${index}`);
      apply(`|queryresponse|userdetails|${JSON.stringify({ userid: `reader${index}`, name: `Reader ${index}`, avatar: '1', rooms: {} })}`);
    }
    for (let index = 0; index < 200; index++) {
      apply('>snapshot\n|init|chat\n|c|ArenaReader|Reconnect snapshot');
    }
    const successfulRoomErrorEntries = Object.keys(useArenaStore.getState().roomErrors).length;
    for (let index = 0; index < 320; index++) apply(`>unavailable-${index}\n|noinit|nonexistent|Synthetic unavailable room`);
    const failures = useArenaStore.getState().roomErrors;
    const retainedFailureEntries = Object.keys(failures).length;
    const oldestFailureDiscarded = !failures['unavailable-0'] && !failures['unavailable-287'];
    const latestFailureRetained = !!failures['unavailable-319'];
    // A later successful snapshot must clear its previous failure without
    // creating an empty error key, and closing it must release the room again.
    apply('>unavailable-319\n|init|chat');
    useArenaStore.getState().leaveRoom('unavailable-319');
    const state = useArenaStore.getState();
    const rooms = Object.values(state.rooms);
    const sorted = batches.slice().sort((a, b) => a - b);
    return {
      frames, sent, batches: batches.length,
      batchP95Ms: Number(sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2)),
      closedRooms: rooms.filter(room => !room.connected).length,
      openRooms: rooms.filter(room => room.connected).length,
      maxChatEntries: Math.max(...rooms.map(room => room.chat.length)),
      totalChatEntries: rooms.reduce((total, room) => total + room.chat.length, 0),
      maxRoomLogEntries: Math.max(...rooms.map(room => room.log.length)),
      rawProtocolEntries: state.rawProtocolLog.length,
      userCards: Object.keys(state.userCards).length,
      roomErrorEntries: Object.keys(state.roomErrors).length,
      successfulRoomErrorEntries, retainedFailureEntries, oldestFailureDiscarded, latestFailureRetained,
      recoveredFailureCleared: !Object.hasOwn(state.roomErrors, 'unavailable-319'),
      emptyRoomErrorEntries: Object.values(state.roomErrors).filter(error => !error).length,
      snapshotEntries: state.rooms.snapshot.chat.length,
      snapshotMessages: state.rooms.snapshot.chat.map(entry => entry.message),
      activeRoomRetained: !!state.rooms.lobby?.connected,
      heapUsedBytes: measureHeap?.(),
    };
  } finally {
    useArenaStore.setState(initial, true);
    useWorkspaceStore.setState(previousPreferences, true);
  }
}
