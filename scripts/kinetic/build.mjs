// One-command (re)build of the KineticPlate geometry from the manifest.
//
//   npm run kinetic:build
//
// Chains the whole pipeline: luminance (Node/sharp) -> depth (venv/onnx) ->
// per-frame emit -> alignment validation. Run this after editing
// src/data/kinetic-plates.json or dropping a new photo in plates-source/.
// Requires `npm run kinetic:setup` once first.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KDIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(KDIR, '..', '..');
const PY = join(KDIR, '.venv', 'bin', 'python');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/kinetic-plates.json'), 'utf-8'));
const MODEL_PATH = join(KDIR, '.cache', manifest.depthModel.file);

if (!existsSync(PY) || !existsSync(MODEL_PATH)) {
  console.error('kinetic: environment not provisioned. Run `npm run kinetic:setup` first.');
  process.exit(1);
}

function step(label, cmd, args, extraEnv = {}) {
  console.log(`\n▶ ${label}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, ...extraEnv } });
}

step('luminance', 'node', ['scripts/build-kinetic-signature.mjs']);
step('depth', PY, ['scripts/build-kinetic-depth.py'], { KINETIC_DEPTH_MODEL: MODEL_PATH });
step('emit per-frame geometry', 'node', ['scripts/emit-kinetic-frames.mjs']);

// Validate: every plate's emitted JSON must be grid- and depth-aligned. This is
// the invariant the renderer relies on; fail loud rather than ship a torn cloud.
console.log('\n▶ validate alignment');
const { cols, rows } = manifest.grid;
let failures = 0;
for (const p of manifest.plates) {
  const f = join(ROOT, 'public/data/kinetic', `${p.id}.json`);
  if (!existsSync(f)) { console.error(`  ✗ ${p.id}: missing ${f}`); failures++; continue; }
  const d = JSON.parse(readFileSync(f, 'utf-8'));
  const gridOk = d.grid?.length === cols * rows;
  const depthOk = Array.isArray(d.depth) && d.depth.length === d.grid.length;
  if (!gridOk || !depthOk) {
    console.error(`  ✗ ${p.id}: grid=${d.grid?.length} depth=${d.depth?.length} expected ${cols * rows}`);
    failures++;
  } else {
    console.log(`  ✓ ${p.id}: ${d.grid.length} cells, depth aligned`);
  }
}
if (failures) { console.error(`\nkinetic: ${failures} plate(s) failed validation.`); process.exit(1); }
console.log(`\nkinetic: ${manifest.plates.length} plates built + validated. Previews in .kinetic-depth-preview/.`);
