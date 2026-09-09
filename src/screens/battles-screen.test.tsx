import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BattlesScreen } from './battles-screen';
import { useArenaStore } from '../stores/arena-store';
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));
const initial = useArenaStore.getState();
const rooms = Array.from({ length: 45 }, (_, i) => ({
  id: `battle-gen9ou-${i}`,
  title: `Alice${i} vs Bob`,
  p1: `Alice${i}`,
  p2: 'Bob',
  format: 'gen9ou',
  minElo: 1500,
}));
beforeEach(() =>
  useArenaStore.setState({
    connection: 'connected',
    roomList: { rooms: [{ id: 'lobby', title: 'Lobby', p1: 'Lobby', p2: '', format: 'gen9ou' }, ...rooms] },
    refreshRoomList: vi.fn(),
    formats: [
      { id: 'gen9ou', name: '[Gen 9] OU' },
      { id: 'gen9uu', name: '[Gen 9] UU' },
    ],
  }),
);
afterEach(() => {
  cleanup();
  useArenaStore.setState(initial);
});
it('returns to the first page when the format changes', () => {
  render(<BattlesScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select battle format' }));
  fireEvent.click(screen.getByRole('option', { name: /\[Gen 9\] UU/ }));
  expect(screen.getByText('Page 1')).toBeInTheDocument();
});
it('keeps refreshed smaller snapshots visible instead of leaving an empty page', () => {
  render(<BattlesScreen />);
  expect(screen.queryByRole('button', { name: /Lobby/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  act(() => useArenaStore.setState({ roomList: { rooms: rooms.slice(0, 1) } }));
  expect(screen.getByRole('button', { name: /Alice0 vs Bob/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Lobby/ })).not.toBeInTheDocument();
  expect(screen.getByText('Page 1')).toBeInTheDocument();
});
