#!/usr/bin/env node
/**
 * build-relief-assets.mjs
 *
 * Encodes the /relief page's still assets to the site's AVIF + WebP pair, at
 * the same quality settings ingest-gallery.mjs uses for the gallery tier
 * (avif q58 / webp q74), so the relief studies sit at the same fidelity as
 * the photographs beside them.
 *
 * INPUT is a directory of clean, unlabelled PNG renders produced outside this
 * repo by the object-axis renderer (relief_render.py + build_web_relief_assets.py,
 * filed with the Edition and Format Specification). The renderer needs a
 * panel-resolution depth pass and a 900 KB luminance plate per frame; neither
 * belongs in the repo, so this script takes the renders as given and only
 * handles the web encode.
 *
 *   node scripts/build-relief-assets.mjs <render-dir>
 *
 * Expects <render-dir> to contain:
 *   depth/{1,2,3,4,6,9,14}.png   one panel, seven candidate relief depths
 *   size/{16x20,20x24,24x36}.png three editions at true relative pixel scale
 *   poster.png                   first frame of the sweep
 *
 * Writes public/images/relief/*.{avif,webp}. The sweep video itself is copied
 * in by hand (public/video/relief-sweep.mp4); ffmpeg is not a repo dependency.
 */
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('usage: node scripts/build-relief-assets.mjs <render-dir>');
  process.exit(1);
}
const OUT = join(process.cwd(), 'public', 'images', 'relief');
mkdirSync(OUT, { recursive: true });

const jobs = [];
for (const f of readdirSync(join(SRC, 'depth'))) {
  if (f.endsWith('.png')) jobs.push([join(SRC, 'depth', f), `depth-${basename(f, '.png')}mm`]);
}
for (const f of readdirSync(join(SRC, 'size'))) {
  if (f.endsWith('.png')) jobs.push([join(SRC, 'size', f), `edition-${basename(f, '.png')}`]);
}
if (existsSync(join(SRC, 'poster.png'))) jobs.push([join(SRC, 'poster.png'), 'sweep-still']);

let bytes = 0;
for (const [src, slug] of jobs) {
  const r = sharp(src);
  const { width, height } = await r.metadata();
  const a = await r.clone().avif({ quality: 58 }).toFile(join(OUT, `${slug}.avif`));
  const w = await r.clone().webp({ quality: 74 }).toFile(join(OUT, `${slug}.webp`));
  bytes += a.size + w.size;
  console.error(`ok: ${slug}  ${width}x${height}  avif ${(a.size / 1024) | 0} KB  webp ${(w.size / 1024) | 0} KB`);
}
console.error(`${jobs.length} renders, ${(bytes / 1024) | 0} KB total`);
