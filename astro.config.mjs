import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { categories } from './src/data/photography.ts';

const SITE = 'https://thejohndwilliams.com';

const seenFiles = new Set();
const canonicalPhotos = [];
for (const cat of categories) {
  for (const img of cat.images) {
    if (seenFiles.has(img.file)) continue;
    seenFiles.add(img.file);
    canonicalPhotos.push({ file: img.file, alt: img.alt, category: cat.name });
  }
}

export default defineConfig({
  site: SITE,
  vite: {
    build: {
      cssMinify: 'esbuild',
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/about-lab') && !page.includes('/glass-lab'),
      serialize(item) {
        if (!item.url.startsWith(`${SITE}/photography`)) return item;

        if (item.url === `${SITE}/photography/` || item.url === `${SITE}/photography`) {
          item.img = canonicalPhotos.map(p => ({
            url: `${SITE}/images/photography/hero/${p.file}.webp`,
            caption: p.alt,
            title: `${p.alt} - ${p.category}`,
            license: `${SITE}/photography`,
          }));
          return item;
        }

        const m = item.url.match(/\/photography\/([^/]+)\/?$/);
        if (m) {
          const slug = m[1];
          const photo = canonicalPhotos.find(p => p.file === slug);
          if (photo) {
            item.img = [{
              url: `${SITE}/images/photography/hero/${photo.file}.webp`,
              caption: photo.alt,
              title: `${photo.alt} - ${photo.category}`,
              license: `${SITE}/photography`,
            }];
          }
        }
        return item;
      },
    }),
  ],
  output: 'static',
  build: {
    assets: '_assets',
    inlineStylesheets: 'auto',
  },
});
