import { act, cleanup, render, screen } from '@testing-library/react';
import { ChatFeed } from './chat-feed';
import type { ChatMessage } from '../rooms/types';
import { useWorkspaceStore } from '../stores/workspace-store';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
const message = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ user: 'Bob', message: text, ...extra });
const flush = () => act(() => vi.advanceTimersByTime(200));
const announcements = () => screen.getByRole('status', { name: 'New chat messages' });

beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  useWorkspaceStore.setState({ ignoredUsers: [], timestamps: true, highlights: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('keeps initial and replacement history quiet while announcing an appended message once', () => {
  const history = Array.from({ length: 100 }, (_, i) => message(`Retained message ${i}`));
  const view = render(<ChatFeed messages={history} announce label="Lobby history" />);
  expect(screen.getByRole('log', { name: 'Lobby history' })).toHaveAttribute('aria-live', 'off');
  expect(announcements()).toHaveAttribute('aria-live', 'polite'); flush();
  expect(announcements()).toBeEmptyDOMElement();
  const live = [...history, message('A new message')];
  view.rerender(<ChatFeed messages={live} announce />); flush();
  expect(announcements()).toHaveTextContent('Bob: A new message');
  expect(announcements()).not.toHaveTextContent('Retained');
  view.rerender(<ChatFeed messages={live.map(entry => ({ ...entry }))} announce />); flush();
  expect(announcements()).toBeEmptyDOMElement();
});

it('announces the first live message in an empty chat but suppresses delayed timestamped backlog', () => {
  const view = render(<ChatFeed messages={[]} announce />);
  const backlog = message('Earlier message', { timestamp: Date.now() - 60_000 });
  view.rerender(<ChatFeed messages={[backlog]} announce />); flush();
  expect(announcements()).toBeEmptyDOMElement();
  view.rerender(<ChatFeed messages={[backlog, message('Hello now')]} announce />); flush();
  expect(announcements()).toHaveTextContent('Bob: Hello now');
});

it('excludes own echoes, ignored users, and system battle narration from chat announcements', () => {
  useWorkspaceStore.setState({ ignoredUsers: ['ignoreduser'] });
  const view = render(<ChatFeed messages={[]} announce selfName="Alice" />);
  view.rerender(<ChatFeed messages={[
    message('Move narrative', { user: 'system', kind: 'system' }),
    message('My own message', { user: '+Alice' }),
    message('Ignored message', { user: '@Ignored User' }),
    message('An opponent chatting'),
  ]} announce selfName="Alice" />); flush();
  expect(announcements()).toHaveTextContent('Bob: An opponent chatting');
  expect(announcements()).not.toHaveTextContent(/Move narrative|My own|Ignored/);
});

it('summarizes a burst and follows appended messages even when retained history trims', () => {
  const baseline = [message('one'), message('two')];
  const view = render(<ChatFeed messages={baseline} announce />);
  const additions = Array.from({ length: 8 }, (_, i) => message(`New ${i}`));
  view.rerender(<ChatFeed messages={[baseline[1], ...additions]} announce />); flush();
  expect(announcements()).toHaveTextContent('8 new chat messages. Latest: Bob: New 7');
  expect(announcements()).not.toHaveTextContent('New 0');
});

it('keeps replay, filtered history, and re-enabled existing history silent', () => {
  const baseline = [message('Existing')];
  const view = render(<ChatFeed messages={[]} />);
  view.rerender(<ChatFeed messages={baseline} />); flush();
  expect(announcements()).toHaveAttribute('aria-live', 'off'); expect(announcements()).toBeEmptyDOMElement();
  view.rerender(<ChatFeed messages={baseline} announce />); flush();
  expect(announcements()).toBeEmptyDOMElement();
  view.rerender(<ChatFeed messages={[...baseline, message('New live message')]} announce />); flush();
  expect(announcements()).toHaveTextContent('Bob: New live message');
});
