import { normalizePreferenceList } from './preference-input';
it('normalizes ranked or spaced usernames to the identifiers used by chat ignores', () => {
  expect(normalizePreferenceList('ignoredUsers', '@Alice, Alice, Alice Smith, +Bob')).toEqual(['alice', 'alicesmith', 'bob']);
});
it('preserves room hyphens and multiword highlight phrases while discarding empty entries', () => {
  expect(normalizePreferenceList('mutedRooms', '#Lobby, Battle-Gen9OU-123, , lobby')).toEqual(['lobby', 'battle-gen9ou-123']);
  expect(normalizePreferenceList('highlights', ' Great Tusk, a win ')).toEqual(['great tusk', 'a win']);
});
