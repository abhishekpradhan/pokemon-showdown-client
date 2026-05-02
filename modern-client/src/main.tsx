import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppRoot } from './screens/app-root';
import { BattleScreen } from './screens/battle-screen';
import { HomeScreen } from './screens/home-screen';
import { UtilityScreen } from './screens/utility-screen';
import './styles.css';

const rootRoute = createRootRoute({
  component: AppRoot,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});

const battleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/battle/$battleId',
  component: BattleScreen,
});

const teambuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teambuilder',
  component: () => <UtilityScreen view="teambuilder" />,
});

const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms',
  component: () => <UtilityScreen view="rooms" />,
});

const ladderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladder',
  component: () => <UtilityScreen view="ladder" />,
});

const replaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replays',
  component: () => <UtilityScreen view="replays" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <UtilityScreen view="settings" />,
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

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
