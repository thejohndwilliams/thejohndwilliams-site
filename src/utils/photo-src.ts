import dims from '../data/photo-dimensions.json';

export interface PhotoDim {
  w: number;
  h: number;
}

export interface PhotoTiers {
  thumb: PhotoDim;
  gallery: PhotoDim;
  hero: PhotoDim;
  portrait?: PhotoDim;
}

const table = dims as Record<string, PhotoTiers>;

export function photoTiers(file: string): PhotoTiers {
  const row = table[file];
  if (!row?.hero || !row.thumb || !row.gallery) {
    throw new Error(`missing photo dimensions for ${file}`);
  }
  return row;
}

export type LocalTier = 'thumb' | 'gallery' | 'hero';

/** Width descriptors are the bitmap widths, never the tier cap. */
export function photoSrcset(
  file: string,
  ext: 'avif' | 'webp',
  tiers: LocalTier[] = ['thumb', 'gallery', 'hero'],
): string {
  const row = photoTiers(file);
  return tiers
    .map((tier) => `/images/photography/${tier}/${file}.${ext} ${row[tier].w}w`)
    .join(', ');
}

export function portraitSrcset(file: string, ext: 'avif' | 'webp'): string {
  const portrait = photoTiers(file).portrait;
  if (!portrait) {
    throw new Error(`missing portrait crop for ${file}`);
  }
  return `/images/photography/portrait/${file}.${ext} ${portrait.w}w`;
}

export function portraitSizes(file: string): string {
  const portrait = photoTiers(file).portrait;
  if (!portrait) return '100vw';
  return `min(100vw, ${portrait.w}px)`;
}

/** Slot matches the plate: own aspect, never wider than the bitmap, never taller than 80svh. */
export function plateSizes(file: string): string {
  const { w, h } = photoTiers(file).hero;
  return `min(100vw, ${w}px, calc(80svh * ${w} / ${h}))`;
}

/** Full-bleed heroes stay full width up to the bitmap. */
export function bleedSizes(file: string): string {
  const { w } = photoTiers(file).hero;
  return `min(100vw, ${w}px)`;
}

export function heroCapClass(file: string): string {
  return `hero-cap-${photoTiers(file).hero.w}`;
}

export function frameClass(file: string): string {
  return `photo-frame pf-${file}`;
}

/** Upper bound of a masonry column so the browser does not stop at a short tier. */
export const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1023px) 34vw, 28rem';

export const RELATED_SIZES = '(max-width: 767px) 50vw, 22rem';
