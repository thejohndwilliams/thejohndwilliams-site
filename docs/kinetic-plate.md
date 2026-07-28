> STATUS (2026-07-28): documents the 2.5D system, now the FALLBACK layer
> under KineticPlate3D on /about and /relief. Version table ends at v8.3 and
> is missing the v9.x rows; the dot color it calls "the cream token"
> (#FDFCFA) predates the 2026-05-31 repalette (cream is #F4EADE).

# Kinetic Plate — architecture and evolution

This document captures the design and build of the **kinetic dot-plot
plates** on `/about`. It exists so the effect can be recreated, tuned,
or rebuilt from scratch if any component is lost. The effect renders a
photograph as a luminance-partitioned dot grid stacked across four
depth-separated canvases, with two outline-only chromatic-fringe
canvases screen-blended on top. Pointer motion rotates the stage in
3-D and separates the chroma offsets; scroll parallax drifts deeper
layers less than brighter layers; all of this happens without any
autonomous animation loop.

The `/about` page currently renders four plates (sky, earth, water,
structure) from a single build-time signature.

## Design principles

The effect serves the site's **Quiet Power** discipline:

- **No autonomous motion.** Nothing moves on its own. Every pixel of
  motion is directly driven by a user input (pointer over the plate
  or page scroll). Reduced-motion users see a static painting.
- **Build-time derivation.** Photographs are collapsed at build time
  into a luminance grid. No runtime image decoding, no new CSP
  surfaces, no CLS from late-loading assets.
- **Cream tokens stay cream.** The base dot color is the site's cream
  token (`rgb(253,252,250)`). The chromatic fringe is purely additive
  via `mix-blend-mode: screen` over the cream, so the interior of each
  highlight reads as the brand color; only the silhouette rim shifts.
- **Memory-bounded.** Back two dot canvases and all chroma canvases
  cap at DPR=1 regardless of device DPR. At 560×560 that keeps each
  plate's backing store inside a predictable budget.
- **Touch-safe.** Pointer tilt gated on `(hover: hover) and
  (pointer: fine)` so taps on mobile never produce rogue tilt.

## Version history

| Version | Change                                                                       |
|---------|------------------------------------------------------------------------------|
| v5      | Single-canvas luminance dot grid (all dots on one layer)                     |
| v7      | Split into 4 depth-stacked canvases, each painting every dot at a different opacity; pointer-tracked 3-D tilt |
| v8      | Luminance-partitioned layers — each canvas paints only dots inside its own luminance band. Subject pops from background on tilt because the bright partition sits farthest forward in Z |
| v8.1    | Chromatic fringe — two screen-blended canvases paint only outline dots of the bright bucket with red-orange and cyan-blue bias. Density bumped 96→128 so the fringe has enough perimeter resolution |
| v8.2    | Fringe visible at rest — baseline CSS offset (`--cx`=1.5px, `--cy`=1.0px), chroma radius boosted 1.45× past the cream dot, outline thresholds loosened (`LUM_MIN` 0.60→0.48, `NEIGHBOR_MAX` 0.45→0.52), alpha bumped 0.55→0.78 |
| v8.3    | Multi-spectrum — four chroma channels (red, green, blue, violet) at four staggered depths; baseline offsets fan out in four directions forming a rainbow ring around every silhouette |

Commit hashes (main): `58a15b9` (port forward) → `268031f` (v7) →
`52ce6a3` (v8) → `e1d8612` (v8.1) → `ca50d19` (v8.2) → `5b161f5`
(merge to main).

## Build pipeline

### The signature script

**File:** `scripts/build-kinetic-signature.mjs`

Inputs: four source photographs (one per category: sky, earth, water,
structure). For each image, the script downsamples to a `COLS × ROWS`
grid (currently **128×128**) and for each cell computes a luminance
value in `[0, 1]` using the Rec. 709 weights
`0.2126·R + 0.7152·G + 0.0722·B`. The grid is flattened row-major into
a JSON array.

Output: `src/data/kinetic-signature.json`, shaped as

```
{
  "cols": 128,
  "rows": 128,
  "frames": [
    { "id": "sky",       "alt": "...", "grid": [0.92, 0.88, ...] },
    { "id": "earth",     "alt": "...", "grid": [...] },
    { "id": "water",     "alt": "...", "grid": [...] },
    { "id": "structure", "alt": "...", "grid": [...] }
  ]
}
```

At 128×128 the file is ~419 KB. If density is bumped further (say
160×160), file size scales with the square — budget accordingly.

### Why 128

At a 560 px plate surface, 128 cells gives ~4.4 px cell spacing. That
is dense enough for the 4-neighbor outline detector to resolve
continuous silhouette curves cleanly (at 96 the fringe was visibly
segmented on curved edges like thunderheads).

## Runtime architecture

**File:** `src/components/KineticPlate.astro`

### DOM

```
<figure class="kinetic-plate" data-plate="{payload JSON}">
  <div class="kinetic-plate__stage">
    <canvas data-layer="3"></canvas>   <!-- darkest, furthest back -->
    <canvas data-layer="2"></canvas>
    <canvas data-layer="1"></canvas>
    <canvas data-layer="0"></canvas>   <!-- brightest, furthest forward -->
    <canvas data-chroma="r"></canvas>  <!-- outline-only red plate -->
    <canvas data-chroma="b"></canvas>  <!-- outline-only blue plate -->
    <!-- v8.3 adds data-chroma="g" (green) and data-chroma="v" (violet) -->
  </div>
</figure>
```

The `data-plate` attribute carries the serialized luminance grid so
the script can mount without re-fetching.

### 3-D stage

```css
.kinetic-plate        { perspective: 900px; }
.kinetic-plate__stage { transform-style: preserve-3d;
                        transform: rotateX(var(--rx)) rotateY(var(--ry)); }
```

Perspective lives on the outer figure; `preserve-3d` on the stage.
This arrangement means each child canvas's own `translateZ` is
honored by the perspective divide, so closer layers shift more in
screen space on tilt than farther layers (subject-pop).

### Per-layer depth

```
layer 0 (brightest):  translateZ(+32px)
layer 1:              translateZ(+12px)
layer 2:              translateZ(-12px)
layer 3 (darkest):    translateZ(-32px)
```

64 px of total depth separation. Straddling zero means the plate as a
whole feels centered on the page surface rather than bulging out of
it.

### Luminance partition

Each layer owns a non-overlapping, exhaustive range of `[0, 1]`:

```ts
const LAYERS = [
  { lumLo: 0.60, lumHi: 1.01, opacity: 1.00, parallax: 1.00, capDpr: false },
  { lumLo: 0.35, lumHi: 0.60, opacity: 0.92, parallax: 0.60, capDpr: false },
  { lumLo: 0.15, lumHi: 0.35, opacity: 0.78, parallax: 0.30, capDpr: true  },
  { lumLo: -0.01, lumHi: 0.15, opacity: 0.62, parallax: 0.00, capDpr: true },
];
```

Every dot paints on **exactly one** layer per frame — total draw
calls across all four layers equal a single full grid pass, so
partitioning costs nothing over v7 despite giving subject-pop.

### Scroll parallax

`viewportProgress()` returns `[-1, 1]` based on the plate center's
distance from the viewport center. Each layer's per-frame Y offset is
`progress × layer.parallax × MAX_PARALLAX_PX` (22 px), X is 35% of
that. Layer 0 drifts most (parallax 1.0), layer 3 is anchored
(parallax 0.0). Closer-moves-more is the same directional cue as the
tilt divide — the two motion signals reinforce each other.

### Pointer tilt

```ts
const r = fig.getBoundingClientRect();
const nx = (e.clientX - (r.left + r.width / 2))  / (r.width  / 2);
const ny = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
tiltRy =  clamp(nx, -1, 1) * 10;  // degrees
tiltRx = -clamp(ny, -1, 1) * 10;
```

Y-axis inverted so cursor-up tilts the plate's top **away** from the
viewer (natural "looking over" feel). Applied via `--rx` / `--ry`
CSS custom properties on the stage, so the canvases don't repaint on
tilt — only the GPU-composited transform updates. Coalesced through
`requestAnimationFrame`.

### Chromatic fringe

**The trick.** Two additional canvases (`data-chroma="r"` and
`data-chroma="b"`) sit at the same `translateZ(+32px)` as layer 0 and
paint **only the outline dots of the bright bucket** — those whose
4-cardinal neighbors include at least one pixel below the fringe
threshold (the silhouette where subject meets background). Interior
highlight dots have bright neighbors and are excluded.

The red plate uses `rgb(255,72,56)`; the blue uses `rgb(56,168,255)`.
Both render at `alpha: 0.78` with `mix-blend-mode: screen` so they
additively combine over the cream dots beneath. On overlap they
cancel back to neutral — the fringe appears only on the rim.

The two chroma plates are **offset in opposite directions** via CSS:

```css
.kinetic-plate__chroma[data-chroma="r"] {
  transform: translateZ(32px) translate3d(var(--cx, 1.5px), var(--cy, 1px), 0);
}
.kinetic-plate__chroma[data-chroma="b"] {
  transform: translateZ(32px) translate3d(calc(var(--cx, 1.5px) * -1),
                                          calc(var(--cy, 1px) * -1), 0);
}
```

The pointer handler writes `--cx`/`--cy` to the stage in the same rAF
flush as `--rx`/`--ry`. **No canvas repaint** on tilt — the chroma
plates are still composited, just translated. That's what keeps the
effect inside the Quiet Power budget despite the extra canvases.

#### Why the baseline offset matters (v8.2 fix)

v8.1 set `--cx`/`--cy` to 0 at rest. The chroma dots stacked exactly
on the cream dots, and screen-blending a bright channel onto
near-white collapses to near-white — no visible fringe. John caught
this with a screenshot of the Sky plate showing cream dots but no
color. The fix was a **four-part change** in v8.2:

1. CSS defaults on `--cx`/`--cy` set to 1.5 px / 1.0 px so chroma
   plates are offset at rest.
2. `CHROMA_RADIUS_BOOST = 1.45` — chroma dots painted 45% larger than
   the cream dot they fringe, so the colored rim extends past the
   white disc instead of hiding inside it.
3. Outline thresholds loosened: `OUTLINE_LUM_MIN` 0.60→0.48,
   `OUTLINE_NEIGHBOR_MAX` 0.45→0.52 — softer edges (clouds,
   diffuse highlights) catch fringe, not just specular-on-shadow.
4. Alpha bumped 0.55→0.78.

### Outline detection algorithm

Inside the chroma draw loop, for every bright-bucket cell:

```ts
if (lum < OUTLINE_LUM_MIN) continue;                          // interior-dark skip
const up = data.grid[idx - cols]   or 0 if row 0;
const dn = data.grid[idx + cols]   or 0 if last row;
const lf = data.grid[idx - 1]      or 0 if col 0;
const rt = data.grid[idx + 1]      or 0 if last col;
if (min(up, dn, lf, rt) >= OUTLINE_NEIGHBOR_MAX) continue;    // interior-bright skip
// otherwise: paint the chroma dot.
```

Treating edge cells as having a "dark" neighbor means the plate's
outer boundary is always fringed — natural because the subject
genuinely ends at the plate edge.

## Tunables

All numeric knobs live at the top of the TypeScript block in
`KineticPlate.astro`. From fastest to slowest to change (fastest = no
signature rebuild needed):

| Constant                  | Purpose                                                |
|---------------------------|--------------------------------------------------------|
| `MAX_TILT_DEG`            | Max degrees of rotation on pointer move                |
| `MAX_PARALLAX_PX`         | Max scroll drift for the front layer                   |
| `MAX_CHROMA_PX`           | Extra chroma offset at corner cursor                   |
| `REST_CHROMA_X`/`_Y`      | Baseline chroma offset at rest                         |
| `OUTLINE_LUM_MIN`         | Bright-bucket floor for outline candidacy              |
| `OUTLINE_NEIGHBOR_MAX`    | Neighbor luminance below which cell becomes outline    |
| `CHROMA_RADIUS_BOOST`     | Multiplier on chroma dot radius past cream radius      |
| `DOT_R_MIN`/`MAX`         | Cream dot radius range (desktop)                       |
| `DOT_R_MOBILE_MIN`/`MAX`  | Cream dot radius range (<640 px viewports)             |
| `ALPHA_FLOOR`/`RANGE`     | Cream dot opacity floor and span with luminance        |
| `LAYERS[*].lumLo`/`Hi`    | Luminance partition boundaries                         |
| `LAYERS[*].parallax`      | Per-layer scroll drift multiplier                      |
| `LAYERS[*].opacity`       | Per-layer alpha (affects atmospheric perspective)      |
| `LAYERS[*].capDpr`        | If true, layer renders at DPR=1 (memory cap)           |
| `CHROMA[*].rgb`/`alpha`   | Per-channel color and blend alpha                      |

Signature rebuild is required to change:

| File / constant                          | Purpose                             |
|------------------------------------------|-------------------------------------|
| `scripts/build-kinetic-signature.mjs` `COLS`/`ROWS` | Grid density              |
| Source photographs                       | What the plates depict              |

After any of those, run `node scripts/build-kinetic-signature.mjs` to
regenerate `src/data/kinetic-signature.json`.

## Accessibility & safety

- `role="img"` on the outer `<figure>`, `aria-label` carries the alt
  text for the depicted photograph.
- All canvases marked `aria-hidden="true"` — they're presentational
  pixel surfaces, not independent content.
- `@media (prefers-reduced-motion: reduce)` freezes tilt, scroll
  parallax, and chroma offset; a single static frame renders.
- `(hover: hover) and (pointer: fine)` gate keeps pointer tilt off
  touch devices, which otherwise register taps as rogue rotations.
- `IntersectionObserver` pauses redraws while the plate is fully
  off-screen.
- `astro:before-swap` teardown hook removes listeners cleanly on
  view-transition navigation.

## How to recreate from scratch

1. Pick four photographs that vary in luminance distribution (a
   bright-sky scene, a dark-earth scene, a mid-tone water scene, a
   high-contrast structure). Place them where the signature script
   expects them.
2. Copy `scripts/build-kinetic-signature.mjs`. Run it; confirm
   `src/data/kinetic-signature.json` appears at the right shape.
3. Drop `src/components/KineticPlate.astro` into any page and mount
   it four times with `<KineticPlate category="sky" />` etc.
4. Verify the reduced-motion and touch paths by flipping
   `prefers-reduced-motion` and tapping on a phone.
5. Tune from the top of the tunables table downward — tilt and
   parallax first (they're the loudest), chroma second.

## Open questions / future directions

- Higher density (160×160 or 192×192) would let the fringe read
  cleanly at larger plate sizes on ultra-wide monitors, at the cost
  of a linearly larger signature JSON payload.
- Per-category chroma palette — today every plate shares the same
  spectrum. A warm palette for `earth`, cool for `water`, etc.,
  could reinforce each plate's mood.
- Audio-reactive mode for a one-off interactive session is possible
  without violating Quiet Power if gated behind an explicit
  "click to hear" affordance.
