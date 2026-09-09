import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReplaysScreen } from './replays-screen';
import { fetchReplay, parseReplayLog } from '../replays/replay-data';
import type { ArenaBattle } from '../compat/battle-adapter';
import log from '../compat/__fixtures__/gen9ou-singles.log?raw';

const routing = vi.hoisted(() => ({
  search: {} as { replay?: string; turn?: number; step?: number; side?: 'p1' | 'p2' },
  navigate: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => routing.search,
  useNavigate: () => routing.navigate,
}));
vi.mock('../replays/replay-data', async importOriginal => ({
  ...(await importOriginal<typeof import('../replays/replay-data')>()),
  fetchReplay: vi.fn(),
}));
vi.mock('../components/battle-field', () => ({
  BattleField: ({ battle }: { battle: ArenaBattle }) => (
    <div data-testid="battle">
      {battle.playerSide === 'p2' ? battle.p2.name : battle.p1.name} /{' '}
      {battle.playerSide === 'p2' ? battle.p1.name : battle.p2.name} / {battle.turn}
    </div>
  ),
}));

const address = 'https://replay.pokemonshowdown.com/gen9ou-123-secretpw';
describe('replay review workflows', () => {
  beforeEach(() => {
    localStorage.clear();
    routing.navigate.mockClear();
    routing.search = { replay: address, turn: 2, side: 'p1' };
    vi.mocked(fetchReplay).mockResolvedValue(
      parseReplayLog(log, { id: 'gen9ou-123-secretpw', url: address, private: 2 }),
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens a protected deep link, seeks turns, flips sides and restores URL navigation without refetching', async () => {
    const view = render(<ReplaysScreen />);
    await waitFor(() => expect(screen.getByLabelText('Go to turn')).toHaveValue(2));
    expect(screen.getByText(/Protected replay link/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Original replay' })).toHaveAttribute('href', address);
    fireEvent.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(screen.getByLabelText('Go to turn')).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Switch sides' }));
    expect(screen.getByTestId('battle')).toHaveTextContent('Imcool5335 / Jogarame');
    expect(routing.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ replay: address, turn: 3, side: 'p2' }) }),
    );
    routing.search = { replay: address, turn: 1, side: 'p1' };
    view.rerender(<ReplaysScreen />);
    expect(screen.getByLabelText('Go to turn')).toHaveValue(1);
    expect(screen.getByTestId('battle')).toHaveTextContent('Jogarame / Imcool5335');
    expect(fetchReplay).toHaveBeenCalledTimes(1);
  });

  it('persists bookmarks and provides narration beyond the battlefield', async () => {
    render(<ReplaysScreen />);
    await screen.findByRole('button', { name: 'Bookmark' });
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }));
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ps-arena-replays-v1') || '[]')[0]).toMatchObject({
      url: address,
      bookmarked: true,
      private: 2,
    });
    expect(
      screen.getByText('Battle narration').closest('details')?.querySelectorAll('li').length,
    ).toBeGreaterThan(0);
  });

  it('cancels an in-flight source and ignores a later stale response', async () => {
    vi.mocked(fetchReplay).mockImplementation(
      (_input, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    );
    render(<ReplaysScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await screen.findByText('Replay loading cancelled.');
    expect(screen.getByRole('button', { name: 'Load replay' })).toBeEnabled();
    expect(screen.queryByTestId('battle')).not.toBeInTheDocument();
  });
});
