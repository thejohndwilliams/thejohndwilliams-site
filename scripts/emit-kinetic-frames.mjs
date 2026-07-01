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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/data/kinetic-signature.json');
const depthFile = join(root, 'src/data/kinetic-depth.json');
const outDir = join(root, 'public/data/kinetic');

const sig = JSON.parse(readFileSync(src, 'utf-8'));
const manifest = JSON.parse(readFileSync(join(root, 'src/data/kinetic-plates.json'), 'utf-8'));
const globalFade = manifest.render?.depthFade ?? 0;
const fadeById = {};
for (const p of manifest.plates) fadeById[p.id] = typeof p.depthFade === 'number' ? p.depthFade : globalFade;
mkdirSync(outDir, { recursive: true });

// Optional monocular depth (built by scripts/build-kinetic-depth.py). When
// present, each plate gains a per-cell `depth` array the 3D renderer reads as
// true Z relief. Absent -> the 3D renderer falls back to luminance-as-depth and
// the 2.5D renderer is unaffected. Derived data: public/data is gitignored.
const depthById = {};
if (existsSync(depthFile)) {
  const dep = JSON.parse(readFileSync(depthFile, 'utf-8'));
  for (const f of dep.frames) depthById[f.id] = f.depth;
  console.log(`[kinetic] depth loaded for ${Object.keys(depthById).length} frames`);
}

let total = 0;
for (const frame of sig.frames) {
  const depth = depthById[frame.id];
  const depthFade = fadeById[frame.id] ?? 0;
  const payload = depth
    ? { cols: sig.cols, rows: sig.rows, grid: frame.grid, depth, depthFade, alt: frame.alt }
    : { cols: sig.cols, rows: sig.rows, grid: frame.grid, depthFade, alt: frame.alt };
  const json = JSON.stringify(payload);
  writeFileSync(join(outDir, `${frame.id}.json`), json);
  total += json.length;
  console.log(`[kinetic] ${frame.id}.json  ${(json.length / 1024).toFixed(0)} KB${depth ? ' (+depth)' : ''}`);
}
console.log(`[kinetic] wrote ${sig.frames.length} frames (${(total / 1024).toFixed(0)} KB) -> public/data/kinetic/`);
