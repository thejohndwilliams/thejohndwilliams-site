import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://thejohndwilliams.com',
  integrations: [tailwind(), sitemap()],
  output: 'static',
  build: {
    assets: '_assets',
    // Inline small stylesheets to eliminate render-blocking CSS.
    // Bundles under this threshold get <style> inlined into the HTML; larger
    // ones keep their separate <link rel='stylesheet'>.
    inlineStylesheets: 'auto'
  }
});
