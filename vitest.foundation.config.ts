// Standalone vitest config for the foundation-proof test only (throwaway
// branch). Adds the Vue SFC compiler without touching the main test config.
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const quasarEsm = fileURLToPath(
  new URL('./node_modules/quasar/dist/quasar.client.js', import.meta.url)
);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Node export conditions hand vitest quasar.server.prod.js, whose
    // install() demands Quasar's own SSR context. Pin the browser ESM build
    // with an exact-match alias so quasar/* subpath imports stay untouched.
    alias: [{ find: /^quasar$/, replacement: quasarEsm }],
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/foundation-proof.test.ts'],
  },
});
