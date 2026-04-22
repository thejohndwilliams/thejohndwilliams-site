/**
 * Shared photography data — categories, images, and helpers.
 *
 * Single source of truth consumed by:
 *   - /photography        (gallery index)
 *   - /photography/[slug] (individual photo pages)
 */

export interface PhotoImage {
  file: string;
  alt: string;
  orientation: 'landscape' | 'portrait';
  featured?: boolean;
}

export interface PhotoCategory {
  id: string;
  name: string;
  description: string;
  images: PhotoImage[];
}

export const categories: PhotoCategory[] = [
  {
    id: 'sky',
    name: 'Sky',
    description: 'Looking up.',
    images: [
      { file: '7r52326', alt: 'Thunderheads against black sky', orientation: 'landscape', featured: true },
      { file: '7r52258', alt: 'Cloud mass rising into darkness', orientation: 'portrait' },
      { file: '7r52256', alt: 'Storm clouds from below', orientation: 'portrait' },
      { file: '7r52314', alt: 'Backlit dramatic cloudscape', orientation: 'landscape' },
      { file: 'dscf0088', alt: 'Cumulus formations in deep blue', orientation: 'landscape' },
      { file: 'dscf0056', alt: 'Lone cloud against cobalt', orientation: 'landscape' },
      { file: 'dscf0060', alt: 'Cirrus wisps in blue gradient', orientation: 'landscape' },
      { file: 'dscf1275', alt: 'Cloud dissolving into blue', orientation: 'portrait' },
      { file: 'dscf0090', alt: 'Cloud layers at altitude', orientation: 'landscape' },
      { file: 'dscf0091', alt: 'Cloud texture study', orientation: 'landscape' },
      { file: 'dscf0074', alt: 'Towering cumulus', orientation: 'portrait' },
      { file: 'dscf0082', alt: 'Cloud illuminated from within', orientation: 'portrait' },
      { file: 'dscf0086', alt: 'Cloud column against sky', orientation: 'portrait' },
      { file: 'dscf0069', alt: 'Cloud mass in afternoon light', orientation: 'portrait' },
      { file: 'dscf0077', alt: 'Sky gradient with clouds', orientation: 'portrait' },
      { file: 'img-7029-hdr-enhanced', alt: 'Clouds parting over deep blue', orientation: 'landscape' },
      { file: 'dscf0936', alt: 'Mountain river below cloud cover', orientation: 'portrait' },
      { file: '7r52322', alt: 'Storm formation detail', orientation: 'portrait' },
      { file: '7r52355', alt: 'Cloud edge study', orientation: 'portrait' },
      { file: '7r52352', alt: 'Atmospheric cloud layers', orientation: 'portrait' },
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Looking close.',
    images: [
      { file: '7r51025-enhanced-sr', alt: 'Rain-wet leaf in darkness', orientation: 'portrait', featured: true },
      { file: '7r51024-enhanced-sr', alt: 'Water droplets on dark leaf', orientation: 'landscape' },
      { file: '7r51018-enhanced-sr', alt: 'Leaf veins with rain', orientation: 'landscape' },
      { file: '7r50580-enhanced-sr', alt: 'Bougainvillea bloom', orientation: 'landscape' },
      { file: '7r51505-enhanced-sr', alt: 'Bee on citrus blossom', orientation: 'landscape' },
      { file: 'dsc-0009-2-enhanced-sr', alt: 'Fern frond macro', orientation: 'landscape' },
      { file: '7r51108-enhanced-sr', alt: 'Sunlight through tree canopy', orientation: 'portrait' },
      { file: 'dscf1737', alt: 'Forest canopy light', orientation: 'portrait' },
      { file: 'dscf1658', alt: 'Tropical garden', orientation: 'portrait' },
      { file: 'dscf1573', alt: 'Sky through branches', orientation: 'portrait' },
      { file: 'dscf1845', alt: 'Botanical detail', orientation: 'portrait' },
      { file: 'dscf1844', alt: 'Plant texture study', orientation: 'portrait' },
      { file: 'dscf1831', alt: 'Garden flora', orientation: 'portrait' },
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset over wildflower field', orientation: 'portrait' },
      { file: '7r51784-enhanced-sr', alt: 'Flowering tree and clouds', orientation: 'portrait' },
      { file: '7r51911-enhanced-sr', alt: 'Botanical close-up', orientation: 'portrait' },
    ]
  },
  {
    id: 'water',
    name: 'Water',
    description: 'Where land dissolves.',
    images: [
      { file: '7r50674-enhanced-sr', alt: 'El Arco de Cabo San Lucas', orientation: 'landscape', featured: true },
      { file: '7r50680-enhanced-sr', alt: 'Turquoise sea against rock formations', orientation: 'landscape' },
      { file: '7r50993-enhanced-sr', alt: 'Blue hour over Cabo harbor', orientation: 'landscape' },
      { file: '7r50971-enhanced-sr', alt: 'Golden sunset over coastal town', orientation: 'landscape' },
      { file: '7r50804-enhanced-sr', alt: 'Ocean at dusk', orientation: 'landscape' },
      { file: 'dscf0952', alt: 'Traditional boat on Kyoto river', orientation: 'portrait' },
      { file: 'img-7461-hdr-enhanced-hdr-enhanced', alt: 'Riverboat at pink dusk', orientation: 'landscape' },
    ]
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'What we build toward the sky.',
    images: [
      { file: 'img-7576-enhanced', alt: 'Shanghai Tower from below', orientation: 'portrait', featured: true },
      { file: 'img-7575-enhanced', alt: 'Glass tower looking up', orientation: 'portrait' },
      { file: 'img-7598-enhanced-sr', alt: 'Chinese pagoda at night', orientation: 'portrait' },
      { file: 'img-7610-enhanced-sr', alt: 'Temple reflected in purple water', orientation: 'landscape' },
      { file: 'img-7395-enhanced-sr', alt: 'Temple gate against blue sky', orientation: 'landscape' },
      { file: 'dscf0530', alt: 'Night Tokyo street with neon', orientation: 'portrait' },
      { file: 'dscf0423', alt: 'Japanese alleyway at night', orientation: 'portrait' },
      { file: 'dscf0261', alt: 'Urban night architecture', orientation: 'portrait' },
      { file: 'dsc-1076-enhanced', alt: 'Blue glass sculptures in garden', orientation: 'landscape' },
      { file: 'dsc-1081-enhanced', alt: 'Red glass spires in garden', orientation: 'landscape' },
      { file: 'dsc-1137-enhanced', alt: 'Chihuly sun sculpture', orientation: 'landscape' },
      { file: 'dsc-1138-enhanced', alt: 'Glass tower in garden', orientation: 'landscape' },
    ]
  },
  {
    id: 'light',
    name: 'Light',
    description: 'What changes everything.',
    images: [
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset wildflower field', orientation: 'portrait', featured: true },
      { file: '7r50971-enhanced-sr', alt: 'Golden light over water', orientation: 'landscape' },
      { file: 'burningcold-enhanced', alt: 'Fire consuming structure', orientation: 'landscape' },
    ]
  },
];

/** Total image count across all categories */
export const totalImages = categories.reduce((sum, cat) => sum + cat.images.length, 0);

import placeholders from './photo-placeholders.json';

/** Placeholder: intrinsic dimensions + tiny base64 LQIP for blur-up first paint. */
export type PhotoPlaceholder = {
  width: number;
  height: number;
  /** data:image/webp;base64,... — ~20px LQIP, ~240 bytes */
  lqip: string;
};

const _placeholders = placeholders as Record<string, PhotoPlaceholder>;

/**
 * Look up the placeholder (width / height / LQIP) for a given image file.
 * Returns undefined if the image hasn't been run through
 * `npm run build:placeholders` yet — callers should degrade gracefully.
 */
export function getPlaceholder(file: string): PhotoPlaceholder | undefined {
  return _placeholders[file];
}

/** Flat lookup: slug → { image, category } */
export type PhotoLookup = {
  image: PhotoImage;
  category: PhotoCategory;
  categoryIndex: number;
  imageIndex: number;
};

/**
 * Slug lookup: `file` → home-category entry.
 *
 * First-seen-wins: when a file appears in more than one category (e.g. the
 * `light` showcase re-displays images from `earth` / `water`), the canonical
 * detail page at `/photography/<file>` resolves to the image's home category.
 * Showcase categories may list a file with different alt text for grid-display
 * context without hijacking the slug.
 */
const _lookup = new Map<string, PhotoLookup>();
categories.forEach((cat, catIdx) => {
  cat.images.forEach((img, imgIdx) => {
    if (_lookup.has(img.file)) return;
    _lookup.set(img.file, {
      image: img,
      category: cat,
      categoryIndex: catIdx,
      imageIndex: imgIdx,
    });
  });
});

export function getPhotoBySlug(slug: string): PhotoLookup | undefined {
  return _lookup.get(slug);
}

/**
 * Returns all slugs in gallery display order (for sequential keyboard navigation).
 */
export function getAllSlugsSequential(): string[] {
  // First-seen-wins dedup: preserves home-category order, skips showcase re-listings
  // (else keyboard prev/next would revisit the same image).
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of categories) {
    for (const img of cat.images) {
      if (seen.has(img.file)) continue;
      seen.add(img.file);
      out.push(img.file);
    }
  }
  return out;
}

export function getAllSlugs(): string[] {
  return Array.from(_lookup.keys());
}

/** Get related images from the same category (excluding self) */
export function getRelatedImages(slug: string, count = 4): Array<{ file: string; alt: string; category: string }> {
  const entry = _lookup.get(slug);
  if (!entry) return [];
  return entry.category.images
    .filter(img => img.file !== slug)
    .slice(0, count)
    .map(img => ({ file: img.file, alt: img.alt, category: entry.category.name }));
}
