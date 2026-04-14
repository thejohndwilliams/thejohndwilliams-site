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

export function getPhotoMeta(basename: string): ExifEntry {
  const manifest = (exifManifest as Record<string, ExifEntry>)[basename] ?? {};
  return {
    camera: manifest.camera ?? inferCameraFromFilename(basename),
    ...manifest,
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
  return parts.join(' — ');
}
