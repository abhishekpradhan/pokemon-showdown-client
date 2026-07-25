import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from './components/error-boundary';
import { loadDex } from './data/dex';
import { router } from './router';
import './styles.css';

// Kick the dex chunk off immediately; it is needed as soon as a battle opens
// and the request should not wait on first render.
void loadDex();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
);
