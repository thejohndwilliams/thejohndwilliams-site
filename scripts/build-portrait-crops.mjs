// Art-directed portrait crops for full-bleed brand heroes on phones (<=640px).
// Subject-aware (sharp attention) 3:4 crop of the landscape hero, AVIF + WebP,
// into public/images/photography/portrait/. Committed assets (like the tiers).
// Excludes /photography/[slug] heroes. Those ARE the artwork; never recrop them.
//
// The crop is the largest 3:4 rectangle that fits inside the hero derivative.
// withoutEnlargement is load-bearing: a short hero must not be scaled up to
// invent pixels. Where this still falls short of a phone DPR slot, the photo
// is listed for re-export from the master rather than upscaled here.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'public/images/photography/hero');
const outDir = join(root, 'public/images/photography/portrait');
mkdirSync(outDir, { recursive: true });

const HEROES = ['7r52326', 'john-portrait-bw', 'img-1066'];

for (const f of HEROES) {
  const src = join(srcDir, `${f}.webp`);
  const meta = await sharp(src).metadata();
  const srcW = meta.width || 0;
  const srcH = meta.height || 0;
  const maxW = Math.floor(Math.min(srcW, srcH * 3 / 4));
  const maxH = Math.floor(maxW * 4 / 3);
  const cropped = sharp(src).resize(maxW, maxH, {
    fit: 'cover',
    position: sharp.strategy.attention,
    withoutEnlargement: true,
  });
  await cropped.clone().avif({ quality: 62 }).toFile(join(outDir, `${f}.avif`));
  await cropped.clone().webp({ quality: 74 }).toFile(join(outDir, `${f}.webp`));
  console.log(`[portrait] ${f} -> ${maxW}x${maxH} from ${srcW}x${srcH} (avif+webp)`);
}
