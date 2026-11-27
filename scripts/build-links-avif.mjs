// AVIF companions for /links/ social row thumbnails (2026-11-26):
// scripts/build-small-variants.mjs emitted -240.webp and -240.jpg on 2026-11-25.
// Never overwrite existing /images/* files in place (1-year immutable edge cache);
// write only the new -240.avif siblings from the master hero JPEGs.
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const img = join(root, 'public/images');
const outDir = join(img, 'links');

mkdirSync(outDir, { recursive: true });
for (const name of ['linkedin', 'github', 'instagram', 'behance']) {
  const out = join(outDir, `${name}-240.avif`);
  if (existsSync(out)) continue;
  await sharp(join(img, `${name}-hero.jpg`))
    .resize(240, 240, { fit: 'inside', withoutEnlargement: true })
    .avif({ quality: 58, effort: 6 })
    .toFile(out);
}
console.log('[links-avif] wrote -240.avif thumbnails to public/images/links/');
