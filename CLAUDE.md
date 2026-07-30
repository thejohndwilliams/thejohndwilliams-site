# CLAUDE.md - thejohndwilliams.com operating manual

Audience: any AI agent or human contributor. Read fully before editing.
When this file and your instinct disagree, this file wins. The Obsidian vault
note `03_Projects/GitHub_Portfolio.md` holds session-by-session history; this
file holds the standing truth. Update both when they drift.

## What this site is

Public Astro portfolio for John D. Williams: photography sales, security and
data work shown with discipline, professional credibility. Voice: dark luxury
(quiet luxury), restraint, "Making visible." The register law lives in
design/VOICE.md (adopted 2026-07-11) and its mechanical subset is enforced
by tests/hazards.test.ts; where this file and VOICE.md disagree, VOICE.md wins. robots.txt blocks AI scrapers; /llms.txt
addresses agents directly.

## Stack

- Astro 4.16, static output. Tailwind 3.4. vitest, incl. `tests/hazards.test.ts`
  prose-rule locks (green is the gate; the count grows). Playwright e2e in
  `e2e/` runs chromium + webkit + iphone. Node pinned to 24 (`.nvmrc`;
  node 25 breaks suite imports SILENTLY — `scripts/check-node.mjs` guards). Build page count lives in tests/build.test.ts (the doc copy of the number is always stale); the exact counts
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
npm install --include=dev --no-audit --no-fund   # --include=dev: some envs set omit=dev and silently skip vitest
npm run gate                 # THE pre-push gate: node-check + full build + vitest + Playwright (chromium/webkit/iphone)
npm run gate:quick           # node-check + build + vitest, for copy-only changes
npx astro build              # quick build (npm run build adds kinetic frames + OG images)
npx vitest run               # unit + lock suites alone; green is a hard gate (count grows)
npm run audit:pages -- 390 844 ./audit-out yes all   # headless defect sweep, see scripts/audit-pages.mjs
npm run test:e2e             # Playwright
```

## Palette (current since 2026-05-31)

- `midnight` #0a0a0a background: untouchable. `cream` #F4EADE is the ivory
  foreground family (steps 100-700); there is no separate `ivory` token, and
  #FDFCFA survives only as raw literals in the kinetic dot color. The cream
  family replaced gold everywhere, including the JW mark.
- `navy-hour` (blue-hour) #7E9CB8: accent for active states and fine lines.
- `stone` #A89F8C secondary. `mute` #787878 muted prose (AA on midnight).
  `charcoal` #1A1A1A separators.
- GOLD IS RETIRED. #B8973F and its light/dark variants must not return.
- NAVY-HOUR IS RETIRED (2026-07-28). #7E9CB8 followed gold out; there is no
  hue accent. Hierarchy is brightness in the cream family: lit = active,
  the candle is the only light. Test-locked in hazards.test.ts.
- Contrast floor WCAG AA. Never opacity-40 or lower on prose; use text-mute.

## Style laws (standing rules)

- NO em-dash anywhere in public copy. Periods, commas, colons.
- No font-light / weight 300 (not loaded).
- Home hero: verb eyebrow + "John D. Williams" + the finished-identity line
  ("Enterprise operations, satellite communications. Fine-art photographer.",
  Phase 0, owner-approved). Never unfinished credentials, never triplets.
- Page-identity hero eyebrows are verbs: making visible / noticing /
  building / rising (owner ruling 2026-07-28 restored "rising" as the
  fourth verb of the sequence; it is continuing action, not a status
  label). Section and utility eyebrows are professional nouns (Object
  studies, The edition, Fine Print).
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
- Glass is the PRIMARY site thematic (decision 2026-06-09); RDS complements
  via color. Shipped complication vocabulary, reuse it, do not reinvent:
  `.glass-chip-rail` (capsule for grouped controls), `.glass-disc` (icon
  buttons, breathing + caustic), `.lens-ring` (orbiting conic rim via
  `@property --lens-a`; light bends around the rim), `.glass-plate-lb` (dark
  caption plate), `.btn-primary/.btn-outline::after` (hover light-sweep). A
  pointer caustic follows the cursor on `.glass-card/.glass-panel/
  .glass-chip-rail/.glass-disc/#site-header/footer.glass-footer` via the rAF
  tracker in BaseLayout (extend that selector to add a surface).
- DISCIPLINE: controls/panels/bars get glass life; IMAGE TILES STAY CLEAN
  (never wash a photo). One glass per surface. `@property` must degrade to a
  static rim; gate pointer effects to `(hover:hover)`; freeze all motion under
  reduced-motion.

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
- End every session with a state ledger: name the branch + URL carrying each
  in-flight change (preview vs production). Unnamed preview work rots — v9.x
  sat on a preview branch for 3 days while production looked stale.
- After deleting a route, purge the Cloudflare cache for it (s-maxage kept a
  deleted page alive for a week) and sweep tests/copy for references.

## Hazards

- NEVER patch source through bash heredocs or inline sed: shell escaping has
  corrupted code at least six times (`!` mangled to `\!`, swallowed `\u`,
  miscounted escape layers). Write files with file tools or a Python script
  that reads/writes whole files. After any chained shell command, verify the
  artifact actually exists — a timeout silently drops the later steps.
  If a heredoc is unavoidable and contains !=, `set +H` first.
- Secrets never travel through chat (two pasted tokens forced rotations).
  Hand off via file path (the 09_Restricted pattern).
- Agent sandboxes: clone to /tmp/work and edit there. The sandbox is the
  UNRELIABLE environment (disk-wedges, mid-session VM resets, no domain
  egress); the Mac + node 24 is the canonical gate environment.
- Do not edit a /sessions outputs mount copy without syncing; a linter there
  can revert or alter edits.
- Lighthouse color-contrast flags on photography backgrounds are false
  positives. The assertion stays at warn in .lighthouserc.json.
- /writing is intentionally NOT built (content-gated; tests assert absence).
  Do not ship a /writing stub or redirect.
- JSON-LD ImageGallery counts are test-asserted; keep aligned with
  src/data/photography.ts.
- Interaction hygiene (mobile lightbox crash, 2026-06-09): any handler that
  re-runs on `astro:after-swap` MUST bind through an AbortController aborted
  on re-init, or listeners pile up and leak detached DOM across SPA nav. Never
  fire a full-page `startViewTransition` per gesture (rapid swipes did 280 VTs
  and crashed iOS); use compositor transforms, one animation in flight, VT
  only for discrete morphs. `body.overflow:hidden` does NOT lock iOS scroll;
  fix the body + stop Lenis. Gallery lightbox is the reference implementation.
- BaseLayout has a `noindex` prop for preview/spike pages.

## Deferred (do not start without John)

- Earth/leaf LiquidPlate brightness (visual, preview-first).
- MDX /writing surface (needs 2-3 essays; one draft exists).
- KineticPlate3D SHIPPED to main (on /about and /relief) with the 2.5D plate
  as in-DOM fallback; the spike-era notes are history. See docs/kinetic-plate*.md.
- Heavy hero re-derivation (img-0078, 7r51108-enhanced-sr, img-0075,
  dscf0783): RESOLVED 2026-06-09 — re-derived from the actual iCloud masters
  and compared pixel crops: equal/larger files at IDENTICAL quality. Current
  derivatives are already optimal; do NOT re-encode (it regresses LCP).
  Masters are dimension-matched; re-derive only for genuine new geometry.
