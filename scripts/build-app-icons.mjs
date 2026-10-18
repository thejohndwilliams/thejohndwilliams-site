#!/usr/bin/env node
/**
 * build-app-icons.mjs
 *
 * Rebuild the JW app mark from EB Garamond outlines (weight 400).
 *
 * An SVG icon cannot load site webfonts, so scripts/jw-outline.py turns
 * the variable font into one path. "any" icons keep the previous relative
 * size: the cream ink on favicon-512.png was 348px wide (x 72..419).
 * The maskable icon is a separate full-bleed file. Its glyph is centered
 * with a bounding-circle radius of at most 184px (0.36 x 512). The script
 * measures cream pixels and fails if that radius exceeds 204 (the
 * maskable safe circle is 0.4 x 512 = 204.8).
 *
 * Setup for the helper (not a package.json dependency):
 *   python3 -m pip install 'fonttools>=4.55' brotli
 *
 * Run:
 *   node scripts/build-app-icons.mjs
 *   node scripts/build-app-icons.mjs --contact-sheet /tmp/app-icon-contact-sheet.png
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = path.join(ROOT, 'public/fonts/eb-garamond/eb-garamond-normal.woff2');
const PUBLIC = path.join(ROOT, 'public');

const CREAM = '#F4EADE';
const MIDNIGHT = '#0a0a0a';
const STONE = '#A89F8C';

// Inclusive cream-pixel width of the previous public/favicon-512.png.
const ANY_INK_WIDTH_AT_512 = 348;
const MASK_DESIGN_RADIUS = 184;
const MASK_FAIL_RADIUS = 204;

const args = process.argv.slice(2);
const sheetFlag = args.indexOf('--contact-sheet');
const contactSheet = sheetFlag >= 0 ? args[sheetFlag + 1] : null;
if (sheetFlag >= 0 && !contactSheet) {
  console.error('build-app-icons: --contact-sheet needs a file path');
  process.exit(1);
}

function loadOutline() {
  const helper = path.join(ROOT, 'scripts/jw-outline.py');
  const result = spawnSync('python3', [helper, FONT], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    console.error('build-app-icons: jw-outline.py failed. Install fonttools and brotli (see the script header).');
    process.exit(result.status || 1);
  }
  return JSON.parse(result.stdout);
}

function bakePath(d, scale, tx, ty) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) throw new Error('JW path is empty');
  const fmt = (n) => {
    const rounded = Math.round(n * 100) / 100;
    return Number(rounded.toFixed(2)).toString();
  };
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!/[A-Z]/.test(cmd)) throw new Error(`relative path command ${cmd} is not expected`);
    if (cmd === 'Z') {
      out.push('Z');
      continue;
    }
    const arity = { M: 2, L: 2, Q: 4, C: 6, H: 1, V: 1 }[cmd];
    if (!arity) throw new Error(`unsupported path command ${cmd}`);
    const nums = [];
    for (let k = 0; k < arity; k++) nums.push(Number(tokens[i++]));
    if (cmd === 'H') {
      out.push(`H${fmt(nums[0] * scale + tx)}`);
      continue;
    }
    if (cmd === 'V') {
      out.push(`V${fmt(nums[0] * scale + ty)}`);
      continue;
    }
    const mapped = [];
    for (let k = 0; k < nums.length; k += 2) {
      mapped.push(fmt(nums[k] * scale + tx), fmt(nums[k + 1] * scale + ty));
    }
    out.push(cmd + mapped.join(' '));
  }
  return out.join('');
}

function placement(bounds, size, scale) {
  const tx = size / 2 - ((bounds.xMin + bounds.xMax) / 2) * scale;
  const ty = size / 2 - ((bounds.yMin + bounds.yMax) / 2) * scale;
  return { tx, ty };
}

function anyScale(bounds, size) {
  const inkW = bounds.xMax - bounds.xMin;
  return (size * (ANY_INK_WIDTH_AT_512 / 512)) / inkW;
}

function maskScale(bounds, radius) {
  const inkW = bounds.xMax - bounds.xMin;
  const inkH = bounds.yMax - bounds.yMin;
  return (radius * 2) / Math.hypot(inkW, inkH);
}

function svgDocument({ size, rx, d }) {
  const rect = rx > 0
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="${MIDNIGHT}"/>`
    : `<rect width="${size}" height="${size}" fill="${MIDNIGHT}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    rect,
    `<path fill="${CREAM}" d="${d}"/>`,
    '</svg>',
  ].join('');
}

async function rasterize(svg, size, { opaque }) {
  let pipeline = sharp(Buffer.from(svg)).resize(size, size, { fit: 'fill' });
  if (opaque) pipeline = pipeline.flatten({ background: MIDNIGHT });
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

async function measure(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx = width / 2;
  const cy = height / 2;
  let maxR = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let transparent = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a !== 255) transparent += 1;
      if (a > 16 && r + g + b > 80) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        const rad = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (rad > maxR) maxR = rad;
      }
    }
  }
  return {
    maxR,
    inkW: maxX - minX + 1,
    inkH: maxY - minY + 1,
    transparent,
    width,
    height,
  };
}

async function renderAny(outline, size, rx) {
  const scale = anyScale(outline.bounds, size);
  const { tx, ty } = placement(outline.bounds, size, scale);
  const d = bakePath(outline.d, scale, tx, ty);
  const svg = svgDocument({ size, rx, d });
  const png = await rasterize(svg, size, { opaque: false });
  return { svg, png, scale };
}

async function renderMaskable(outline, radius) {
  const size = 512;
  const scale = maskScale(outline.bounds, radius);
  const { tx, ty } = placement(outline.bounds, size, scale);
  const d = bakePath(outline.d, scale, tx, ty);
  const svg = svgDocument({ size, rx: 0, d });
  const png = await rasterize(svg, size, { opaque: true });
  const stats = await measure(png);
  return { png, stats, scale };
}

async function buildContactSheet(tiles) {
  const gap = 28;
  const pad = 36;
  const height = pad * 2 + 512;
  const width = pad * 2 + tiles.reduce((sum, tile) => sum + tile.size, 0) + gap * (tiles.length - 1);
  const composites = [];
  let x = pad;
  for (const tile of tiles) {
    const top = pad + Math.round((512 - tile.size) / 2);
    composites.push({ input: tile.png, left: x, top });
    if (tile.circles) {
      const overlay = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${tile.size}" height="${tile.size}">`,
        `<circle cx="${tile.size / 2}" cy="${tile.size / 2}" r="${MASK_DESIGN_RADIUS}" fill="none" stroke="${CREAM}" stroke-width="1"/>`,
        `<circle cx="${tile.size / 2}" cy="${tile.size / 2}" r="${MASK_FAIL_RADIUS}" fill="none" stroke="${STONE}" stroke-width="1"/>`,
        '</svg>',
      ].join('');
      composites.push({ input: Buffer.from(overlay), left: x, top });
    }
    x += tile.size + gap;
  }
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: MIDNIGHT,
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheet);
  console.log(`contact sheet: ${contactSheet}`);
}

async function main() {
  const outline = loadOutline();
  const { bounds } = outline;
  console.log(
    `jw outline: text ${outline.text}  weight ${outline.weight}  units ${outline.unitsPerEm}  kern ${outline.kern}`,
  );
  console.log(
    `jw ink: x ${bounds.xMin}..${bounds.xMax}  y ${bounds.yMin}..${bounds.yMax}`,
  );

  const any64 = await renderAny(outline, 64, 14);
  writeFileSync(path.join(PUBLIC, 'favicon.svg'), any64.svg);

  const anySizes = [
    { file: 'favicon-48.png', size: 48 },
    { file: 'favicon-192.png', size: 192 },
    { file: 'favicon-512.png', size: 512 },
  ];
  const written = [];
  for (const item of anySizes) {
    const rx = (14 / 64) * item.size;
    const rendered = await renderAny(outline, item.size, rx);
    const file = path.join(PUBLIC, item.file);
    writeFileSync(file, rendered.png);
    const stats = await measure(rendered.png);
    console.log(
      `${item.file}: ${stats.width}x${stats.height}  ink ${stats.inkW}x${stats.inkH}  max radius ${stats.maxR.toFixed(2)}`,
    );
    written.push({ ...item, png: rendered.png, stats });
  }

  const apple = await renderAny(outline, 180, 0);
  const applePng = await rasterize(apple.svg, 180, { opaque: true });
  const appleFile = path.join(PUBLIC, 'apple-touch-icon.png');
  writeFileSync(appleFile, applePng);
  const appleStats = await measure(applePng);
  if (appleStats.transparent !== 0) {
    throw new Error(`apple-touch-icon.png has ${appleStats.transparent} non-opaque pixels`);
  }
  console.log(
    `apple-touch-icon.png: ${appleStats.width}x${appleStats.height}  opaque  ink ${appleStats.inkW}x${appleStats.inkH}  max radius ${appleStats.maxR.toFixed(2)}`,
  );

  let mask = await renderMaskable(outline, MASK_DESIGN_RADIUS - 2);
  if (mask.stats.maxR > MASK_DESIGN_RADIUS) {
    const tightened = MASK_DESIGN_RADIUS * (MASK_DESIGN_RADIUS / mask.stats.maxR) * 0.995;
    mask = await renderMaskable(outline, tightened);
  }
  if (mask.stats.maxR > MASK_FAIL_RADIUS) {
    throw new Error(
      `maskable cream radius ${mask.stats.maxR.toFixed(2)} exceeds ${MASK_FAIL_RADIUS}`,
    );
  }
  if (mask.stats.transparent !== 0) {
    throw new Error(`favicon-512-maskable.png has ${mask.stats.transparent} non-opaque pixels`);
  }
  const maskFile = path.join(PUBLIC, 'favicon-512-maskable.png');
  writeFileSync(maskFile, mask.png);
  console.log(
    `favicon-512-maskable.png: 512x512  full-bleed ${MIDNIGHT}  max cream radius ${mask.stats.maxR.toFixed(2)} (design cap ${MASK_DESIGN_RADIUS}, fail above ${MASK_FAIL_RADIUS})`,
  );

  if (contactSheet) {
    await buildContactSheet([
      { png: written[0].png, size: 48 },
      { png: applePng, size: 180 },
      { png: written[1].png, size: 192 },
      { png: written[2].png, size: 512 },
      { png: mask.png, size: 512, circles: true },
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
