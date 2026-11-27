// Responsive AVIF + WebP tiers for Home's Connect bento (2026-11-26):
// Home's four Connect cards previously served single-size 1600px WebP/JPG
// (346 KB total, 210 KB for LinkedIn alone) even to 180x180 CSS-px phone slots.
// Emits new immutable paths under /images/connect/ without touching originals.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const img = join(root, 'public/images');
const outDir = join(img, 'connect');

mkdirSync(outDir, { recursive: true });
for (const name of ['linkedin', 'github', 'instagram', 'behance']) {
  const master = join(img, `${name}-hero.jpg`);
  for (const w of [400, 800, 1200, 1600]) {
    const resized = sharp(master).resize({ width: w, withoutEnlargement: true });
    await resized.clone().avif({ quality: 56, effort: 6 }).toFile(join(outDir, `${name}-${w}.avif`));
    await resized.clone().webp({ quality: 75 }).toFile(join(outDir, `${name}-${w}.webp`));
  }
}
console.log('[connect] wrote 400/800/1200/1600 AVIF + WebP tiers to public/images/connect/');
