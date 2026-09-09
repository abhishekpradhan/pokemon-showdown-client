import { vi } from 'vitest';
import { parseBattleInvitations, parseChallengeDetails } from './battle-invitations';
import { parsePsFrame } from './protocol-client';
import { useArenaStore } from '../stores/arena-store';
import { loadEngine } from '../battle/engine';

const initial = useArenaStore.getState();
const roomId = 'battle-gen9multi-1';
// Verbatim schema from pinned server room-battle.ts sendInviteForm.
const emptyForm = (slot: number, room = roomId) =>
  `<form data-submitsend="/msgroom ${room},/invitebattle {username}, p${slot}"><label>Player ${slot}: <input name="username" class="textbox" placeholder="Username" /></label> <button class="button" type="submit">Add Player</button></form>`;
const invitedForm =
  '<form data-submitsend="/msgroom battle-gen9multi-1,/uninvitebattle rosa"><label>Player 3: <strong>rosa</strong> (invited) <button type="submit">Uninvite</button></label></form>';
const pm = (message: string) =>
  useArenaStore.getState().handleFrame(parsePsFrame(`|pm|+ArenaAlice| ArenaTester|${message}`));
beforeAll(async () => {
  await loadEngine();
});
beforeEach(() =>
  useArenaStore.setState({
    username: 'ArenaTester',
    named: true,
    connection: 'connected',
    rooms: {},
    challenges: { from: {}, to: null },
    lastError: undefined,
    protocol: { send: vi.fn(() => true) } as unknown as typeof initial.protocol,
    formats: [
      { id: 'gen9freeforall', name: 'Free-for-all', team: true },
      { id: 'gen9multirandombattle', name: 'Multi Random Battle', team: false },
    ],
  }),
);
afterEach(() => {
  useArenaStore.setState(initial, true);
  vi.restoreAllMocks();
});

it('preserves all five PM fields without inventing a command or dropping a supplied-team signal', () => {
  expect(
    parseChallengeDetails(
      "/challenge gen9freeforall||You're invited to join a battle (with Alice, Bob)|Join now|Decline",
    ),
  ).toEqual({
    format: 'gen9freeforall',
    teambuilderFormat: '',
    message: "You're invited to join a battle (with Alice, Bob)",
    acceptLabel: 'Join now',
    rejectLabel: 'Decline',
  });
  expect(parseChallengeDetails('/challenge gen9ou')?.teambuilderFormat).toBeUndefined();
  expect(parseChallengeDetails('/challenge')).toBeNull();
  expect(parseChallengeDetails(`/challenge ${'x'.repeat(121)}||||`)).toBeNull();
  expect(parseChallengeDetails(`/challenge gen9ou|${'x'.repeat(121)}|||`)).toBeNull();
  expect(
    parseChallengeDetails(`/challenge gen9ou||${'m'.repeat(1500)}|${'a'.repeat(150)}|${'r'.repeat(150)}`),
  ).toMatchObject({ message: 'm'.repeat(1000), acceptLabel: 'a'.repeat(120), rejectLabel: 'r'.repeat(120) });
});

it('accepts a provided-team battle invite through the official public dispatcher without replacing the team', () => {
  pm("/challenge gen9freeforall||You're invited to join a battle (with Alice, Bob)||");
  const state = useArenaStore.getState();
  expect(state.challenges.details?.arenaalice?.teambuilderFormat).toBe('');
  state.acceptChallenge('ArenaAlice');
  expect(state.protocol.send).toHaveBeenCalledExactlyOnceWith('/accept arenaalice');
  pm('/challenge');
  expect(useArenaStore.getState().challenges.from).toEqual({});
  expect(useArenaStore.getState().challenges.details).toEqual({});
  state.acceptChallenge('ArenaAlice');
  expect(state.protocol.send).toHaveBeenCalledTimes(1);
});

it('validates and sends the requested teambuilder format before accepting a newly assigned seat', () => {
  const validate = vi.fn(() => ({ ok: true, errors: [], warnings: [] }));
  useArenaStore.setState({ validateTeamForFormat: validate, activeTeamId: 'chosen-team' });
  pm(
    "/challenge gen9freeforall@@@maxteamsize=3|gen9freeforall|You're invited to join a battle (with Alice, Bob)||",
  );
  useArenaStore.getState().acceptChallenge('arenaalice');
  expect(validate).toHaveBeenCalledWith('chosen-team', 'gen9freeforall');
  expect(vi.mocked(useArenaStore.getState().protocol.send).mock.calls.map(call => call[0])).toEqual([
    expect.stringMatching(/^\/utm /),
    '/accept arenaalice',
  ]);
});

it('preserves standard random challenges and rejection failures without losing the invitation', () => {
  pm('/challenge gen9multirandombattle|gen9multirandombattle|||');
  const state = useArenaStore.getState();
  state.acceptChallenge('ArenaAlice');
  expect(state.protocol.send).toHaveBeenCalledWith('/accept arenaalice');
  vi.mocked(state.protocol.send).mockReturnValue(false);
  state.rejectChallenge('ArenaAlice');
  expect(useArenaStore.getState().challenges.from.ArenaAlice).toBeTruthy();
  vi.mocked(state.protocol.send).mockReturnValue(true);
  state.rejectChallenge('arenaalice');
  expect(state.protocol.send).toHaveBeenLastCalledWith('/reject arenaalice');
  expect(useArenaStore.getState().challenges.from).toEqual({});
});

it('only enables schema-matching seat actions scoped to the current battle', () => {
  expect(parseBattleInvitations(emptyForm(3) + emptyForm(4) + invitedForm, roomId)).toEqual([
    { slot: 'p3', canInvite: true },
    { slot: 'p4', canInvite: true },
  ]);
  expect(parseBattleInvitations(emptyForm(3, 'battle-other-1'), roomId)).toBeUndefined();
  expect(parseBattleInvitations(emptyForm(3).replace('/invitebattle', '/forfeit'), roomId)).toBeUndefined();
  expect(parseBattleInvitations(invitedForm.replace('rosa"', 'rosa\n/forfeit"'), roomId)).toBeUndefined();
  expect(parseBattleInvitations(' '.repeat(65_537) + emptyForm(3), roomId)).toBeUndefined();
  expect(
    parseBattleInvitations(
      `<img src="https://invalid.example/track"><iframe src="https://invalid.example/embed"></iframe>${emptyForm(3)}`,
      roomId,
    ),
  ).toEqual([{ slot: 'p3', canInvite: true }]);
});

it('invites both remaining seats, revokes one, handles withdrawal, and clears controls when play starts', () => {
  const state = useArenaStore.getState();
  state.handleFrame(
    parsePsFrame(
      `>${roomId}\n|init|battle\n|gametype|multi\n|player|p1|ArenaTester\n|player|p2|Rival\n|uhtmlchange|invites|${emptyForm(3)}${emptyForm(4)}`,
    ),
  );
  expect(state.inviteBattlePlayer(roomId, 'p3', 'Rosa')).toBe(true);
  expect(state.inviteBattlePlayer(roomId, 'p4', 'Barry')).toBe(true);
  expect(state.protocol.send).toHaveBeenCalledWith('/invitebattle rosa, p3', roomId);
  expect(state.protocol.send).toHaveBeenCalledWith('/invitebattle barry, p4', roomId);
  state.handleFrame(parsePsFrame(`>${roomId}\n|uhtmlchange|invites|${invitedForm}${emptyForm(4)}`));
  expect(state.inviteBattlePlayer(roomId, 'p3', 'Other')).toBe(false);
  expect(state.revokeBattleInvitation(roomId, 'p3')).toBe(true);
  expect(state.protocol.send).toHaveBeenLastCalledWith('/uninvitebattle rosa', roomId);
  state.handleFrame(parsePsFrame('|pm| ArenaTester| Rosa|/challenge'));
  expect(state.inviteBattlePlayer(roomId, 'p3', 'Other')).toBe(true);
  state.handleFrame(parsePsFrame(`>${roomId}\n|start`));
  expect(state.inviteBattlePlayer(roomId, 'p3', 'Another')).toBe(false);
});
