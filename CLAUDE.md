# CLAUDE.md - thejohndwilliams.com operating manual

Audience: any AI agent or human contributor. Read fully before editing.
When this file and your instinct disagree, this file wins. The Obsidian vault
note `03_Projects/GitHub_Portfolio.md` holds session-by-session history; this
file holds the standing truth. Update both when they drift.

## What this site is

Public Astro portfolio for John D. Williams: photography sales, security and
data work shown with discipline, professional credibility. Voice: quiet
luxury, restraint, "Making visible." robots.txt blocks AI scrapers; /llms.txt
addresses agents directly.

## Stack

- Astro 4.16, static output. Tailwind 3.4. vitest (71 tests, must stay green).
  Playwright e2e in `e2e/`. Build currently emits 105 pages; the exact counts
  asserted in `tests/build.test.ts` are the source of truth, not this file.
- Fonts, self-hosted: IBM Plex Sans (UI), EB Garamond (display serif voice),
  JetBrains Mono (code). Source Sans 3 and Libre Baskerville are RETIRED.
- Images: AVIF + WebP via `<picture>`. Tiers: thumb/ 400w, gallery/ 1200w,
  hero/ 2400w, portrait/ (art-directed mobile crops). Placeholders via
  `npm run build:placeholders`.
- Security headers in `public/_headers` (Cloudflare native). Hashed assets in
  `dist/_assets/` (custom dir; the `/_assets/*` cache rule is correct).

## Commands

```
npm install --no-audit --no-fund
npx astro build              # quick build (npm run build adds kinetic frames + OG images)
npx vitest run               # 71 tests, green is a hard gate
npm run audit:pages -- 390 844 ./audit-out yes all   # headless defect sweep, see scripts/audit-pages.mjs
npm run test:e2e             # Playwright
```

## Palette (current since 2026-05-31)

- `midnight` #0a0a0a background, `cream` #FDFCFA foreground: untouchable.
- `ivory` #F4EADE: primary accent. Replaced gold everywhere, including the JW mark.
- `navy-hour` (blue-hour) #7E9CB8: accent for active states and fine lines.
- `stone` #A89F8C secondary. `mute` #787878 muted prose (AA on midnight).
  `charcoal` #1A1A1A separators.
- GOLD IS RETIRED. #B8973F and its light/dark variants must not return.
- Contrast floor WCAG AA. Never opacity-40 or lower on prose; use text-mute.

## Style laws (standing rules)

- NO em-dash anywhere in public copy. Periods, commas, colons.
- No font-light / weight 300 (not loaded).
- Hero is two lines only: verb eyebrow + "John D. Williams". Never
  credentials, never triplets.
- Verb eyebrows: making visible / noticing / building / rising.
- Photo titles one word, lowercase. Scripture pairing adjacent, not literal;
  ESV default, KJV sparingly.
- No emojis, no exclamation marks, no engagement-begging.

## Liquid Glass (standing rule: glass is never sacrificed for perf)

- Perf changes must be visually neutral. VISUAL changes ship to a preview
  branch and get John's in-browser sign-off before main. Never ship visual
  changes blind.
- Bounds: blur <= 44, saturate <= 1.85.
- NEVER `backdrop-filter: url(#...)` and NEVER CSS `mask-image: url()`.
  iOS Safari passes the @supports check, then fails to paint. Use inline SVG
  (SocialIcon pattern). Refraction = SVG feTurbulence/feDisplacementMap
  element filters on a fixed-aligned scene copy (LiquidPlate pattern).
- Children of backdrop-filter glass need `position: relative` + z-index or
  text vanishes (tile-caption incident, 2026-06-09).

## Mobile

- viewport-fit=cover and standalone meta are set, so the safe-area env() block
  at the end of `src/styles/global.css` is load-bearing. Keep it.
- Tap targets: >= 24px always, >= 44px effective on pointer:coarse
  (see LiquidPlate atelier media query for the pattern).
- Before shipping mobile-visible changes, run the audit script at 375/390/414.

## OPSEC (blocking)

This file is public. The OPSEC blocklist is therefore NOT reproduced here; it
lives in John's private opsec-review skill and vault. The shape of the rule:
no employer or product names, no customer segments, no operational volume
metrics, no export-control or program references, anywhere in public strings.
Reuse the generic framings already present on /work and /about ("enterprise
operations", "incident command", "regulated environments"). Run the
opsec-review skill on every changed public-facing string before pushing.
If you cannot run that skill, do not push public copy changes.

## Deploy

- Push to `main` -> Cloudflare Pages, live in 60-90s. NOT Vercel; ignore
  legacy Vercel comments in older files.
- Commits: `type(scope): summary` with a body covering why, what, tradeoffs.
  Co-author: John D. Williams <jndwcreative@gmail.com>.
- Auth: `gh auth git-credential`. The old iCloud token-file path is retired.
- After shipping, update the vault note with the new HEAD and what shipped.

## Hazards

- Agent sandboxes: clone to /tmp/work and edit there, preferably via Python
  scripts. Bash heredocs containing != need `set +H` first.
- Do not edit a /sessions outputs mount copy without syncing; a linter there
  can revert or alter edits.
- Lighthouse color-contrast flags on photography backgrounds are false
  positives. The assertion stays at warn in .lighthouserc.json.
- /writing is intentionally NOT built (content-gated; tests assert absence).
  Do not ship a /writing stub or redirect.
- JSON-LD ImageGallery counts are test-asserted; keep aligned with
  src/data/photography.ts.

## Deferred (do not start without John)

- Earth/leaf LiquidPlate brightness (visual, preview-first).
- MDX /writing surface (needs 2-3 essays; one draft exists).
- KineticPlate true-3D rework; /about v1 KineticPlates retire-or-replace.
- Heavy hero re-derivation (img-0078, 7r51108-enhanced-sr, img-0075,
  dscf0783): re-encode from camera masters at ingestion time. Re-encoding the
  in-repo derivatives was attempted 2026-06-09 and rejected: no size win at
  visually neutral quality.
