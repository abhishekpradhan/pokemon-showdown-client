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
  teambuilderRoute,
  roomsRoute,
  ladderRoute,
  replaysRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
