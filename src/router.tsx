import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { AppRoot } from './screens/app-root';

const rootRoute = createRootRoute({
  component: AppRoot,
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

const ladderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladder',
  component: lazyRouteComponent(() => import('./screens/ladder-screen'), 'LadderScreen'),
});

const replaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replays',
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
      <a className="primary-action" href="/">Back to matchmaking</a>
    </section>
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
