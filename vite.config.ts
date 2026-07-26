import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const PS_LOGIN_SERVER = process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php';

const psLoginProxy = {
  target: new URL(PS_LOGIN_SERVER).origin,
  changeOrigin: true,
  rewrite: () => new URL(PS_LOGIN_SERVER).pathname,
};

const PS_REPLAY_SERVER = process.env.PS_REPLAY_SERVER || 'https://replay.pokemonshowdown.com';

const psReplayProxy = {
  target: PS_REPLAY_SERVER,
  changeOrigin: true,
  rewrite: () => '/api/replays/upload',
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Mirrors the /api/action serverless function so dev and production share
    // one code path. action.php sends no CORS headers, so it cannot be called
    // from the browser directly.
    proxy: { '/api/action': psLoginProxy, '/api/replay': psReplayProxy },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/api/action': psLoginProxy, '/api/replay': psReplayProxy },
  },
  build: {
    // The dex chunk is legitimately ~1.8MB raw. It is lazy-loaded and cached
    // for a year, so warning on it every build is just noise.
    chunkSizeWarningLimit: 2_000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // @pkmn is deliberately left alone. data/dex.ts imports it
          // dynamically, and learnsets is a further dynamic import inside it;
          // naming a chunk here would flatten those into one 5MB download.
          if (id.includes('@pkmn')) return;
          if (id.includes('@tanstack')) return 'router';
          if (id.includes('@radix-ui')) return 'primitives';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
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
