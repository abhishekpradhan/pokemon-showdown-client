import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamWorkspace } from './team-workspace';
import { loadStoredTeams, packTeam, TEAM_STORAGE_KEY, type StoredTeam } from '../compat/team-store';
import { useArenaStore } from '../stores/arena-store';
vi.mock('@tanstack/react-router', () => ({ useSearch: () => ({}), useNavigate: () => vi.fn() }));

const team: StoredTeam = { id: 'saved', name: 'Saved team', format: 'gen9ou', sets: [{ species: 'Pikachu', gender: 'F', happiness: 0, moves: ['Thunderbolt'] }], packed: '', updatedAt: 1 };

describe('team workspace draft lifecycle', () => {
  beforeEach(() => {
    localStorage.clear(); loadStoredTeams();
    useArenaStore.setState({ teams: [{ ...team, packed: packTeam(team.sets) }], activeTeamId: team.id, selectedFormat: 'gen9ou', lastError: undefined, teamNotice: undefined, teamValidation: undefined, formats: [{ id: 'gen9ou', name: '[Gen 9] OU' }] });
  });

  it('saves structured data without erasing uncommon fields', () => {
    render(<TeamWorkspace />);
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save team' }));
    expect(useArenaStore.getState().teams[0].sets[0]).toMatchObject({ gender: 'F', happiness: 0 });
    expect(loadStoredTeams()[0].name).toBe('Renamed');
  });

  it('saves incomplete new teams and keeps a failed save open', () => {
    render(<TeamWorkspace />);
    fireEvent.click(screen.getAllByRole('button', { name: 'New team' })[0]);
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Incomplete' } });
    const original = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key === TEAM_STORAGE_KEY) throw new Error('Quota'); original(key, value); });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new team' }));
    expect(screen.getByLabelText('Team name')).toHaveValue('Incomplete');
    expect(useArenaStore.getState().teams).toHaveLength(1);
    spy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Save as new team' }));
    expect(useArenaStore.getState().teams[0]).toMatchObject({ name: 'Incomplete', sets: [] });
  });

  it('recovers an unsaved draft after navigation and component remount', async () => {
    const view = render(<TeamWorkspace />);
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'My unfinished changes' } });
    await waitFor(() => expect(localStorage.getItem('ps-arena-team-draft-saved')).toContain('My unfinished changes'));
    view.unmount(); render(<TeamWorkspace />);
    expect(screen.getByLabelText('Team name')).toHaveValue('My unfinished changes');
  });

  it('shows every imported slot, including overflow', () => {
    useArenaStore.setState({ teams: [{ ...team, sets: Array.from({ length: 8 }, (_, index) => ({ species: `Pikachu ${index}`, moves: ['Thunderbolt'] })) }] });
    render(<TeamWorkspace />);
    expect(screen.getAllByRole('button', { name: /^Edit Pikachu/ })).toHaveLength(8);
    expect(screen.getByText(/All 8 imported slots are shown/)).toBeInTheDocument();
  });
});
