// Vue app entrypoint for Astro islands (foundation proof, 2026-07-30).
// Registers the Quasar plugin so genuine Quasar components render inside
// Vue islands mounted by the existing Astro shell.
import type { App } from 'vue';
import { Quasar } from 'quasar';

export default (app: App) => {
  app.use(Quasar, {});
};
