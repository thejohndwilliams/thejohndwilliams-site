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
      { file: '7r52258', alt: 'Cloud mass rising into darkness', orientation: 'portrait', note: 'The sky is pulled to black so the cloud rises out of nothing. Its lower edge stays soft while the crown catches all the light.' },
      { file: '7r52256', alt: 'Storm clouds from below', orientation: 'portrait', note: 'Seen from underneath, the cloud breaks into separate lit masses against the dark. The open black at the top gives it room to climb.' },
      { file: '7r52314', alt: 'A cloud edge lit from behind', orientation: 'landscape', note: 'The light sits behind the cloud, so only its edges burn white. The body of it stays dark against a deep blue sky.' },
      { file: 'dscf0074', alt: 'Clouds warming at dusk', orientation: 'portrait', note: 'Small clouds pick up rose and peach while the sky behind them is still full day blue. The warm color climbs the frame from the bottom.' },
      { file: 'dscf0077', alt: 'Streaked sky over a last ember', orientation: 'portrait', note: 'Thin cloud is drawn in streaks across the sky, catching the last warm light. A roofline at the bottom holds a single coal of sunset.' },
      { file: '7r52322', alt: 'A storm mass parting around light', orientation: 'portrait', note: 'Two masses of cloud meet on a diagonal, one lit and one in shadow. A seam of open sky runs between them.' },
      { file: 'gv-3b61b429', alt: 'Lone tree against a smoldering horizon', orientation: 'landscape', note: 'One tree stands on the ridge as the sun goes under the horizon. A small line of birds crosses the orange band above it.' },
      { file: 'dsc-0131', alt: 'Storm front massing over rooftops', orientation: 'landscape', featured: true, note: 'A shelf of storm cloud runs the width of the frame, with a band of clear evening light still holding beneath it. The rooftops and a single light pole give it scale.' },
      { file: 'img-0061', alt: 'Violet and ember sky over a sleeping town', orientation: 'landscape', note: 'The sky runs from violet to a hot orange line at the horizon. The building in the foreground is already a silhouette with two lit windows.' },
      { file: 'img-0078', alt: 'Last light bleeding from a violet sky', orientation: 'landscape', featured: true, note: 'The last of the day leaves violet and rose in the sky while the ground has already gone dark. A few bare trees and a roofline hold the horizon.' },
      { file: 'img-1066', alt: 'A shelf cloud rolling over an open field', orientation: 'landscape', featured: true, note: 'The leading edge of a shelf cloud is drawn out in long grey bands above an open field. The light poles and the treeline below are already in shadow.' },
      { file: 'img-1142', alt: 'Thunderhead swelling over the plain', orientation: 'portrait', note: 'A thunderhead swells upward through the frame with a dark cloud pressing in from the top. Blue sky shows through the gaps.' },
      { file: 'img-3058', alt: 'Blue hour thinning to a single light', orientation: 'landscape', note: 'The light has drained to one thin band at the horizon under a deep blue sky. The ground below is almost the same color as the air.' },
      { file: 'img-3094', alt: 'Towering cloud in a darkening sky', orientation: 'landscape', featured: true, note: 'A cumulus tower holds warm light on its upper flank while the blue around it deepens. Smaller clouds scatter across the top of the frame.' },
      { file: 'img-6549', alt: 'Solitary tree on a dusk-lit ridge', orientation: 'landscape', note: 'People sit on a high ridge looking out at layered hills while a lone tree stands at the edge. The clouds over them are lit pink from below.' },
      { file: 'img-6552', alt: 'Sun failing behind a lone silhouette', orientation: 'landscape', note: 'The sun sits low behind a small tree on the far ridge. The blue above deepens to near black at the top of the frame.' },
      { file: '7r51848', alt: 'Storm cell drifting over the flats', orientation: 'portrait', note: 'A storm cell is lit from inside by lightning, glowing violet over the flats. A thin line of the horizon still holds a little warmth.' },
      { file: '7r52330', alt: 'One cloud adrift in cobalt', orientation: 'landscape', note: 'A single cloud floats in a cobalt sky that darkens toward the top. A trail of smaller wisps drifts off behind it.' },
      { file: '7r52268', alt: 'Clouds luminous against deep blue', orientation: 'landscape', note: 'Two cloud masses stand up against a sky pulled nearly to black. The taller one on the right holds the brightest light.' },
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Looking close.',
    images: [
      { file: '7r51025-enhanced-sr', alt: 'Rain-wet leaf in darkness', orientation: 'portrait', featured: true, note: 'A broad leaf after rain, beaded with drops and lit just enough to separate it from the dark. Most of the frame is left to shadow.' },
      { file: '7r51024-enhanced-sr', alt: 'Rain beaded across a dark leaf', orientation: 'landscape', note: 'Rain sits in beads across the surface of a large dark leaf. The veins catch the light and lead the eye across the frame.' },
      { file: '7r51018-enhanced-sr', alt: 'Rain held in the veins of a leaf', orientation: 'landscape', note: 'Water pools along the veins of a leaf and fills the texture between them. The frame is close enough that the leaf becomes a landscape.' },
      { file: '7r50580-enhanced-sr', alt: 'Bougainvillea opening in the green', orientation: 'landscape', note: 'Magenta bracts open in a cluster against soft green leaves. The small white flowers at their centers are the actual blooms.' },
      { file: '7r51505-enhanced-sr', alt: 'A bee working a lemon blossom', orientation: 'landscape', note: 'A bee works a small white blossom among glossy dark leaves. More blossoms wait in the shadow at the bottom of the frame.' },
      { file: 'dsc-0009-2-enhanced-sr', alt: 'A fern frond reaching out of black', orientation: 'landscape', note: 'A fern frond reaches across the frame from the right, lit against a black background. A single red stem crosses behind it.' },
      { file: '7r51108-enhanced-sr', alt: 'Sun breaking through the canopy', orientation: 'portrait', note: 'Looking straight up, trunks and branches frame a gap where the sun breaks through. The leaves turn the light green as it comes down.' },
      { file: 'dscf1737', alt: 'Palms against a bright sea sky', orientation: 'portrait', note: 'Palms stand in silhouette against a bright sky over the sea. Tall white cloud builds behind them.' },
      { file: 'dscf1658', alt: 'Red blooms beneath a white balcony', orientation: 'portrait', note: 'Red ginger and palms crowd the foot of a white building. The frame is mostly green, with the red as the accent.' },
      { file: 'dscf1573', alt: 'Clouds through a frame of branches', orientation: 'portrait', note: 'Small white clouds fill a strong blue sky, framed by dark branches at the edges. The tree at the corner holds the frame closed.' },
      { file: 'dscf1845', alt: 'Gold cloud over a breaking shore', orientation: 'portrait', note: 'A gold cloud hangs over the water while a wave breaks onto dark sand. A band of cloud sits low along the horizon.' },
      { file: 'dscf1844', alt: 'Wet sand reaching a point of palms', orientation: 'portrait', note: 'Wet sand reflects the sky as it runs out to a point of palms. The tide has just pulled back.' },
      { file: 'dscf1831', alt: 'Red ginger under a stand of palms', orientation: 'portrait', note: 'Red ginger blooms under a stand of tall palms. The frame is layered from the flowers up into the canopy.' },
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset over wildflower field', orientation: 'portrait', note: 'A field of orange wildflowers under a sky turning pink and blue at sunset. Two trees mark the far edge of the field.' },
      { file: '7r51784-enhanced-sr', alt: 'A flowering tree beneath heavy cloud', orientation: 'portrait', note: 'A tree in pink bloom sits under heavy grey cloud. Darker trees close the frame on both sides.' },
      { file: '7r51911-enhanced-sr', alt: 'Storm cloud rising past the treeline', orientation: 'portrait', note: 'A storm cloud climbs above the treeline, lit on one side. The tops of bare branches sit along the bottom edge.' },
      { file: 'dscf0425', alt: 'Foliage closing over a dusk path', orientation: 'portrait', note: 'Vines grow over the face of a white building and across its barred window. The green has taken over most of the wall.' },
      { file: 'dscf0783', alt: 'Bamboo standing in low green light', orientation: 'portrait', note: 'Bamboo rises straight up on every side and closes the sky to a small gap. The light reaches the ground already green.' },
      { file: 'img-0075', alt: 'Light reaching into stone', orientation: 'portrait', note: 'Light falls through a mist of fine water onto a single bright leaf. Everything around it stays in shadow.' },
      { file: 'img-6662', alt: 'A lone figure against the dunes', orientation: 'landscape', featured: true, note: 'A single figure crosses an open field of white sand under a wide, streaked sky. The person is kept small; the scale is the subject.' },
    ]
  },
  {
    id: 'water',
    name: 'Water',
    description: 'Where land dissolves.',
    images: [
      { file: '7r50674-enhanced-sr', alt: 'El Arco de Cabo San Lucas', orientation: 'landscape', featured: true, note: 'El Arco at Cabo San Lucas, with small boats working the water beneath the rock. The clouds open above it and the sea catches the light.' },
      { file: '7r50680-enhanced-sr', alt: 'Turquoise sea against rock formations', orientation: 'landscape', note: 'Rock formations rise straight out of turquoise water. The sea is choppy in the foreground and calm at their base.' },
      { file: '7r50993-enhanced-sr', alt: 'Blue hour over Cabo harbor', orientation: 'landscape', note: 'The harbor goes blue after sunset with a dark headland on the right. A few boats leave white lines on the water.' },
      { file: '7r50971-enhanced-sr', alt: 'Golden sunset over coastal town', orientation: 'landscape', note: 'The sun sets between two hills with the town spread along the shore. The water carries the gold back toward the camera.' },
      { file: '7r50804-enhanced-sr', alt: 'A small cove beneath raw rock', orientation: 'landscape', note: 'Raw rock walls close around a small cove with a strip of sand. One umbrella on the beach gives the cliffs their size.' },
      { file: 'dscf0952', alt: 'Traditional boat on Kyoto river', orientation: 'portrait', note: 'A long wooden boat carries a few people down a clear river between green hills. More boats wait along the bank.' },
      { file: 'img-7461-hdr-enhanced-hdr-enhanced', alt: 'Riverboat at pink dusk', orientation: 'landscape', note: 'A riverboat sits on still water with the city behind it in pink haze. The towers fade the further back they stand.' },
      { file: 'dscf0585', alt: 'Twilight settling over still water', orientation: 'portrait', note: 'Dusk settles over still water under a heavy violet sky. A few buildings line the far bank.' },
      { file: 'dscf1792', alt: 'A dark stream threading the woods', orientation: 'portrait', note: 'A dark stream runs between rocks under overhanging trees. A few red and white fish show near the surface.' },
      { file: 'dscf1928', alt: 'Sea and sky dissolving at dusk', orientation: 'portrait', note: 'The sea and the sky meet in the same dark color at dusk. A line of palms with a few lights marks the shore.' },
      { file: 'dscf1941', alt: 'Tide breathing against a dusk shore', orientation: 'portrait', note: 'Low waves come in across a dark shore. The last orange of the day sits under a band of cloud.' },
      { file: 'img-2526', alt: 'A single post standing in blue water', orientation: 'portrait', note: 'A white post and a small lamp stand against deep blue, crossed by power lines. The frame is almost all sky.' },
      { file: '7r50953', alt: 'Sun sinking past a far ridge', orientation: 'portrait', note: 'The sun drops behind a far ridge and lays a path of light on the water. The hills on either side are already dark.' },
      { file: '7r50996', alt: 'A harbor under violet dusk', orientation: 'landscape', featured: true, note: 'A harbor at dusk, the clouds lit violet and gold above the waterfront. A boat\'s wake cuts across the water toward the shore.' },
    ]
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'What we build toward the sky.',
    images: [
      { file: 'img-7576-enhanced', alt: 'Shanghai Tower from below', orientation: 'portrait', featured: true, note: 'The Shanghai Tower seen from its base, the twist of the facade rising into a pale sky. Neighboring towers hold the edges of the frame.' },
      { file: 'img-7575-enhanced', alt: 'A glass tower narrowing to a point', orientation: 'portrait', note: 'A glass tower narrows to a point against a white sky. Shot from the base, its grid of windows runs straight up.' },
      { file: 'img-7598-enhanced-sr', alt: 'Pagoda eaves lit red at night', orientation: 'portrait', note: 'Layered eaves are lit red and gold against the night. The view looks up through them from below.' },
      { file: 'img-7610-enhanced-sr', alt: 'Temple reflected in purple water', orientation: 'landscape', note: 'A temple is lit at night and its reflection lies in purple water. A lit bridge runs along the shore.' },
      { file: 'img-7395-enhanced-sr', alt: 'Temple gate against blue sky', orientation: 'landscape', note: 'A temple gate with a gold roof stands against a clear blue sky. Dark trees frame it on both sides.' },
      { file: 'dscf0530', alt: 'A night crossing under lit towers', orientation: 'portrait', note: 'A crosswalk runs under a lit walkway between dark towers. A tower in the distance glows blue.' },
      { file: 'dscf0423', alt: 'A narrow alley lit by one lamp', orientation: 'portrait', note: 'One lamp lights a narrow alley at night. The doors and stairs along it stay mostly in shadow.' },
      { file: 'dscf0261', alt: 'A stairwell lit from one window', orientation: 'portrait', note: 'Light from one window falls across a stairwell. The railing and the steps turn into lines of light and shadow.' },
      { file: 'dsc-1076-enhanced', alt: 'Blue glass rising from a garden pond', orientation: 'landscape', note: 'Blue glass forms rise out of a garden pond like reeds. The planting around the water is green and pink.' },
      { file: 'dsc-1081-enhanced', alt: 'Red glass spires across a lawn', orientation: 'landscape', note: 'A field of red glass spires stands across a green lawn. The sky above is clear blue with light cloud.' },
      { file: 'dsc-1137-enhanced', alt: 'A glass sun among the trees', orientation: 'landscape', note: 'A sphere of red and yellow glass coils sits among green trees. It reads like a sun against the blue sky.' },
      { file: 'dsc-1138-enhanced', alt: 'A tower of red and gold glass', orientation: 'landscape', note: 'A tall tower of red and gold glass rises above the treeline. White cloud breaks up the blue behind it.' },
      { file: 'gv-1fd48bd9', alt: 'Glass tower rising into the night', orientation: 'landscape', note: 'A tower of lit offices rises into the night. A single street lamp sits at its corner.' },
      { file: 'dscf0503', alt: 'Red light spilling across a night street', orientation: 'portrait', note: 'A red neon sign runs down the side of a building at night. The rest of the street sits in dark green and brown.' },
      { file: 'dscf0580', alt: 'A dim alley swallowed by green', orientation: 'portrait', note: 'A narrow path runs between buildings under a cover of plants. The green closes in from both sides.' },
      { file: 'dscf0671', alt: 'Paper lanterns glowing against the night', orientation: 'portrait', featured: true, note: 'Tiers of paper lanterns glow against the night, each one inscribed. A wooden notice board stands in front of them.' },
      { file: 'dscf0876', alt: 'Temple roofline against the treeline', orientation: 'portrait', note: 'A temple roofline shows above a dense treeline under a grey sky. The roof is the only straight line in the frame.' },
      { file: 'dscf1022', alt: 'A tower reduced to vertical lines', orientation: 'portrait', note: 'A building facade is reduced to vertical fins in black and white. Their shadows cut across them on a diagonal.' },
      { file: 'dscf1059', alt: 'A spire against a bruised twilight', orientation: 'portrait', note: 'A tower with a round observation deck stands against a bruised violet sky. A railing and trees frame the bottom.' },
      { file: 'dsc-0101', alt: 'City skyline burning blue at night', orientation: 'landscape', note: 'The skyline burns blue and neon across the river at night. The lights repeat in the water below.' },
      { file: 'dsc-0329', alt: 'Light through a derelict hall', orientation: 'landscape', note: 'Light comes into a derelict hall across a floor of broken boards. The walls are stained and peeling.' },
      { file: 'img-0161', alt: 'Stairs descending into low light', orientation: 'portrait', note: 'A building with lit floors stands alone in the dark. Its light reflects in the water at its base.' },
      { file: 'img-7462', alt: 'Harbor city glowing at dusk', orientation: 'landscape', note: 'The city glows along the river at dusk under a broken sky. Boats line the near bank.' },
    ]
  },
  {
    id: 'light',
    name: 'Light',
    description: 'What changes everything.',
    images: [
      { file: 'img-7055-enhanced-enhanced-sr', alt: 'Sunset over wildflower field', orientation: 'portrait', featured: true, note: 'A field of orange wildflowers under a sky turning pink and blue at sunset. Two trees mark the far edge of the field.' },
      { file: '7r50971-enhanced-sr', alt: 'Golden sunset over coastal town', orientation: 'landscape', note: 'The sun sets between two hills with the town spread along the shore. The water carries the gold back toward the camera.' },
      { file: 'burningcold-enhanced', alt: 'A frame burning in cold color', orientation: 'landscape', note: 'Light is painted around a bench in cold blue and magenta. The color looks like fire but holds the shape of the object.' },
      { file: 'dscf0331', alt: 'Lanterns along a shrine at night', orientation: 'portrait', note: 'Rows of paper lanterns glow along a shrine at night. A dark car passes on the street below.' },
      { file: 'dscf1419', alt: 'A globe of light held in shadow', orientation: 'portrait', note: 'A glass sphere is held up against a field of lights. The scene inside it turns upside down.' },
      { file: 'dsc-0014', alt: 'A carved ram emerging from black', orientation: 'landscape', featured: true, note: 'A carved ram\'s head in dark metal, its horns curling out of the black. Light falls across the brow and leaves the rest to shadow.' },
      { file: 'dsc-0378', alt: 'Neon traced across the night', orientation: 'landscape', note: 'Long exposure pulls neon into streaks across a dark frame. A silhouette stands in the middle of the lines.' },
      { file: 'img-0132', alt: 'A chandelier suspended in darkness', orientation: 'portrait', featured: true, note: 'A crystal chandelier hangs lit in a dark room. Every arm and drop catches a point of light.' },
      { file: 'img-2528', alt: 'A ribbon of light drawn in the dark', orientation: 'landscape', note: 'A ribbon of white light coils around a seated figure. The exposure keeps the person faint and the light solid.' },
      { file: 'img-2972', alt: 'Fire taking a frame in the night', orientation: 'landscape', note: 'Red and green light covers a figure and the ground around it. The color reads like fire spreading through the frame.' },
      { file: '7r52035', alt: 'Sparks raining against a black sky', orientation: 'portrait', note: 'Sparks rise and fall in a white column against a black sky. A small glow on the ground marks where they start.' },
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
