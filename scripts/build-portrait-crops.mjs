// Art-directed portrait crops for full-bleed brand heroes on phones (<=640px).
// Subject-aware (sharp attention) 3:4 crop of the landscape hero, AVIF + WebP,
// into public/images/photography/portrait/. Committed assets (like the tiers).
// Excludes /photography/[slug] heroes — those ARE the artwork; never recrop them.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'public/images/photography/hero');
const outDir = join(root, 'public/images/photography/portrait');
mkdirSync(outDir, { recursive: true });

const HEROES = ['7r52326', 'john-portrait-bw', 'img-1066'];
const W = 1080, H = 1440; // 3:4 portrait, full-bleed phone hero

for (const f of HEROES) {
  const src = join(srcDir, `${f}.webp`);
  const cropped = sharp(src).resize(W, H, { fit: 'cover', position: sharp.strategy.attention });
  await cropped.clone().avif({ quality: 62 }).toFile(join(outDir, `${f}.avif`));
  await cropped.clone().webp({ quality: 74 }).toFile(join(outDir, `${f}.webp`));
  console.log(`[portrait] ${f} -> ${W}x${H} (avif+webp)`);
}
