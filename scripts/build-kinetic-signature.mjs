// Build-time luminance signature derivation from curated featured photos.
//
// Emits one square luminance frame per featured image (one per category).
// Each plate in the KineticPlate component pulls one matching frame and
// renders it as a dense dot grid with a traveling diagonal wave. The
// square grid preserves image aspect-proportional legibility per plate.
//
// Rec. 709 luminance weights: R=0.2126, G=0.7152, B=0.0722.
// Each frame is normalized to [0,1] by its own observed min/max so that
// frames with different overall exposure read at comparable contrast.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PHOTO_DIR = path.join(ROOT, 'public/images/photography');
const OUT_FILE = path.join(ROOT, 'src/data/kinetic-signature.json');

// Square 96x96 grid per plate. At a 280px plate surface this gives
// ~2.9px cell spacing -- dense enough that individual photographs read
// as shape rather than abstract noise.
const COLS = 96;
const ROWS = 96;
const R_W = 0.2126, G_W = 0.7152, B_W = 0.0722;

const FRAMES = [
  { id: 'sky',       file: '7r52326',              alt: 'Thunderheads against black sky' },
  { id: 'earth',     file: '7r51025-enhanced-sr',  alt: 'Rain-wet leaf in darkness' },
  { id: 'water',     file: '7r50674-enhanced-sr',  alt: 'El Arco de Cabo San Lucas' },
  { id: 'structure', file: 'img-7576-enhanced',    alt: 'Shanghai Tower from below' },
];

function resolveSource(file) {
  // Prefer hero (largest) -> gallery. Try webp then avif.
  const candidates = [
    path.join(PHOTO_DIR, 'hero',    `${file}.webp`),
    path.join(PHOTO_DIR, 'hero',    `${file}.avif`),
    path.join(PHOTO_DIR, 'gallery', `${file}.webp`),
    path.join(PHOTO_DIR, 'gallery', `${file}.avif`),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`No source file found for ${file}`);
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
  for (const f of FRAMES) {
    const src = resolveSource(f.file);
    const { min, max, grid } = await gridForImage(src);
    frames.push({ id: f.id, file: f.file, alt: f.alt, min, max, grid });
    console.error(`[kinetic] ${f.id.padEnd(10)} ${f.file.padEnd(32)} min=${min.toFixed(2)} max=${max.toFixed(2)} src=${path.basename(src)}`);
  }

  const payload = {
    cols: COLS,
    rows: ROWS,
    source: {
      corpus: 'public/images/photography',
      strategy: 'per-category-featured-square',
      count: frames.length,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    frames: frames.map(({ id, file, alt, grid }) => ({ id, file, alt, grid })),
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload));
  console.error(`[kinetic] wrote ${OUT_FILE} -- ${frames.length} frames, ${COLS}x${ROWS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
