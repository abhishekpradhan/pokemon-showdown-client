import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import { AppRoot } from './screens/app-root';

const rootRoute = createRootRoute({
  component: AppRoot,
  beforeLoad: ({ location }) => {
    if (/^\/battle-[a-z0-9-]+$/.test(location.pathname))
      throw redirect({
        to: '/battle/$battleId',
        params: { battleId: location.pathname.slice(1) },
        replace: true,
      });
    if (/^\/pm-[a-z0-9]+$/.test(location.pathname))
      throw redirect({ to: '/room/$roomId', params: { roomId: location.pathname.slice(1) }, replace: true });
    if (location.pathname === '/lobby')
      throw redirect({ to: '/room/$roomId', params: { roomId: 'lobby' }, replace: true });
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./screens/home-screen'), 'HomeScreen'),
});

const battleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/battle/$battleId',
  component: lazyRouteComponent(() => import('./screens/battle-screen'), 'BattleScreen'),
});

const teambuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teambuilder',
  validateSearch: (search: Record<string, unknown>): { team?: string } => ({
    team: typeof search.team === 'string' ? search.team : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/team-workspace'), 'TeamWorkspace'),
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/room/$roomId',
  component: lazyRouteComponent(() => import('./screens/room-screen'), 'RoomScreen'),
});

const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms',
  component: lazyRouteComponent(() => import('./screens/rooms-screen'), 'RoomsScreen'),
});

const battlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/battles',
  component: lazyRouteComponent(() => import('./screens/battles-screen'), 'BattlesScreen'),
});

const ladderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladder',
  validateSearch: (search: Record<string, unknown>): { format?: string; user?: string; exact?: boolean } => ({
    format:
      typeof search.format === 'string' ? search.format.replace(/[^a-z0-9]/gi, '').toLowerCase() : undefined,
    user: typeof search.user === 'string' ? search.user : undefined,
    exact: search.exact === true || search.exact === 'true',
  }),
  component: lazyRouteComponent(() => import('./screens/ladder-screen'), 'LadderScreen'),
});

const replaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replays',
  validateSearch: (
    search: Record<string, unknown>,
  ): { replay?: string; turn?: number; step?: number; side?: 'p1' | 'p2' } => ({
    replay: typeof search.replay === 'string' ? search.replay : undefined,
    turn: Number.isFinite(Number(search.turn)) ? Math.max(0, Math.floor(Number(search.turn))) : undefined,
    step: Number.isFinite(Number(search.step)) ? Math.max(0, Math.floor(Number(search.step))) : undefined,
    side: search.side === 'p2' ? 'p2' : search.side === 'p1' ? 'p1' : undefined,
  }),
  component: lazyRouteComponent(() => import('./screens/replays-screen'), 'ReplaysScreen'),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('./screens/settings-screen'), 'SettingsScreen'),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  battleRoute,
  roomRoute,
  teambuilderRoute,
  roomsRoute,
  battlesRoute,
  ladderRoute,
  replaysRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <section className="empty-state" aria-label="Page not found">
      <span className="eyebrow">Not found</span>
      <h1>That page does not exist</h1>
      <p>The address may be stale — battles and rooms close when you leave them.</p>
      <a className="primary-action" href="/">
        Back to matchmaking
      </a>
    </section>
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
