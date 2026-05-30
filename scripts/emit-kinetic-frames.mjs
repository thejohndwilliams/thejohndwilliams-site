// Emit per-frame KineticPlate geometry to public/data/kinetic/<id>.json.
//
// Splits src/data/kinetic-signature.json (4 frames, ~419 KB) into one JSON file
// per frame so KineticPlate.astro can lazy-fetch geometry instead of inlining a
// ~80-130 KB data-plate attribute into the HTML body. /about renders three
// plates, so this removes ~250 KB of raw HTML from that page alone.
//
// Wired into the `build` npm script BEFORE `astro build` so the files exist in
// public/ when Astro copies it to dist/. Output is gitignored (derived data;
// the source of truth is kinetic-signature.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/data/kinetic-signature.json');
const outDir = join(root, 'public/data/kinetic');

const sig = JSON.parse(readFileSync(src, 'utf-8'));
mkdirSync(outDir, { recursive: true });

let total = 0;
for (const frame of sig.frames) {
  const json = JSON.stringify({ cols: sig.cols, rows: sig.rows, grid: frame.grid, alt: frame.alt });
  writeFileSync(join(outDir, `${frame.id}.json`), json);
  total += json.length;
  console.log(`[kinetic] ${frame.id}.json  ${(json.length / 1024).toFixed(0)} KB`);
}
console.log(`[kinetic] wrote ${sig.frames.length} frames (${(total / 1024).toFixed(0)} KB) -> public/data/kinetic/`);
