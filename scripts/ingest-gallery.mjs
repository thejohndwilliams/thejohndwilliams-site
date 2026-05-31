// Curated gallery ingest — turn selected master photographs into the site's
// 3-tier web image stack (thumb 400 / gallery 1200 / hero 2400, AVIF+WebP) plus
// a build-time LQIP, and print a manifest you fold into src/data/photography.ts.
//
// Usage:
//   node scripts/ingest-gallery.mjs --src <dir> --cat <sky|earth|water|structure|light> file1.jpg [file2.jpg ...]
//
// Behavior:
//   • Derives a clean slug from each source name (camera token like 7r52086 /
//     dscf0056 / img-7029, else a stable gv-<hash> fallback).
//   • Skips any slug whose hero/<slug>.webp already exists (dedupe vs live).
//   • Single-threaded libvips (sharp.concurrency(1), cache off) so gigapixel
//     Topaz masters don't OOM; resumable (re-run to continue).
//   • Prints manifest rows {file, orientation} + writes LQIP into
//     src/data/photo-placeholders.json.
//
// Scale note: at ~0.45 MB/image these tiers are repo-fine for a curated set.
// For the full archive, point the same outputs at Cloudflare R2 (source:'r2'
// in photography.ts) — see docs/r2-migration-runbook.md. This script is the
// shared feeder for both paths.
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
sharp.concurrency(1); sharp.cache(false);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const srcDir = opt('--src', '.');
const files = args.filter(a => /\.(jpe?g|png|tiff?)$/i.test(a));
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/images/photography');
const PH = join(root, 'src/data/photo-placeholders.json');

const slugOf = (name) => {
  const raw = name.replace(/\.[^.]+$/, '');
  const m = raw.match(/(7r\d{4,5}|dscf\d{3,5}|dsc[-_]?\d{3,5}|img[-_]?\d{3,5})/i);
  if (m) return m[1].toLowerCase().replace(/_/g, '-').replace(/^dsc(\d)/, 'dsc-$1').replace(/^img(\d)/, 'img-$1');
  const u = raw.match(/^([0-9a-f]{8})/i);
  return u ? `gv-${u[1].toLowerCase()}` : 'gv-' + raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 16);
};
const tiers = [['hero', 2400], ['gallery', 1200], ['thumb', 400]];
const ph = existsSync(PH) ? JSON.parse(readFileSync(PH, 'utf-8')) : {};
const rows = [];
for (const f of files) {
  const slug = slugOf(f);
  if (existsSync(join(OUT, 'hero', `${slug}.webp`))) { console.error(`skip (live): ${slug}`); continue; }
  const big = await sharp(join(srcDir, f), { limitInputPixels: false }).rotate()
    .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const meta = await sharp(big).metadata();
  for (const [dir, px] of tiers) {
    const r = sharp(big).resize(px, px, { fit: 'inside', withoutEnlargement: true });
    await r.clone().avif({ quality: dir === 'thumb' ? 52 : 58 }).toFile(join(OUT, dir, `${slug}.avif`));
    await r.clone().webp({ quality: dir === 'thumb' ? 60 : 74 }).toFile(join(OUT, dir, `${slug}.webp`));
  }
  const lqip = await sharp(big).resize(24).webp({ quality: 32 }).toBuffer();
  const s = Math.min(1200 / meta.width, 1200 / meta.height, 1);
  ph[slug] = { width: Math.round(meta.width * s), height: Math.round(meta.height * s), lqip: `data:image/webp;base64,${lqip.toString('base64')}` };
  rows.push({ file: slug, orientation: meta.width >= meta.height ? 'landscape' : 'portrait' });
  console.error(`ok: ${slug}`);
}
writeFileSync(PH, JSON.stringify(ph, null, 2) + '\n');
console.log(JSON.stringify(rows, null, 2));
