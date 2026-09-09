import { render, screen, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppRoot } from './app-root';
import { HomeScreen } from './home-screen';
import { APP_TITLE, documentTitleFor } from './use-document-title';
import { demoBattle } from '../compat/battle-adapter';
import { newChatRoom } from '../rooms/registry';

function renderWithRouter(path = '/') {
  const rootRoute = createRootRoute({ component: AppRoot });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomeScreen,
  });
  const battleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/battle/$battleId',
    component: () => <p>Battle workspace</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, battleRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('modern app shell', () => {
  it('renders the cockpit shell and matchmaking workspace', async () => {
    renderWithRouter();
    expect(await screen.findByRole('heading', { name: /find a battle/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByLabelText('Open sessions')).toBeInTheDocument();
  });
});

describe('document title', () => {
  it('names the tab after the route and restores the plain title on unmount', async () => {
    const view = renderWithRouter('/');
    await waitFor(() => expect(document.title).toBe(`Battle · ${APP_TITLE}`));
    view.unmount();
    expect(document.title).toBe(APP_TITLE);
  });

  it('names a battle after its players', async () => {
    // The store seeds the demo battle room under test fixtures.
    renderWithRouter(`/battle/${demoBattle.id}`);
    await waitFor(() =>
      expect(document.title).toBe(`${demoBattle.p1.name} vs ${demoBattle.p2.name} · ${APP_TITLE}`),
    );
  });

  it('prefixes the open room with its unread count and labels top-level pages', () => {
    const lobby = { ...newChatRoom('lobby', 'Lobby'), unread: 3 };
    expect(documentTitleFor('/room/lobby', lobby)).toBe(`(3) Lobby · ${APP_TITLE}`);
    expect(documentTitleFor('/room/lobby', { ...lobby, unread: 0 })).toBe(`Lobby · ${APP_TITLE}`);
    expect(documentTitleFor('/teambuilder')).toBe(`Teams · ${APP_TITLE}`);
    expect(documentTitleFor('/nowhere')).toBe(APP_TITLE);
  });
});
