// Idempotent provisioning for the KineticPlate depth pipeline.
//
//   npm run kinetic:setup
//
// Creates an isolated Python venv, installs the depth deps (onnxruntime, numpy,
// pillow — no PyTorch, nothing touching system Python), and downloads + verifies
// the ONNX depth model into a local cache. Re-running is a no-op once each piece
// is in place. This is the step that removes the "figure out the environment"
// friction: one command, repeatable, self-checking.
//
// Why a model download and not a bundled file: the 99MB ONNX weights are too
// large to commit; the COMMITTED artifact is src/data/kinetic-depth.json (the
// derived depth grids), which is all the browser ever needs.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KDIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(KDIR, '..', '..');
const VENV = join(KDIR, '.venv');
const CACHE = join(KDIR, '.cache');
const PY = join(VENV, 'bin', 'python');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/kinetic-plates.json'), 'utf-8'));
const model = manifest.depthModel;
const MODEL_PATH = join(CACHE, model.file);

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}
function ok(label) { console.log(`  ✓ ${label}`); }

function ensurePython3() {
  try { execFileSync('python3', ['--version'], { stdio: 'ignore' }); }
  catch { throw new Error('python3 not found on PATH. Install Python 3, then re-run.'); }
}

function ensureVenv() {
  if (existsSync(PY)) { ok('venv'); return; }
  console.log('  · creating venv (scripts/kinetic/.venv)');
  run('python3', ['-m', 'venv', VENV]);
  ok('venv created');
}

function ensureDeps() {
  try {
    execFileSync(PY, ['-c', 'import onnxruntime, numpy, PIL'], { stdio: 'ignore' });
    ok('python deps (onnxruntime, numpy, pillow)');
    return;
  } catch { /* not installed yet */ }
  console.log('  · installing onnxruntime, numpy, pillow');
  run(PY, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']);
  run(PY, ['-m', 'pip', 'install', '-q', 'onnxruntime', 'numpy', 'pillow']);
  ok('python deps installed');
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function ensureModel() {
  if (existsSync(MODEL_PATH) && statSync(MODEL_PATH).size === model.bytes) {
    if (!model.sha256 || sha256(MODEL_PATH) === model.sha256) { ok(`model (${model.file})`); return; }
    console.log('  · cached model failed checksum, re-downloading');
  }
  mkdirSync(CACHE, { recursive: true });
  console.log(`  · downloading ${model.name} (${(model.bytes / 1e6).toFixed(0)}MB)`);
  run('curl', ['-L', '--fail', '--retry', '2', '-o', MODEL_PATH, model.url]);
  const size = statSync(MODEL_PATH).size;
  if (size !== model.bytes) throw new Error(`model size ${size} != expected ${model.bytes}`);
  if (model.sha256 && sha256(MODEL_PATH) !== model.sha256) throw new Error('model sha256 mismatch');
  ok(`model downloaded + verified (${model.file})`);
}

console.log('kinetic:setup');
ensurePython3();
ensureVenv();
ensureDeps();
ensureModel();
console.log('\nReady. Run `npm run kinetic:build` to (re)derive luminance + depth from the manifest.');
