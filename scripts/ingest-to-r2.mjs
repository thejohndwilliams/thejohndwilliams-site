#!/usr/bin/env node
/**
 * ingest-to-r2.mjs
 *
 * Upload original photographs from the local Gallery_Images folder (or any
 * source directory) to a Cloudflare R2 bucket via the S3-compatible API.
 *
 * This is Tier 2 items 1 + 2 of the Site Roadmap: R2 storage + Cloudflare
 * Image Resizing. One high-quality original per photo lives in R2; every
 * variant (thumb/gallery/hero, AVIF/WebP/JPEG/future JPEG-XL) is negotiated
 * at the edge per request via /cdn-cgi/image/... or a custom hostname.
 *
 * Not wired into the build. This script is run manually whenever new
 * photographs need to be added to the portfolio — typically a small batch
 * at a time, driven by the output of a Lightroom export session.
 *
 * Idempotency: keys are content-addressable (sha256 of the file bytes +
 * basename). Re-running the script after a partial upload skips objects
 * that already exist in the bucket and appends only net-new entries to
 * the manifest.
 *
 * Reads from:
 *   - $SOURCE_DIR (default: $GALLERY_IMAGES_DIR, default: iCloud Gallery_Images)
 *   - .env (see .env.example for required fields)
 *
 * Writes to:
 *   - R2 bucket via S3-compatible PUT
 *   - src/data/photo-r2-manifest.json (append-only on success)
 *
 * Usage:
 *   node scripts/ingest-to-r2.mjs            # upload every eligible file
 *   node scripts/ingest-to-r2.mjs --dry-run  # list what would upload, no PUTs
 *   SOURCE_DIR=/path/to/batch node scripts/ingest-to-r2.mjs
 *
 * CREDENTIALS: this script requires the following env vars (gitignored .env):
 *   R2_ACCESS_KEY_ID      — from Cloudflare dashboard → R2 → Manage API Tokens
 *   R2_SECRET_ACCESS_KEY  — ditto, shown once at creation time
 *   R2_ACCOUNT_ID         — Cloudflare account ID (sidebar on R2 page)
 *   R2_BUCKET             — bucket name (e.g. thejohndwilliams-photos)
 *   R2_PUBLIC_BASE        — optional, custom hostname base URL (e.g.
 *                           https://images.thejohndwilliams.com). If unset,
 *                           falls back to the /cdn-cgi/image path-form.
 */

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'src/data/photo-r2-manifest.json');

// ── env loading ──────────────────────────────────────────────────────
// Minimal .env parser — avoids pulling dotenv as a dependency for a
// script that runs a handful of times a year.
async function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const raw = await fs.readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const DEFAULT_SOURCE_DIR = path.join(
  os.homedir(),
  'Library/Mobile Documents/com~apple~CloudDocs/05_Creative/Gallery_Images',
);

const EXTS = new Set(['.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp']);

async function collectSourceFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectSourceFiles(full)));
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Content-addressable key: short sha256 prefix + normalized basename.
 * Example:  3f9a7b2c_img-7576-enhanced.jpg
 *
 * Deterministic for a given file's bytes; collision-resistant within
 * a portfolio-sized namespace; human-scannable when debugging.
 */
async function contentAddressedKey(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  const digest = hash.digest('hex').slice(0, 12);
  const base = path
    .basename(filePath)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-');
  return `photography/${digest}_${base}`;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, entries: {} };
  }
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeManifest(manifest) {
  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

async function main() {
  await loadEnvFile();

  const dryRun = process.argv.includes('--dry-run');
  const sourceDir = process.env.SOURCE_DIR ||
    process.env.GALLERY_IMAGES_DIR ||
    DEFAULT_SOURCE_DIR;

  const required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length && !dryRun) {
    console.error('[ingest] Missing required env vars:');
    for (const k of missing) console.error(`  - ${k}`);
    console.error('[ingest] See docs/r2-migration-runbook.md for setup.');
    process.exit(1);
  }

  if (!existsSync(sourceDir)) {
    console.error(`[ingest] Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  console.log(`[ingest] Source:  ${sourceDir}`);
  console.log(`[ingest] Bucket:  ${process.env.R2_BUCKET || '<dry-run>'}`);
  console.log(`[ingest] Mode:    ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const files = await collectSourceFiles(sourceDir);
  console.log(`[ingest] Found ${files.length} candidate file(s).`);

  const manifest = await loadManifest();

  // Lazy-import @aws-sdk/client-s3 — only needed for live runs, so a
  // dry run works without the dependency installed.
  let S3Client, PutObjectCommand, HeadObjectCommand, client;
  if (!dryRun) {
    ({ S3Client, PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3'));
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  let uploaded = 0;
  let skipped = 0;
  const newEntries = {};

  for (const filePath of files) {
    const key = await contentAddressedKey(filePath);
    const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();

    // Skip if manifest already has this key (idempotent re-runs).
    if (manifest.entries[key]) {
      skipped += 1;
      continue;
    }

    const size = statSync(filePath).size;
    const contentType = contentTypeFor(filePath);

    if (dryRun) {
      console.log(`[ingest] WOULD PUT  ${key}  (${(size / 1024 / 1024).toFixed(1)} MB)`);
      continue;
    }

    // HEAD first; if R2 already has this key (e.g. manifest diverged from
    // bucket state), treat as a no-op PUT.
    let alreadyInBucket = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
      alreadyInBucket = true;
    } catch (err) {
      if (err.$metadata?.httpStatusCode !== 404) throw err;
    }

    if (!alreadyInBucket) {
      const body = createReadStream(filePath);
      await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: size,
      }));
      console.log(`[ingest] PUT  ${key}  (${(size / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      console.log(`[ingest] SKIP in-bucket  ${key}`);
    }

    newEntries[key] = {
      slug: basename,
      sourceFile: path.relative(ROOT, filePath),
      size,
      contentType,
      uploadedAt: new Date().toISOString(),
    };
    uploaded += 1;
  }

  if (!dryRun && uploaded > 0) {
    manifest.entries = { ...manifest.entries, ...newEntries };
    manifest.updatedAt = new Date().toISOString();
    await writeManifest(manifest);
    console.log(`[ingest] Manifest updated: ${path.relative(ROOT, MANIFEST_PATH)}`);
  }

  console.log(`[ingest] ✓ ${uploaded} uploaded, ${skipped} skipped (already in manifest).`);
}

main().catch((err) => {
  console.error('[ingest] fatal:', err);
  process.exit(1);
});
