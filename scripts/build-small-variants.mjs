// Small variants for two fixed-size slots (2026-11-25 web-perf pass):
// - Links row thumbnails show the social heroes at about 92x52 CSS px but
//   served the 900-1200 px originals (LinkedIn alone 211 KB on a phone).
// - The Home relief card served one 1280 px bitmap to a 380 px phone slot.
// New names only: /images is immutable for a year at the edge.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const img = join(root, 'public/images');

mkdirSync(join(img, 'links'), { recursive: true });
for (const name of ['linkedin', 'github', 'instagram', 'behance']) {
  const src = sharp(join(img, `${name}-hero.jpg`)).resize(240, 240, { fit: 'inside', withoutEnlargement: true });
  await src.clone().webp({ quality: 74 }).toFile(join(img, 'links', `${name}-240.webp`));
  await src.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(join(img, 'links', `${name}-240.jpg`));
}

const card = sharp(join(img, 'relief', 'card.webp')).resize(800, 500, { fit: 'inside', withoutEnlargement: true });
await card.clone().avif({ quality: 58, effort: 6 }).toFile(join(img, 'relief', 'card-800.avif'));
await card.clone().webp({ quality: 74 }).toFile(join(img, 'relief', 'card-800.webp'));
console.log('[small] links thumbs + relief card-800');
