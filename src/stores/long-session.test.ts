import { exerciseLongSession } from '../test/long-session-scenario';

it('bounds retained state across sustained traffic, hundreds of closed sessions, and reconnect snapshots', () => {
  const result = exerciseLongSession();
  expect(result.frames).toBeGreaterThan(13_000);
  expect(result.closedRooms).toBeLessThanOrEqual(12);
  expect(result.openRooms).toBe(3);
  expect(result.maxChatEntries).toBeLessThanOrEqual(2000);
  expect(result.maxRoomLogEntries).toBeLessThanOrEqual(400);
  expect(result.totalChatEntries).toBeLessThanOrEqual(4013);
  expect(result.rawProtocolEntries).toBe(240);
  expect(result.userCards).toBe(200);
  expect(result.successfulRoomErrorEntries).toBe(0);
  expect(result.retainedFailureEntries).toBe(32);
  expect(result.roomErrorEntries).toBe(31);
  expect(result.emptyRoomErrorEntries).toBe(0);
  expect(result.oldestFailureDiscarded).toBe(true);
  expect(result.latestFailureRetained).toBe(true);
  expect(result.recoveredFailureCleared).toBe(true);
  expect(result.snapshotEntries).toBe(1);
  expect(result.snapshotMessages).toEqual(['Reconnect snapshot']);
  expect(result.activeRoomRetained).toBe(true);
}, 15_000);
