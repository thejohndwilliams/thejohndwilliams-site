import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://thejohndwilliams.com',
  integrations: [tailwind()],
  output: 'static',
  build: {
    assets: '_assets'
  }
});
