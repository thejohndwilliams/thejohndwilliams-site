/**
 * Shared photography data - categories, images, and helpers.
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
  /**
   * Which image pipeline serves this photograph.
   *
   * 'local' - (default, implicit on all existing entries) Pre-rendered
   *   AVIF/WebP tiers under /public/images/photography/{thumb,gallery,hero}/.
   *   How the first 58 photographs ship.
   *
   * 'r2' - Single original stored in Cloudflare R2; every variant
   *   negotiated at the edge via Image Resizing. Set `key` to the
   *   content-addressable R2 object key (from photo-r2-manifest.json).
   *   Use for NEW uploads going forward.
   *
   * See docs/r2-migration-runbook.md for the pipeline.
   */
  source?: 'local' | 'r2';
  /** R2 object key when source === 'r2'. Format: photography/<sha>_<basename>.<ext> */
  key?: string;
  /**
   * Two observational sentences shown on the photo page (2026-11-14 review:
   * photo pages were ~60 words and Google left most of them unindexed).
   * Describe only what is in the frame. No invented places, dates or
   * stories; no em dashes. Owner edits these.
   */
  note?: string;
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
    // 2026-11-24 cohesion pass (owner): thirteen bright midday-blue frames
    // left the set (dscf0088 0056 0060 1275 0090 0091 0082 0086 0069 0936,
    // 7r52355 7r52352, img-7029-hdr-enhanced). The files stay on disk and
    // their old URLs 301 to /photography/ (public/_redirects).
    description: 'Looking up.',
    images: [
      { file: '7r52326', alt: 'Thunderheads against black sky', orientation: 'landscape', featured: true, note: 'The sky is pulled down to black so only the cloud keeps its light. Seen this way a thunderhead stops reading as weather and becomes a form.' },
      { file: '7r52258', alt: 'Cloud mass rising into darkness', orientation: 'portrait' },
      { file: '7r52256', alt: 'Storm clouds from below', orientation: 'portrait' },
      { file: '7r52314', alt: 'A cloud edge lit from behind', orientation: 'landscape' },
      { file: 'dscf0074', alt: 'Clouds warming at dusk', orientation: 'portrait' },
      { file: 'dscf0077', alt: 'Streaked sky over a last ember', orientation: 'portrait' },
      { file: '7r52322', alt: 'A storm mass parting around light', orientation: 'portrait' },
      { file: 'gv-3b61b429', alt: 'Lone tree against a smoldering horizon', orientation: 'landscape' },
      { file: 'dsc-0131', alt: 'Storm front massing over rooftops', orientation: 'landscape', featured: true, note: 'A shelf of storm cloud runs the width of the frame, with a band of clear evening light still holding beneath it. The rooftops and a single light pole give it scale.' },
      { file: 'img-0061', alt: 'Violet and ember sky over a sleeping town', orientation: 'landscape' },
      { file: 'img-0078', alt: 'Last light bleeding from a violet sky', orientation: 'landscape', featured: true, note: 'The last of the day leaves violet and rose in the sky while the ground has already gone dark. A few bare trees and a roofline hold the horizon.' },
      { file: 'img-1066', alt: 'A shelf cloud rolling over an open field', orientation: 'landscape', featured: true, note: 'The leading edge of a shelf cloud is drawn out in long grey bands above an open field. The light poles and the treeline below are already in shadow.' },
      { file: 'img-1142', alt: 'Thunderhead swelling over the plain', orientation: 'portrait' },
      { file: 'img-3058', alt: 'Blue hour thinning to a single light', orientation: 'landscape' },
      { file: 'img-3094', alt: 'Towering cloud in a darkening sky', orientation: 'landscape', featured: true, note: 'A cumulus tower holds warm light on its upper flank while the blue around it deepens. Smaller clouds scatter across the top of the frame.' },
      { file: 'img-6549', alt: 'Solitary tree on a dusk-lit ridge', orientation: 'landscape' },
      { file: 'img-6552', alt: 'Sun failing behind a lone silhouette', orientation: 'landscape' },
      { file: '7r51848', alt: 'Storm cell drifting over the flats', orientation: 'portrait' },
      { file: '7r52330', alt: 'One cloud adrift in cobalt', orientation: 'landscape' },
      { file: '7r52268', alt: 'Clouds luminous against deep blue', orientation: 'landscape' },
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Looking close.',
    images: [
      { file: '7r51025-enhanced-sr', alt: 'Rain-wet leaf in darkness', orientation: 'portrait', featured: true, note: 'A broad leaf after rain, beaded with drops and lit just enough to separate it from the dark. Most of the frame is left to shadow.' },
      { file: '7r51024-enhanced-sr', alt: 'Rain beaded across a dark leaf', orientation: 'landscape' },
      { file: '7r51018-enhanced-sr', alt: 'Rain held in the veins of a leaf', orientation: 'landscape' },
      { file: '7r50580-enhanced-sr', alt: 'Bougainvillea opening in the green', orientation: 'landscape' },
      { file: '7r51505-enhanced-sr', alt: 'A bee working a lemon blossom', orientation: 'landscape' },
      { file: 'dsc-0009-2-enhanced-sr', alt: 'A fern frond reaching out of black', orientation: 'landscape' },
      { file: '7r51108-enhanced-sr', alt: 'Sun breaking through the canopy', orientation: 'portrait' },
      { file: 'dscf1737', alt: 'Palms against a bright sea sky', orientation: 'portrait' },
      { file: 'dscf1658', alt: 'Red blooms beneath a white balcony', orientation: 'portrait' },
      { file: 'dscf1573', alt: 'Clouds through a frame of branches', orientation: 'portrait' },
      { file: 'dscf1845', alt: 'Gold cloud over a breaking shore', orientation: 'portrait' },
      { file: 'dscf1844', alt: 'Wet sand reaching a point of palms', orientation: 'portrait' },
      { file: 'dscf1831', alt: 'Red ginger under a stand of palms', orientation: 'portrait' },
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset over wildflower field', orientation: 'portrait', note: 'A field of orange wildflowers under a sky turning pink and blue at sunset. Two trees mark the far edge of the field.' },
      { file: '7r51784-enhanced-sr', alt: 'A flowering tree beneath heavy cloud', orientation: 'portrait' },
      { file: '7r51911-enhanced-sr', alt: 'Storm cloud rising past the treeline', orientation: 'portrait' },
      { file: 'dscf0425', alt: 'Foliage closing over a dusk path', orientation: 'portrait' },
      { file: 'dscf0783', alt: 'Bamboo standing in low green light', orientation: 'portrait' },
      { file: 'img-0075', alt: 'Light reaching into stone', orientation: 'portrait' },
      { file: 'img-6662', alt: 'A lone figure against the dunes', orientation: 'landscape', featured: true, note: 'A single figure crosses an open field of white sand under a wide, streaked sky. The person is kept small; the scale is the subject.' },
    ]
  },
  {
    id: 'water',
    name: 'Water',
    description: 'Where land dissolves.',
    images: [
      { file: '7r50674-enhanced-sr', alt: 'El Arco de Cabo San Lucas', orientation: 'landscape', featured: true, note: 'El Arco at Cabo San Lucas, with small boats working the water beneath the rock. The clouds open above it and the sea catches the light.' },
      { file: '7r50680-enhanced-sr', alt: 'Turquoise sea against rock formations', orientation: 'landscape' },
      { file: '7r50993-enhanced-sr', alt: 'Blue hour over Cabo harbor', orientation: 'landscape' },
      { file: '7r50971-enhanced-sr', alt: 'Golden sunset over coastal town', orientation: 'landscape' },
      { file: '7r50804-enhanced-sr', alt: 'A small cove beneath raw rock', orientation: 'landscape' },
      { file: 'dscf0952', alt: 'Traditional boat on Kyoto river', orientation: 'portrait' },
      { file: 'img-7461-hdr-enhanced-hdr-enhanced', alt: 'Riverboat at pink dusk', orientation: 'landscape' },
      { file: 'dscf0585', alt: 'Twilight settling over still water', orientation: 'portrait' },
      { file: 'dscf1792', alt: 'A dark stream threading the woods', orientation: 'portrait' },
      { file: 'dscf1928', alt: 'Sea and sky dissolving at dusk', orientation: 'portrait' },
      { file: 'dscf1941', alt: 'Tide breathing against a dusk shore', orientation: 'portrait' },
      { file: 'img-2526', alt: 'A single post standing in blue water', orientation: 'portrait' },
      { file: '7r50953', alt: 'Sun sinking past a far ridge', orientation: 'portrait' },
      { file: '7r50996', alt: 'A harbor under violet dusk', orientation: 'landscape', featured: true, note: 'A harbor at dusk, the clouds lit violet and gold above the waterfront. A boat\'s wake cuts across the water toward the shore.' },
    ]
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'What we build toward the sky.',
    images: [
      { file: 'img-7576-enhanced', alt: 'Shanghai Tower from below', orientation: 'portrait', featured: true, note: 'The Shanghai Tower seen from its base, the twist of the facade rising into a pale sky. Neighboring towers hold the edges of the frame.' },
      { file: 'img-7575-enhanced', alt: 'A glass tower narrowing to a point', orientation: 'portrait' },
      { file: 'img-7598-enhanced-sr', alt: 'Pagoda eaves lit red at night', orientation: 'portrait' },
      { file: 'img-7610-enhanced-sr', alt: 'Temple reflected in purple water', orientation: 'landscape' },
      { file: 'img-7395-enhanced-sr', alt: 'Temple gate against blue sky', orientation: 'landscape' },
      { file: 'dscf0530', alt: 'A night crossing under lit towers', orientation: 'portrait' },
      { file: 'dscf0423', alt: 'A narrow alley lit by one lamp', orientation: 'portrait' },
      { file: 'dscf0261', alt: 'A stairwell lit from one window', orientation: 'portrait' },
      { file: 'dsc-1076-enhanced', alt: 'Blue glass rising from a garden pond', orientation: 'landscape' },
      { file: 'dsc-1081-enhanced', alt: 'Red glass spires across a lawn', orientation: 'landscape' },
      { file: 'dsc-1137-enhanced', alt: 'A glass sun among the trees', orientation: 'landscape' },
      { file: 'dsc-1138-enhanced', alt: 'A tower of red and gold glass', orientation: 'landscape' },
      { file: 'gv-1fd48bd9', alt: 'Glass tower rising into the night', orientation: 'landscape' },
      { file: 'dscf0503', alt: 'Red light spilling across a night street', orientation: 'portrait' },
      { file: 'dscf0580', alt: 'A dim alley swallowed by green', orientation: 'portrait' },
      { file: 'dscf0671', alt: 'Paper lanterns glowing against the night', orientation: 'portrait', featured: true, note: 'Tiers of paper lanterns glow against the night, each one inscribed. A wooden notice board stands in front of them.' },
      { file: 'dscf0876', alt: 'Temple roofline against the treeline', orientation: 'portrait' },
      { file: 'dscf1022', alt: 'A tower reduced to vertical lines', orientation: 'portrait' },
      { file: 'dscf1059', alt: 'A spire against a bruised twilight', orientation: 'portrait' },
      { file: 'dsc-0101', alt: 'City skyline burning blue at night', orientation: 'landscape' },
      { file: 'dsc-0329', alt: 'Light through a derelict hall', orientation: 'landscape' },
      { file: 'img-0161', alt: 'Stairs descending into low light', orientation: 'portrait' },
      { file: 'img-7462', alt: 'Harbor city glowing at dusk', orientation: 'landscape' },
    ]
  },
  {
    id: 'light',
    name: 'Light',
    description: 'What changes everything.',
    images: [
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset over wildflower field', orientation: 'portrait', featured: true, note: 'A field of orange wildflowers under a sky turning pink and blue at sunset. Two trees mark the far edge of the field.' },
      { file: '7r50971-enhanced-sr', alt: 'Golden sunset over coastal town', orientation: 'landscape' },
      { file: 'burningcold-enhanced', alt: 'A frame burning in cold color', orientation: 'landscape' },
      { file: 'dscf0331', alt: 'Lanterns along a shrine at night', orientation: 'portrait' },
      { file: 'dscf1419', alt: 'A globe of light held in shadow', orientation: 'portrait' },
      { file: 'dsc-0014', alt: 'A carved ram emerging from black', orientation: 'landscape', featured: true, note: 'A carved ram\'s head in dark metal, its horns curling out of the black. Light falls across the brow and leaves the rest to shadow.' },
      { file: 'dsc-0378', alt: 'Neon traced across the night', orientation: 'landscape' },
      { file: 'img-0132', alt: 'A chandelier suspended in darkness', orientation: 'portrait', featured: true, note: 'A crystal chandelier hangs lit in a dark room. Every arm and drop catches a point of light.' },
      { file: 'img-2528', alt: 'A ribbon of light drawn in the dark', orientation: 'landscape' },
      { file: 'img-2972', alt: 'Fire taking a frame in the night', orientation: 'landscape' },
      { file: '7r52035', alt: 'Sparks raining against a black sky', orientation: 'portrait' },
    ]
  },
];

/** Total image count across all categories */
// P2 fix, 2026-07-19: count DISTINCT files. Showcase categories re-list
// images from home categories (see the slug lookup below); the raw sum
// overstated the public count on /photography.
export const totalImages = new Set(categories.flatMap((cat) => cat.images.map((img) => img.file))).size;

import placeholders from './photo-placeholders.json';

/** Placeholder: intrinsic dimensions + tiny base64 LQIP for blur-up first paint. */
export type PhotoPlaceholder = {
  width: number;
  height: number;
  /** data:image/webp;base64,... - ~20px LQIP, ~240 bytes */
  lqip: string;
};

const _placeholders = placeholders as Record<string, PhotoPlaceholder>;

/**
 * Look up the placeholder (width / height / LQIP) for a given image file.
 * Returns undefined if the image hasn't been run through
 * `npm run build:placeholders` yet - callers should degrade gracefully.
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
