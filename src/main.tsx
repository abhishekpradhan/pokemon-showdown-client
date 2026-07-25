import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from './components/error-boundary';
import { loadEngine } from './battle/engine';
import { loadDex } from './data/dex';
import { router } from './router';
import './styles.css';

// Kick the dex and engine chunks off immediately; a battle can open within
// seconds of boot and neither request should wait on first render.
void loadDex();
void loadEngine();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
);
