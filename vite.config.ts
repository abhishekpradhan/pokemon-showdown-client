import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { productionBoundary } from './server/dev-api';
import { buildArtifacts } from './server/build-artifacts';

export default defineConfig(({ mode }) => {
  // Only explicitly selected server variables enter process.env; VITE_* values
  // remain Vite's public client configuration. Existing shell values win.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['PS_LOGIN_SERVER']) {
    if (env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), productionBoundary(), buildArtifacts(env)],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    build: {
      manifest: true,
      chunkSizeWarningLimit: 2_000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules') || id.includes('@pkmn')) return;
            if (id.includes('@tanstack')) return 'router';
            if (id.includes('@radix-ui')) return 'primitives';
            if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
          },
        },
      },
    },
    define: { __APP_ENV__: JSON.stringify(env.VITE_VERCEL_ENV || mode) },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    },
  };
});
