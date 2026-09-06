import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LadderScreen } from './ladder-screen';
import { requestPublicLadder, requestServerLadder } from '../compat/ladder';
import { getDefaultServerConfig } from '../compat/protocol-client';
import { useArenaStore } from '../stores/arena-store';

const routing = vi.hoisted(() => ({ search: {} as { format?: string; user?: string; exact?: boolean }, navigate: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => routing.search, useNavigate: () => routing.navigate }));
vi.mock('../compat/ladder', () => ({ requestPublicLadder: vi.fn(), requestServerLadder: vi.fn() }));

describe('ladder browsing workflows', () => {
  beforeEach(() => {
    routing.search = { format: 'gen9ou' }; routing.navigate.mockClear();
    useArenaStore.setState({ selectedFormat: 'gen9randombattle', server: { ...getDefaultServerConfig(), id: 'showdown', host: 'sim3.psim.us' }, connection: 'connected', formats: [{ id: 'gen9ou', name: '[Gen 9] OU', searchShow: true }, { id: 'gen9uu', name: '[Gen 9] UU', searchShow: true }] });
    vi.mocked(requestPublicLadder).mockResolvedValue([{ rank: 1, username: 'Alice', elo: 1600, gxe: 65, glicko: 1750, deviation: 110 }]);
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('browses formats and players without changing the selected matchmaking format', async () => {
    render(<LadderScreen />);
    await screen.findByRole('button', { name: 'Alice' });
    expect(screen.getByText(/1750 ± 110/)).toHaveTextContent('provisional');
    fireEvent.click(screen.getByRole('button', { name: 'Select ladder format' }));
    fireEvent.click(screen.getByRole('option', { name: '[Gen 9] UU' }));
    expect(routing.navigate).toHaveBeenLastCalledWith(expect.objectContaining({ search: expect.objectContaining({ format: 'gen9uu' }) }));
    expect(useArenaStore.getState().selectedFormat).toBe('gen9randombattle');
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));
    expect(routing.navigate).toHaveBeenLastCalledWith(expect.objectContaining({ search: { format: 'gen9ou', user: 'Alice', exact: true } }));
  });

  it('shows loading during refresh and restores player form fields from browser navigation', async () => {
    const view = render(<LadderScreen />); await screen.findByRole('button', { name: 'Alice' });
    let finish: (rows: []) => void = () => {};
    vi.mocked(requestPublicLadder).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    expect(screen.getByText('Loading standings…')).toBeInTheDocument();
    finish([]); await screen.findByText('No ranked players yet for this format.');
    routing.search = { format: 'gen9ou', user: 'Bob', exact: true }; view.rerender(<LadderScreen />);
    expect(screen.getByLabelText('Ladder player search')).toHaveValue('Bob');
    expect(screen.getByRole('checkbox')).toBeChecked();
    await waitFor(() => expect(requestPublicLadder).toHaveBeenLastCalledWith(expect.any(String), 'gen9ou', 'Bob', true, expect.any(AbortSignal)));
  });

  it('requests custom-server standings from the connected protocol', async () => {
    useArenaStore.setState({ server: { ...getDefaultServerConfig(), id: 'custom', host: 'localhost', port: 8000, secure: false } });
    vi.mocked(requestServerLadder).mockResolvedValue([{ rank: 1, username: 'CustomPlayer' }]);
    render(<LadderScreen />);
    await screen.findByRole('button', { name: 'CustomPlayer' });
    expect(requestServerLadder).toHaveBeenCalledTimes(1); expect(requestPublicLadder).not.toHaveBeenCalled();
  });
});
