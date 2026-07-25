import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const PS_LOGIN_SERVER = process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php';

const psLoginProxy = {
  target: new URL(PS_LOGIN_SERVER).origin,
  changeOrigin: true,
  rewrite: () => new URL(PS_LOGIN_SERVER).pathname,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Mirrors the /api/action serverless function so dev and production share
    // one code path. action.php sends no CORS headers, so it cannot be called
    // from the browser directly.
    proxy: { '/api/action': psLoginProxy },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/api/action': psLoginProxy },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['@tanstack/react-router'],
          primitives: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          motion: ['motion'],
        },
      },
    },
  },
  define: {
    __APP_ENV__: JSON.stringify(process.env.VITE_VERCEL_ENV || process.env.NODE_ENV || 'development'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
