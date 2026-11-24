/**
 * Photograph metadata utilities.
 *
 * Two data sources:
 *   1. Filename pattern → camera body (inferred, always available).
 *   2. src/data/photo-exif.json → full EXIF (aperture, shutter, ISO,
 *      focal length, date, location). Populated by running
 *      scripts/extract-exif.py against a local Lightroom archive.
 *      Falls back to filename-only inference when a key is missing.
 */

import exifManifest from '../data/photo-exif.json';

type ExifEntry = {
  camera?: string;
  lens?: string;
  aperture?: string;       // "f/2.8"
  shutter?: string;        // "1/500s"
  iso?: number;
  focalLength?: string;    // "35mm"
  captureDate?: string;    // ISO8601
  location?: string;
};

const PATTERN_CAMERA: Array<[RegExp, string]> = [
  [/^7r5/i,     'Sony α7R V'],
  [/^7r[0-9]/i, 'Sony α7R'],
  [/^dscf/i,    'Fujifilm X-Series'],
  [/^dsc-/i,    'Sony α-Series'],
  [/^img[-_]/i, 'Camera'],
  [/^burning/i, 'Sony α7R V'],
];

export function inferCameraFromFilename(basename: string): string | undefined {
  for (const [re, cam] of PATTERN_CAMERA) {
    if (re.test(basename)) return cam;
  }
  return undefined;
}

/** Strip Lightroom/Topaz suffixes a site basename may carry that the
    manifest does not (manifest is keyed by camera-original basename). */
function stripEnhancementSuffix(basename: string): string {
  return basename.replace(/-enhanced(?:-sr)?(?:-\d+)?$/i, '')
                 .replace(/-hdr$/i, '')
                 .replace(/-sr$/i, '');
}

/** EXIF writes model codes ("SONY ILCE-7RM5", "Canon Canon EOS 7D").
    The page shows the names a person would say. 2026-11-24 cohesion pass. */
const CAMERA_NAMES: Record<string, string> = {
  'SONY ILCE-7RM5': 'Sony α7R V',
  'FUJIFILM X100VI': 'Fujifilm X100VI',
  'NIKON CORPORATION NIKON D5000': 'Nikon D5000',
  'Canon Canon EOS Rebel T6': 'Canon EOS Rebel T6',
  'Canon Canon EOS 7D': 'Canon EOS 7D',
};

export function displayCamera(raw?: string): string | undefined {
  if (!raw) return raw;
  return CAMERA_NAMES[raw] ?? raw;
}

export function displayLens(raw?: string): string | undefined {
  if (!raw) return raw;
  // Phone lens strings restate the camera ("iPhone 6 back camera 4.15mm").
  if (/^iPhone\b/i.test(raw)) return undefined;
  if (raw === '24-70mm F2.8 DG DN | Art 019') return 'Sigma 24-70mm F2.8 DG DN Art';
  const zoom = raw.match(/^(\d+)\.0-(\d+)\.0 mm (f\/[\d.]+-[\d.]+)$/);
  if (zoom) return `${zoom[1]}-${zoom[2]}mm ${zoom[3]}`;
  return raw;
}

export function getPhotoMeta(basename: string): ExifEntry {
  const m = exifManifest as Record<string, ExifEntry>;
  // Try literal basename first, then progressively strip enhancement suffixes
  const stripped = stripEnhancementSuffix(basename);
  const manifest = m[basename] ?? m[stripped] ?? {};
  return {
    ...manifest,
    camera: displayCamera(manifest.camera) ?? inferCameraFromFilename(basename),
    lens: displayLens(manifest.lens),
  };
}

/** Render the meta block for the lightbox. Omits null/undefined. */
export function formatMetaLine(meta: ExifEntry): string {
  const parts: string[] = [];
  if (meta.camera) parts.push(meta.camera);
  if (meta.lens) parts.push(meta.lens);
  const tech: string[] = [];
  if (meta.focalLength) tech.push(meta.focalLength);
  if (meta.aperture) tech.push(meta.aperture);
  if (meta.shutter) tech.push(meta.shutter);
  if (meta.iso) tech.push(`ISO ${meta.iso}`);
  if (tech.length) parts.push(tech.join(' · '));
  if (meta.location) parts.push(meta.location);
  return parts.join(' · ');
}
