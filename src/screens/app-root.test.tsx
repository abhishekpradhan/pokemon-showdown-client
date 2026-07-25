import { render, screen } from '@testing-library/react';
import { RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppRoot } from './app-root';
import { HomeScreen } from './home-screen';

function renderWithRouter() {
  const rootRoute = createRootRoute({ component: AppRoot });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomeScreen,
  });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });
  return render(<RouterProvider router={router} />);
}

describe('modern app shell', () => {
  it('renders the cockpit shell and matchmaking workspace', async () => {
    renderWithRouter();
    expect(await screen.findByRole('heading', { name: /ready when you are/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByLabelText('Open sessions')).toBeInTheDocument();
  });
});
