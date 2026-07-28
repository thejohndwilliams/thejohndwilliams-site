> STATUS (2026-07-28): SHIPPED. The decisions this scope lists as open were
> made (raw WebGL2, luminance-as-depth, render-on-demand) and the renderer
> is on main. Kept as design-intent history.

# KineticPlate true-3D rework — scope

Status: SCOPE (not started). Author: audit session 2026-06-09.
Companion to `docs/kinetic-plate.md` (the current 2.5D system).
This document is a plan, not an implementation. Nothing here ships
without John's go and a preview-branch sign-off, per the standing
glass/visual rule in CLAUDE.md.

## The gap, stated plainly

`/about` renders four "kinetic dot-plot plates". They are the intended
flagship feature. They are not actually 3D. The current effect
(documented in `docs/kinetic-plate.md`, v5 -> v9.2) is four **2D
canvases** stacked with CSS `translateZ` inside a `perspective`
container. Pointer tilt rotates that flat stack; the "depth" is a fixed
64px Z-separation between layers plus a parallax divide. It is a
convincing relief illusion, but every dot lives on one of four parallel
planes. There is no real geometry, no per-point depth, no true rotation
of a volume.

The vault has carried "KineticPlate true-3D (OffscreenCanvas + worker)"
as deferred since the original roadmap. None of the six `feat/kinetic-*`
branches contain WebGL — confirmed by grep; they are all 2D-canvas
iterations. The flagship, as conceived, never happened.

## Target definition

A genuine GPU-rendered **point cloud per photograph**. Each cell of the
luminance grid becomes a real 3D vertex:

- `x, y` from grid column/row (centered, normalized).
- `z` from a depth source (v1: luminance as relief; v3 option: a true
  monocular depth map baked at build time).
- The cloud is projected through a real perspective camera on the GPU.
  Pointer **orbits** the actual volume; scroll dollies or rolls it.
  Because points carry independent depth, the silhouette genuinely
  changes as the cloud turns — parallax between foreground and
  background points is real, not a four-plane approximation.

Non-negotiable inheritances from the current system:

- **Quiet Power / no autonomous motion.** The cloud is at rest until
  the user drives it. No idle spin. (Render-on-demand loop, not a
  perpetual rAF — see Performance.)
- **Cream tokens stay cream.** Base point color is the cream token; the
  chromatic fringe stays additive. In WebGL the fringe becomes a
  shader-native view-dependent rim (fresnel-like), retiring the CSS
  double-canvas offset hack — cleaner and more correct than today.
- **Build-time derivation, no new CSP surface.** Geometry comes from
  the existing build-time signature JSON. The renderer library is
  bundled, shaders are inline strings. No new `connect-src`,
  `img-src`, or external fetch. The rework needs **zero** `_headers`
  CSP changes.
- **Reduced-motion + touch safety + offscreen pause** preserved.

## Architecture

### Renderer library — recommendation: OGL (or raw WebGL2)

| Option | Bundle | Fit | Verdict |
|--------|--------|-----|---------|
| three.js | ~150KB gz | Heavy scene graph we don't need; invites tech-demo creep | Reject — violates the restraint budget |
| OGL | ~8KB gz | Thin WebGL2 wrapper, instancing, hand-written shaders | Recommended |
| raw WebGL2 | 0KB | Maximum control, most code, most maintenance | Acceptable if avoiding any dep matters more |

three.js is the wrong tool for this aesthetic and the perf discipline.
OGL gives instanced-points + shader control at ~8KB; raw WebGL2 is the
zero-dependency alternative. Either keeps the bundle honest.

### One context, not four

Browsers cap live WebGL contexts (~16) and each carries real memory.
Four plates must NOT each spin up a context. Two viable shapes:

1. **Single shared context, four viewports.** One context drawn with
   scissor/viewport rects, one render loop. Simplest correct path.
   Recommended for v1.
2. **OffscreenCanvas + worker** (the vault's original phrasing). Move
   geometry and render off the main thread. Best isolation, more
   plumbing, weaker Safari history. Defer unless v1 main-thread cost
   demands it (65K points is trivial to draw; the risk is
   context/memory, not fill rate).

### Geometry + data

- Reuse `src/data/kinetic-signature.json` as-is for v1 (128x128 =
  16,384 points/plate; luminance already present). No signature rebuild
  to start.
- Points rendered as `gl.POINTS` with a soft disc in the fragment
  shader via `gl_PointCoord` (no per-dot geometry). Cheapest possible.
- The current four-band luminance partition survives as four **depth
  clusters** so the subject-pop John tuned is preserved in real Z.
- Memory: 16,384 points x (vec3 + float) x 4 plates is well under 1MB
  of attribute data. The constraint is context count and DPR, not
  vertex volume.

### Interaction

- Pointer = orbit, clamped to a shallow arc so the plate never becomes
  a spinning toy — quiet, not playful.
- Scroll = gentle dolly or roll, reusing `viewportProgress()`.
- Momentum optional, short, settles to rest (Quiet Power).
- Touch: orbit becomes an explicit one-finger drag, gated so it never
  fights page scroll (same discipline as the lightbox swipe rebuild).

### Fallback (mandatory)

The current 2.5D canvas implementation is NOT deleted. It becomes the
graceful-degradation renderer: no WebGL2, context-creation failure, or
`webglcontextlost` -> fall back to today's effect. The flagship
upgrades the capable; it never regresses the rest.

## Performance budget

- Render-on-demand: draw only while an input is active or momentum is
  settling, plus one frame on mount. No perpetual rAF. This is how "no
  autonomous motion" survives a real-time renderer.
- `IntersectionObserver` pauses a plate fully offscreen.
- Mobile: cap DPR at 1; consider decimating to every-other-point on a
  weak GPU; measure on a real device before shipping.
- One shared context; lose-context handler wired to the fallback.

## Accessibility & safety (unchanged obligations)

`role="img"` + `aria-label` per figure; canvases `aria-hidden`;
`prefers-reduced-motion` renders a single static projected frame (no
orbit, no scroll response); pointer-orbit gated off touch unless the
explicit drag affordance is added; teardown on `astro:before-swap`.

## Risks

1. **Cultural (highest).** The flagship must stay quiet. A real 3D
   point cloud invites tech-demo energy that fights Reverent Dark
   Stoicism. Mitigation: shallow orbit arcs, rest-by-default, no idle
   spin, cream-first palette. If it reads as a gimmick in preview, it
   does not ship. This outranks every technical risk.
2. **Context loss / mobile GPU variance.** Mitigated by the mandatory
   fallback and a real-device perf gate.
3. **Bundle/restraint creep.** Mitigated by OGL-or-raw, not three.js.
4. **Test surface.** `tests/build.test.ts` asserts about the current
   plates; the rework keeps those green or updates them deliberately
   (counted change, not silent).
5. **Scope drift into depth maps.** True monocular depth (MiDaS /
   Depth-Anything at build time) is better but is its own pipeline.
   Fenced into Phase 3 so v1 ships on luminance-as-depth.

## Phased plan

- **Phase 0 — spike (1 session).** One plate, OGL or raw WebGL2,
  luminance-as-depth, pointer orbit, behind a flag on a preview
  branch. Sole goal: prove the look is quiet and beautiful. John
  judges in-browser. Go / no-go gate.
- **Phase 1 — production renderer (1-2 sessions).** Shared context for
  all four plates, fallback wiring, reduced-motion + touch + offscreen
  pause, render-on-demand loop, real-device perf pass, tests green.
- **Phase 2 — shader-native fringe (1 session).** Replace the CSS
  double-canvas chroma offset with a view-dependent rim in the
  fragment shader; per-category palette (warm earth, cool water).
- **Phase 3 — true depth (optional, 1-2 sessions).** Build-time
  monocular depth maps for real geometry instead of luminance relief.
  Separate decision; not required for the flagship to land.

Realistic total to a shippable flagship (Phases 0-2): 3-4 focused
sessions. Phase 3 is a strategic add-on.

## Decisions needed from John before Phase 0

1. Renderer: OGL (~8KB dep) or raw WebGL2 (zero deps, more code)?
2. v1 depth from luminance (reuse current data, fast) — acceptable for
   first ship, with true depth maps deferred to Phase 3?
3. Interaction temperature: shallow "examine the relief" orbit
   (recommended, quiet) vs a freer turn? This sets the whole feel.
