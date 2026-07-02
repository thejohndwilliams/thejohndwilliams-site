#!/usr/bin/env node
/**
 * build-og-images.mjs
 *
 * Per-photo Open Graph image generator (Tier 2 item 3).
 *
 * Reads categories from src/data/photography.ts, iterates every canonical
 * slug (first-seen-wins — matches the /photography/[slug] routing contract),
 * composites the hero WebP under an SVG overlay (category eyebrow + title +
 * site mark on a graded dark vignette), and writes a 1200×630 JPEG to
 * dist/og/photography/<file>.jpg. Also renders four page-level OG images
 * (home / photography / work / about) to dist/og/pages/<slug>.jpg so the
 * top-level pages get the same JPEG floor-compatibility as photo unfurls.
 *
 * Why 1200×630 JPEG and not 2400×1600 WebP:
 *   - 1200×630 is the Twitter / Facebook / LinkedIn / Slack / iMessage
 *     canonical OG ratio. Larger assets are server-downscaled (wasted bytes)
 *     or rejected outright.
 *   - LinkedIn and some Messages builds still do not render WebP in link
 *     unfurls. JPEG is the floor-compatible format. Quality 85 + mozjpeg
 *     keeps each file ~75–120 KB.
 *
 * Dependency footprint: sharp only (already a devDependency). No Satori,
 * no @resvg/resvg-js, no headless browser. The SVG overlay is rendered
 * directly by libvips via sharp.composite().
 */

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PHOTOGRAPHY_TS = path.join(ROOT, 'src/data/photography.ts');
const HERO_DIR = path.join(ROOT, 'public/images/photography/hero');
const OUT_DIR = path.join(ROOT, 'dist/og/photography');
const PAGES_OUT_DIR = path.join(ROOT, 'dist/og/pages');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const JPEG_QUALITY = 85;

/**
 * Parse photography.ts without importing it (avoids a ts-node / tsc
 * dependency in the build pipeline). The file is machine-authored with
 * predictable formatting; regex-parsing the category + image literals is
 * sturdier than an AST walk for this narrow case.
 *
 * First-seen-wins dedup mirrors the slug resolution in
 * src/data/photography.ts:getPhotoBySlug().
 */
async function parsePhotographyManifest() {
  const src = await fs.readFile(PHOTOGRAPHY_TS, 'utf8');

  // Split on the category literal opener; the first chunk is the preamble.
  const categoryChunks = src.split(/\{\s*\n\s*id:\s*'/).slice(1);
  const seen = new Set();
  const photos = [];

  for (const chunk of categoryChunks) {
    // category id is everything up to the first closing quote.
    const idMatch = chunk.match(/^([^']+)'/);
    const nameMatch = chunk.match(/name:\s*'([^']+)'/);
    if (!idMatch || !nameMatch) continue;
    const categoryName = nameMatch[1];

    // image literals: { file: '...', alt: '...', ... }
    const imageRegex = /\{\s*file:\s*'([^']+)',\s*alt:\s*'([^']+)'/g;
    let m;
    while ((m = imageRegex.exec(chunk)) !== null) {
      const file = m[1];
      const alt = m[2];
      if (seen.has(file)) continue; // first-seen-wins
      seen.add(file);
      photos.push({ file, alt, categoryName });
    }
  }

  return photos;
}

/**
 * XML-escape a string for safe embedding in SVG text nodes.
 * Curly quotes, em-dashes, and ampersands in alt text would otherwise
 * break the overlay SVG.
 */
function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap a title to fit the OG canvas at ~52px serif.
 * Rough heuristic: ~22 chars per line at this weight/size.
 * Max 2 lines; truncate with ellipsis if longer.
 */
function wrapTitle(title, maxCharsPerLine = 28, maxLines = 2) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const next = current ? current + ' ' + w : w;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

/**
 * Build the SVG overlay for a given photograph.
 *
 * Design:
 *   - Left-side dark gradient scrim so text is legible regardless of
 *     how bright the underlying photo is at that region.
 *   - Blue-hour hairline rule above the eyebrow (same 1px discipline as
 *     site nav). Palette note 2026-07-01: was gold #B8973F from the retired
 *     gold era; corrected to navy-hour #7E9CB8 per the standing register
 *     rule (ink and ivory, no metallic ornament).
 *   - Eyebrow: category name, IBM Plex Sans fallback, letterspaced uppercase.
 *   - Title: alt text in EB Garamond fallback (Libre Baskerville is
 *     deprecated), display serif, tight.
 *   - Site mark bottom-left: thejohndwilliams.com in muted cream.
 *
 * Font fallback: libvips/librsvg will substitute a generic serif and
 * sans-serif if the specific families aren't installed on the build
 * machine. Cloudflare Pages build image has DejaVu family which
 * matches close enough for OG unfurls — these are marketing surfaces,
 * not pixel-perfect body copy.
 */
function buildOverlaySvg({ title, categoryName }) {
  const titleLines = wrapTitle(title);
  const titleLineHeight = 62;
  const titleFontSize = 52;

  // Title Y anchor — start from bottom, stack upward.
  const titleBaselineBottom = 420;
  const firstLineY = titleBaselineBottom - (titleLines.length - 1) * titleLineHeight;

  const eyebrowY = firstLineY - titleFontSize - 24;
  const ruleY = eyebrowY - 32;

  const eyebrow = xmlEscape(categoryName.toUpperCase());
  const escapedLines = titleLines.map(xmlEscape);
  const siteMark = 'THEJOHNDWILLIAMS.COM';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0a0a0a" stop-opacity="0.92"/>
      <stop offset="0.45" stop-color="#0a0a0a" stop-opacity="0.70"/>
      <stop offset="0.75" stop-color="#0a0a0a" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0a0a" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a0a0a" stop-opacity="0.7"/>
    </linearGradient>
  </defs>

  <!-- Left scrim for title legibility over any background -->
  <rect x="0" y="0" width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#scrim)"/>
  <!-- Soft bottom vignette to seat the site mark -->
  <rect x="0" y="${OG_HEIGHT - 180}" width="${OG_WIDTH}" height="180" fill="url(#bottomFade)"/>

  <!-- Blue-hour hairline rule -->
  <line x1="72" y1="${ruleY}" x2="168" y2="${ruleY}" stroke="#7E9CB8" stroke-width="1.5"/>

  <!-- Category eyebrow (sans, uppercase, letterspaced) -->
  <text x="72" y="${eyebrowY}"
        fill="#7E9CB8"
        font-family="'IBM Plex Sans','Helvetica Neue',Arial,sans-serif"
        font-size="16"
        font-weight="600"
        letter-spacing="4.8">${eyebrow}</text>

  <!-- Title (serif, display) -->
  ${escapedLines
    .map((line, i) => `
  <text x="72" y="${firstLineY + i * titleLineHeight}"
        fill="#FDFCFA"
        font-family="'EB Garamond','Georgia',serif"
        font-size="${titleFontSize}"
        font-weight="400">${line}</text>`)
    .join('')}

  <!-- Site mark (bottom) -->
  <text x="72" y="${OG_HEIGHT - 48}"
        fill="#FDFCFA"
        fill-opacity="0.78"
        font-family="'IBM Plex Sans','Helvetica Neue',Arial,sans-serif"
        font-size="14"
        font-weight="500"
        letter-spacing="3.2">${siteMark}</text>

  <!-- Creator mark (bottom right) -->
  <text x="${OG_WIDTH - 72}" y="${OG_HEIGHT - 48}"
        fill="#FDFCFA"
        fill-opacity="0.55"
        font-family="'EB Garamond','Georgia',serif"
        font-size="14"
        font-style="italic"
        text-anchor="end">John D. Williams</text>
</svg>`;
}

/**
 * Render one OG image.
 *
 * Pipeline:
 *   1. Resize hero WebP → 1200×630 cover (attention-cropped to center).
 *   2. Slight darken to give the overlay text a fighting chance.
 *   3. Composite SVG overlay on top.
 *   4. Flatten + JPEG encode (mozjpeg, quality 85, progressive).
 */
async function renderOg({ file, alt, categoryName }) {
  const heroPath = path.join(HERO_DIR, `${file}.webp`);
  const outPath = path.join(OUT_DIR, `${file}.jpg`);

  if (!existsSync(heroPath)) {
    throw new Error(`Missing hero source: ${heroPath}`);
  }

  const overlaySvg = buildOverlaySvg({ title: alt, categoryName });
  const overlayBuffer = Buffer.from(overlaySvg);

  await sharp(heroPath)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.92 })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .flatten({ background: '#0a0a0a' })
    .jpeg({
      quality: JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:2:0',
    })
    .toFile(outPath);

  return outPath;
}

/**
 * Page-level OG images (home, photography, work, about).
 *
 * Same overlay + pipeline as photo OGs; the eyebrow carries the page's
 * on-site register word instead of a photo category. Referenced from the
 * top-level pages' BaseLayout ogImage props. Rationale: LinkedIn and some
 * Messages builds do not render WebP unfurls, and the 2400×1600 heroes the
 * pages previously pointed at are oversized for every unfurl surface.
 */
const PAGES = [
  { slug: 'home', hero: '7r52326', eyebrow: 'Making visible', title: 'John D. Williams' },
  { slug: 'photography', hero: 'img-1066', eyebrow: 'Noticing', title: 'Photography' },
  { slug: 'work', hero: 'dscf0331', eyebrow: 'Building', title: 'Selected Work' },
  { slug: 'about', hero: 'john-portrait-bw', eyebrow: 'Making visible', title: 'About' },
];

async function renderPageOg({ slug, hero, eyebrow, title }) {
  const heroPath = path.join(HERO_DIR, `${hero}.webp`);
  const outPath = path.join(PAGES_OUT_DIR, `${slug}.jpg`);

  if (!existsSync(heroPath)) {
    throw new Error(`Missing page hero source: ${heroPath}`);
  }

  const overlayBuffer = Buffer.from(buildOverlaySvg({ title, categoryName: eyebrow }));

  await sharp(heroPath)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.92 })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .flatten({ background: '#0a0a0a' })
    .jpeg({
      quality: JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:2:0',
    })
    .toFile(outPath);

  return outPath;
}

async function main() {
  const t0 = Date.now();

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PAGES_OUT_DIR, { recursive: true });

  for (const page of PAGES) {
    await renderPageOg(page);
  }
  console.log(`[og] ✓ wrote ${PAGES.length} page OG images → ${path.relative(ROOT, PAGES_OUT_DIR)}/`);

  const photos = await parsePhotographyManifest();
  if (photos.length === 0) {
    throw new Error('No photographs parsed from photography.ts — check the parser regex.');
  }

  console.log(`[og] rendering ${photos.length} OG images → ${path.relative(ROOT, OUT_DIR)}/`);

  // Small concurrency keeps sharp from oversubscribing the CPU on the
  // Cloudflare Pages build container (2 vCPU). 4 parallel is the
  // sharp sweet spot.
  const CONCURRENCY = 4;
  const errors = [];
  let done = 0;

  async function worker(slice) {
    for (const photo of slice) {
      try {
        await renderOg(photo);
        done += 1;
      } catch (err) {
        errors.push({ file: photo.file, err });
      }
    }
  }

  const buckets = Array.from({ length: CONCURRENCY }, () => []);
  photos.forEach((p, i) => buckets[i % CONCURRENCY].push(p));
  await Promise.all(buckets.map(worker));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (errors.length) {
    console.error(`[og] ${errors.length} failures:`);
    for (const { file, err } of errors) {
      console.error(`  - ${file}: ${err.message}`);
    }
    process.exit(1);
  }

  console.log(`[og] ✓ wrote ${done} images in ${elapsed}s`);
}

main().catch((err) => {
  console.error('[og] fatal:', err);
  process.exit(1);
});
