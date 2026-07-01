// @vitest-environment node
//
// Locks the KineticPlate geometry invariant the renderers rely on: for every
// plate in the manifest, the emitted per-frame JSON carries a luminance grid of
// exactly cols*rows cells and a depth array of the same length. A torn or
// missing depth grid would silently degrade the 3D flagship; this fails the
// gate instead. (Runs after `npm run build`, which emits public/data/kinetic/.)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/kinetic-plates.json'), 'utf-8'),
);
const dataDir = path.join(root, 'public/data/kinetic');

describe('kinetic plate geometry', () => {
  const cols = manifest.grid.cols as number;
  const rows = manifest.grid.rows as number;

  for (const plate of manifest.plates as Array<{ id: string }>) {
    it(`${plate.id}: luminance + depth grids exist and are aligned`, () => {
      const file = path.join(dataDir, `${plate.id}.json`);
      expect(fs.existsSync(file)).toBe(true);
      const d = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(d.grid.length).toBe(cols * rows);
      expect(Array.isArray(d.depth)).toBe(true);
      expect(d.depth.length).toBe(d.grid.length);
    });
  }

  it('manifest plate ids are unique', () => {
    const ids = (manifest.plates as Array<{ id: string }>).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
