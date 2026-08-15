import { defineConfig } from 'astro/config';
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
  vite: {
    build: {
      // Glass regression fix (2026-08-15): LightningCSS collapsed paired
      // backdrop-filter declarations to -webkit-only, and Chrome 151
      // removed the -webkit-backdrop-filter alias - most CSS glass was
      // silently dead in current Chrome on production. esbuild minifies
      // without prefix rewriting: both declarations survive, unprefixed
      // wins where both parse, -webkit- carries old Safari. Verified by
      // injected-stylesheet computed-style test in Chrome 151.
      cssMinify: 'esbuild',
    },
  },
  integrations: [
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
    // 'auto' — REVERTED from 'always' on 2026-07-02 after a production
    // incident. 'always' replaced the single site-wide external bundle with
    // per-page inline subsets: the photography lightbox's arbitrary-value
    // utilities (bg-[#0a0a0a]/92 and friends) did not survive the split on
    // ANY load path, and aborted view transitions (InvalidStateError on
    // every client-side nav) additionally dropped whole scoped <style> tags
    // during the head swap. Net effect: transparent lightbox backdrop with
    // a stray 40px blur, unstyled 96px controls, stuck placeholders. The
    // external shared bundle carries every rule and survives transitions.
    // Do NOT re-inline without an interaction-level regression test that
    // opens the lightbox after a view-transition navigation. If the ~13 KB
    // render-blocking <link> needs to go, pursue a critical-CSS split or an
    // Astro upgrade instead.
    inlineStylesheets: 'auto',
  },
});
