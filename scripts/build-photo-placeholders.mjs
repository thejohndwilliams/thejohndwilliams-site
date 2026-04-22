#!/usr/bin/env node
/**
 * Generate photo placeholders: intrinsic width/height + a tiny base64 LQIP.
 *
 * Input:  public/images/photography/gallery/*.webp  (1200w masters)
 * Output: src/data/photo-placeholders.json
 *
 * Shape: { [basename]: { width, height, lqip } }
 *   - width/height are the ORIGINAL masters' dimensions (from gallery/1200w).
 *     Used to set <img width/height> and eliminate CLS.
 *   - lqip is a ~20px-wide base64 WebP, ~200 bytes. Rendered as CSS
 *     background-image under each <picture> for a soft first paint.
 *
 * Idempotent: re-run whenever the gallery/ tree changes. Committed so the
 * render path doesn't need a runtime image dependency.
 */
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GALLERY = join(ROOT, 'public/images/photography/gallery');
const OUT = join(ROOT, 'src/data/photo-placeholders.json');

async function main() {
  if (!existsSync(GALLERY)) {
    console.error(`missing gallery dir: ${GALLERY}`);
    process.exit(1);
  }
  const files = (await readdir(GALLERY)).filter(f => f.endsWith('.webp'));
  console.log(`processing ${files.length} gallery masters...`);

  const out = {};
  for (const f of files) {
    const file = basename(f, extname(f));
    const p = join(GALLERY, f);
    try {
      const img = sharp(p);
      const meta = await img.metadata();
      const lqipBuf = await sharp(p)
        .resize(20, null, { fit: 'inside' })
        .webp({ quality: 40, effort: 6 })
        .toBuffer();
      out[file] = {
        width: meta.width,
        height: meta.height,
        lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
      };
    } catch (err) {
      console.error(`failed on ${f}:`, err.message);
      process.exitCode = 1;
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  // Sort keys for deterministic diffs.
  const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
  await writeFile(OUT, JSON.stringify(sorted, null, 2) + '\n');

  const sizes = Object.values(sorted).map(v => v.lqip.length);
  const avgBytes = Math.round(sizes.reduce((a,b)=>a+b,0) / sizes.length);
  console.log(`wrote ${Object.keys(sorted).length} entries to ${OUT}`);
  console.log(`avg LQIP size: ${avgBytes} bytes`);
}

main().catch(e => { console.error(e); process.exit(1); });
