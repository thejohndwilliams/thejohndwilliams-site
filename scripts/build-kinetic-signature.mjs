// Build-time LUMINANCE signature derivation for the KineticPlate flagship.
//
// Reads the manifest (src/data/kinetic-plates.json) — the single source of
// truth for which photo fills each plate — and emits one square luminance
// frame per plate to src/data/kinetic-signature.json. Each frame records the
// RESOLVED source path (`src`) so the depth builder (build-kinetic-depth.py)
// reads the exact same file: Node is the only source-resolver, so luminance
// and depth can never drift onto different images.
//
// Companion: build-kinetic-depth.py (Z relief). Orchestrated by
// `npm run kinetic:build`; standalone: `node scripts/build-kinetic-signature.mjs`.
//
// Rec. 709 luminance weights: R=0.2126, G=0.7152, B=0.0722. Each frame is
// normalized to [0,1] by its own min/max so differing exposures read at
// comparable contrast.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PHOTO_DIR = path.join(ROOT, 'public/images/photography');
const PLATES_SRC = path.join(ROOT, 'plates-source'); // raw masters dropped here
const MANIFEST = path.join(ROOT, 'src/data/kinetic-plates.json');
const OUT_FILE = path.join(ROOT, 'src/data/kinetic-signature.json');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
const COLS = manifest.grid.cols;
const ROWS = manifest.grid.rows;
const R_W = 0.2126, G_W = 0.7152, B_W = 0.0722;

// Resolve a plate's `file` to a real image. A raw master dropped in
// plates-source/ wins (the quick-experiment path); otherwise the published
// gallery tiers. jpg/png/webp are decodable by BOTH sharp and the Python
// depth step, so prefer those for drop-ins (avif is sharp-only, last resort).
export function resolveSource(file) {
  const candidates = [
    path.join(PLATES_SRC, `${file}.webp`),
    path.join(PLATES_SRC, `${file}.jpg`),
    path.join(PLATES_SRC, `${file}.jpeg`),
    path.join(PLATES_SRC, `${file}.png`),
    path.join(PHOTO_DIR, 'hero', `${file}.webp`),
    path.join(PHOTO_DIR, 'gallery', `${file}.webp`),
    path.join(PHOTO_DIR, 'hero', `${file}.avif`),
    path.join(PHOTO_DIR, 'gallery', `${file}.avif`),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(
    `kinetic: no source for "${file}". Drop "${file}.{webp,jpg,png}" in plates-source/ ` +
    `or ingest it into public/images/photography/.`
  );
}

async function gridForImage(src) {
  const raw = await sharp(src)
    .resize(COLS, ROWS, { fit: 'cover', position: 'center' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const grid = new Float32Array(COLS * ROWS);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = (y * COLS + x) * 3;
      const l = raw[i] * R_W + raw[i + 1] * G_W + raw[i + 2] * B_W;
      grid[y * COLS + x] = l;
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  const range = Math.max(1e-6, max - min);
  const norm = new Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++) {
    norm[i] = Math.round(((grid[i] - min) / range) * 10000) / 10000;
  }
  return { min, max, grid: norm };
}

async function main() {
  const frames = [];
  for (const f of manifest.plates) {
    const abs = resolveSource(f.file);
    const src = path.relative(ROOT, abs); // repo-relative, portable for Python
    const { min, max, grid } = await gridForImage(abs);
    frames.push({ id: f.id, file: f.file, alt: f.alt, src, grid });
    console.error(`[kinetic:lum] ${f.id.padEnd(10)} ${f.file.padEnd(30)} min=${min.toFixed(1)} max=${max.toFixed(1)} src=${src}`);
  }

  const payload = {
    cols: COLS,
    rows: ROWS,
    source: {
      manifest: 'src/data/kinetic-plates.json',
      strategy: 'per-plate-featured-square',
      count: frames.length,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    frames,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload));
  console.error(`[kinetic:lum] wrote ${path.relative(ROOT, OUT_FILE)} -- ${frames.length} frames, ${COLS}x${ROWS}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
