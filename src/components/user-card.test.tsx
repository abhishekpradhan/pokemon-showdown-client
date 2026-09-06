import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { UserCard, type UserCardAnchor } from './user-card';
import { useArenaStore } from '../stores/arena-store';
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
const initial = useArenaStore.getState();

function ProfileExample() {
  const [anchor, setAnchor] = useState<UserCardAnchor>();
  return <><button type="button" onClick={event => setAnchor({ name: 'Bob', x: 20, y: 20, trigger: event.currentTarget })}>Bob username</button><input aria-label="Another control" />{anchor && <UserCard anchor={anchor} onClose={() => setAnchor(undefined)} />}</>;
}
beforeEach(() => useArenaStore.setState({ named: true, username: 'Alice', userCards: {}, requestUserDetails: vi.fn() }));
afterEach(() => { cleanup(); useArenaStore.setState(initial); });

it('restores the invoking username after Escape even when a pointer did not focus the trigger', () => {
  render(<ProfileExample />);
  const trigger = screen.getByRole('button', { name: 'Bob username' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Bob profile' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
});
it('returns from the close button and preserves focus explicitly moved elsewhere', () => {
  render(<ProfileExample />);
  const trigger = screen.getByRole('button', { name: 'Bob username' });
  fireEvent.click(trigger); fireEvent.click(screen.getByRole('button', { name: 'Close profile' }));
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  const other = screen.getByRole('textbox', { name: 'Another control' }); other.focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(other).toHaveFocus();
});
