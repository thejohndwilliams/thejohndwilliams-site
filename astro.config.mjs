import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { categories } from './src/data/photography.ts';

const SITE = 'https://thejohndwilliams.com';

// Build a dedup'd map of canonical photograph entries for image sitemap augmentation.
// First-seen-wins mirrors the slug lookup semantics in src/data/photography.ts.
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
  integrations: [
    tailwind(),
    sitemap({
      // Keep unlinked preview/lab routes out of the production sitemap.
      filter: (page) => !page.includes('/about-lab'),
      // Google Images sitemap enrichment: attach <image:image> entries to
      // photography URLs so the gallery is discovered as images (not just HTML).
      serialize(item) {
        if (!item.url.startsWith(`${SITE}/photography`)) return item;

        // Gallery index: attach all canonical photographs.
        if (item.url === `${SITE}/photography/` || item.url === `${SITE}/photography`) {
          item.img = canonicalPhotos.map(p => ({
            url: `${SITE}/images/photography/hero/${p.file}.webp`,
            caption: p.alt,
            title: `${p.alt} — ${p.category}`,
            license: `${SITE}/photography`,
          }));
          return item;
        }

        // Detail page: attach the single photograph for this slug.
        const m = item.url.match(/\/photography\/([^/]+)\/?$/);
        if (m) {
          const slug = m[1];
          const photo = canonicalPhotos.find(p => p.file === slug);
          if (photo) {
            item.img = [{
              url: `${SITE}/images/photography/hero/${photo.file}.webp`,
              caption: photo.alt,
              title: `${photo.alt} — ${photo.category}`,
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
    // 'always': the shared CSS bundle (~13 KB) sat above Astro's 'auto'
    // inline threshold and shipped as a render-blocking <link>, costing
    // ~1.2 s of mobile LCP (Lighthouse, 2026-07-01). Inlining trades
    // repeat-view CSS caching (~4 KB brotli per page) for first-paint
    // speed — the right trade for a portfolio found via shared links.
    inlineStylesheets: 'always',
  },
});
