# PR review doctrine

This file steers the automated Claude review that runs on every pull request
(.github/workflows/claude-review.yml). It exists because several agents push
to this repository under the owner's account, and the costliest defects of
2026 arrived as plausible-looking PRs: drafts marked "do not merge" that
reached production, a merge over a red check, a "restored" file that was a
regeneration missing three incident fixes, comment deletions hidden behind a
two-character title. The review's job is to catch those before a merge, not
to restyle working code.

Read CLAUDE.md and design/VOICE.md first. They are the law; this file is the
checklist of how the law gets broken.

## Judge the real diff

- Use `gh pr diff` (merge-base, three-dot). Never judge by the title or the
  body; read every hunk. Say plainly when a body undersells or misstates the
  diff.
- Deleted lines matter more than added ones. Call out every removed comment,
  test, assertion or lock, and say whether the PR justifies it.

## Blocking (verdict BLOCK)

1. **A lock was weakened.** Any assertion in `tests/` or `e2e/` removed,
   loosened, skipped, or rewritten to pass. Locks change by MIGRATION (the
   invariant moves with the code and stays as strict), never by stripping.
   A budget demotion in `.lighthouserc.json` counts.
2. **Regeneration presented as extraction.** If the PR claims to move,
   extract or restore code, grep the destination for the guarded
   fingerprints of the source (the identifiers `tests/hazards.test.ts`
   locks on that surface). A rewrite that drops one is a regression even
   when it looks cleaner. The photography lightbox is the most scarred
   surface: `__lenis?.start?.()`, `navToken`, `atmosObserver?.disconnect()`,
   `lb-open` must survive any change to it.
3. **Protected comments removed.** Comments that explain a booby-trapped
   setting (astro.config.mjs build settings, `_headers`, the CI install
   step) are guardrails. Deleting one inside a behavior change blocks.
4. **Public copy breaks VOICE.md**: em dash, exclamation mark, emoji,
   engagement-begging, an unheld credential, a retired term.
5. **OPSEC.** Any public string (pages, data files, alt text, JSON-LD,
   sitemap, llms.txt, OG text, PDFs) that names an employer or product in
   prose, a customer segment, operational volumes, or program and
   export-control references. **Owner-approved exception (2026-11-24):** the
   Work page's experience record (`src/data/experience.ts`, rendered at
   `/work/#record`) and the linked résumé (`public/files/John-D-Williams-Resume.pdf`)
   may name employers/organizations, role titles, dates, marks and cleared
   high-level summaries, and still never products, customer segments,
   operational volumes, or program/export-control terms. The owner's
   blocklist is private; when in doubt, flag the string for human OPSEC
   review instead of guessing.
6. **Retired palette.** Gold (#B8973F, 184,151,63) or navy-hour (#7E9CB8,
   126,156,184) in any stylesheet or component, not only global.css.
7. **Cache law.** A changed file under `public/images`, `public/fonts` or
   `/_assets` overwritten in place instead of given a new name (those paths
   are immutable for a year at the edge).
8. **Exposure planes.** A gated or removed route must be handled in all
   three planes: rendered content, sitemap, robots. A removed route needs a
   301 and a sweep of references.
9. **CSP judged on source.** Changes to `public/_headers` or build inlining
   must hold against the BUILT output: no inline `<script type="module">`,
   no inline `<style>` while the policy forbids them.
10. **Tracked junk.** `node_modules` (including a symlink), local home paths,
    `.env`, tokens, build output.
11. **Visual change aimed straight at production** without a preview step,
    for glass, hero, palette or layout work (CLAUDE.md: visual changes need
    the owner's sign-off on a preview first). Say so; the owner decides.

## Worth saying (verdict CHANGES or APPROVE with notes)

- Interaction hygiene: handlers re-run on `astro:after-swap` must bind
  through an AbortController; no `startViewTransition` per gesture.
- Liquid Glass bounds: blur at most 44, saturate at most 1.85; never
  `backdrop-filter: url()` or `mask-image: url()`.
- Fixed `text-xl/2xl/3xl` heading steps instead of fluid `clamp()`.
- New public output formats that the em-dash and OPSEC locks do not scan.
- Dependency majors: Tailwind 4 is deliberate future work, never a drive-by
  bump.

## Output

Post ONE top-level comment (update it on later pushes rather than adding
new ones). Start with the verdict on its own line: **BLOCK**, **CHANGES**
or **APPROVE**. Then the blocking items, each with file and line, then the
rest. Use inline comments only for specific lines. Be brief and exact; no
praise padding, no restating the diff. If the PR is clean, say so in one
line.
