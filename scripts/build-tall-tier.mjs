// Tall tier: portrait photographs at 1000 px wide (2026-11-25 web-perf pass).
// A portrait photo filling a phone's width needs about 720 device px at DPR
// 1.75. The portrait gallery tier is 675 px wide (fit inside 1200), just
// short, so phones jumped to the 1349 px hero: about twice the bytes. No crop
// and no new framing: the same photograph, one more width. Landscape photos
// are already covered by mid (800) and gallery (1200). New directory, new
// URLs: /images is immutable for a year at the edge.
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'public/images/photography');
const out = join(base, 'tall');
mkdirSync(out, { recursive: true });

let made = 0;
for (const name of readdirSync(join(base, 'hero'))) {
  if (!name.endsWith('.webp')) continue;
  const stem = name.slice(0, -5);
  const src = join(base, 'hero', name);
  const { width = 0, height = 0 } = await sharp(src).metadata();
  if (height <= width || width <= 1050) continue;
  const avif = join(out, `${stem}.avif`);
  const webp = join(out, `${stem}.webp`);
  if (existsSync(avif) && existsSync(webp)) continue;
  const img = sharp(src).resize({ width: 1000, withoutEnlargement: true });
  await img.clone().avif({ quality: 55, effort: 6 }).toFile(avif);
  await img.clone().webp({ quality: 72 }).toFile(webp);
  made++;
}
console.log(`[tall] wrote ${made} portrait photographs`);
