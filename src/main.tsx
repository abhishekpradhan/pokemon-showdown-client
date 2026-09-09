import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from './components/error-boundary';
import { loadEngine } from './battle/engine';
import { loadDex } from './data/dex';
import { router } from './router';
import { registerClientWorker } from './pwa';
import { useArenaStore } from './stores/arena-store';
import './styles.css';

// Kick the dex and engine chunks off immediately; a battle can open within
// seconds of boot and neither request should wait on first render.
void loadDex().catch(() =>
  useArenaStore.setState({ sessionNotice: 'Pokémon data could not load. Reconnect and reload to retry.' }),
);

// The versioned worker preloads local tools and waits before applying an update.
window.addEventListener('load', () => {
  void registerClientWorker();
});
void loadEngine().catch(() =>
  useArenaStore.setState({
    sessionNotice: 'The battle engine could not load. Reload before joining a battle.',
  }),
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>,
);
