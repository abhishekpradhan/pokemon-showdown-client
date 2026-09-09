import { useArenaStore } from './arena-store';
import { packTeam } from '../compat/team-store';

const initial = useArenaStore.getState();
const send = vi.fn<(message: string) => boolean>(() => true);
beforeEach(() => {
  const sets = [{ species: 'Pikachu', moves: ['Thunderbolt'] }];
  useArenaStore.setState({
    ...initial,
    username: 'Alice',
    named: true,
    connection: 'connected',
    lastError: undefined,
    formats: [{ id: 'gen9ou', name: '[Gen 9] OU', team: true }],
    activeTeamId: 'team',
    activeTeam: packTeam(sets),
    teams: [{ id: 'team', name: 'Team', sets, packed: packTeam(sets), format: 'gen9ou', updatedAt: 1 }],
    challenges: { from: { Bob: 'gen9ou' }, to: { to: 'Carol', format: 'gen9ou' } },
    protocol: { send } as unknown as typeof initial.protocol,
  });
  send.mockReset();
  send.mockReturnValue(true);
});
afterEach(() => useArenaStore.setState(initial));

it('never accepts a challenge after team upload fails', () => {
  send.mockReturnValueOnce(false);
  useArenaStore.getState().acceptChallenge('Bob');
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toMatch(/^\/utm /);
  expect(useArenaStore.getState().lastError).toContain('team was not sent');
  expect(useArenaStore.getState().challenges.from.Bob).toBe('gen9ou');
});
it('keeps acceptance failures actionable when the team upload succeeded', () => {
  send.mockReturnValueOnce(true).mockReturnValueOnce(false);
  useArenaStore.getState().acceptChallenge('Bob');
  expect(send).toHaveBeenLastCalledWith('/accept bob');
  expect(useArenaStore.getState().lastError).toContain('acceptance was not sent');
});
it('preserves incoming and outgoing challenges after failed rejection or cancellation', () => {
  send.mockReturnValue(false);
  useArenaStore.getState().rejectChallenge('Bob');
  useArenaStore.getState().cancelChallenge();
  expect(useArenaStore.getState().challenges).toEqual({
    from: { Bob: 'gen9ou' },
    to: { to: 'Carol', format: 'gen9ou' },
  });
  send.mockReturnValue(true);
  useArenaStore.getState().rejectChallenge('Bob');
  useArenaStore.getState().cancelChallenge();
  expect(useArenaStore.getState().challenges).toEqual({ from: {}, to: null });
  expect(useArenaStore.getState().lastError).toBeUndefined();
});
