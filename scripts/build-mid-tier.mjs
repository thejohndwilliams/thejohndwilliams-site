// Mid tier: every photograph fit inside an 800 px square, between thumb (400)
// and gallery (1200). Phones at DPR 1.75 to 3 put a half-width card or grid
// cell at 320 to 550 device pixels; with only 400 and 1200 on offer they
// downloaded the 1200 file (2026-11-25 web-perf pass, Lighthouse mobile).
// Source is the hero tier (the best derivative committed). New directory,
// new URLs: /images is immutable for a year, never overwrite a file there.
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'public/images/photography');
const out = join(base, 'mid');
mkdirSync(out, { recursive: true });
const force = process.argv.includes('--force');

let made = 0;
for (const name of readdirSync(join(base, 'hero'))) {
  if (!name.endsWith('.webp')) continue;
  const stem = name.slice(0, -5);
  const avif = join(out, `${stem}.avif`);
  const webp = join(out, `${stem}.webp`);
  if (!force && existsSync(avif) && existsSync(webp)) continue;
  const img = sharp(join(base, 'hero', name)).resize(800, 800, { fit: 'inside', withoutEnlargement: true });
  await img.clone().avif({ quality: 55, effort: 6 }).toFile(avif);
  await img.clone().webp({ quality: 72 }).toFile(webp);
  made++;
}
console.log(`[mid] wrote ${made} photographs`);
