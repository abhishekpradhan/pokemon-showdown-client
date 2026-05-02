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
  it('renders the arena workspace and source link', async () => {
    renderWithRouter();
    expect(await screen.findByRole('heading', { name: /showdown arena/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute(
      'href',
      'https://github.com/abhishekpradhan/pokemon-showdown-client'
    );
  });
});
