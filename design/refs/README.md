# design/refs — visual reference convention

Adopted 2026-07-03 (vault: Monokern_Workflow_Adoption_2026-07-03). Prose
descriptions of visual intent burn review rounds; one cropped image
usually settles it. This folder is where those images live.

## The convention

1. One image per idea, cropped to just the part that matters. Never a
   full-page screenshot with "make it like this."
2. Numbered filenames mapped to a target: `01-hero-light.png`,
   `02-tile-hover.png`. The number orders the conversation; the name
   says where it applies.
3. Every image gets a provenance line in the table below. We borrow
   gestures and moods, never layouts wholesale; provenance keeps us
   honest about the difference.
4. Borrow from many sources. A single reference produces a clone;
   five references produce a direction.
5. Refs are working material, not assets. Nothing in this folder ships,
   is imported by the build, or appears in dist. Prune when a ref has
   served its purpose.

## Provenance

| File | Source | What we borrowed | Session |
|------|--------|------------------|---------|
| (none yet) | | | |

## Process rules that pair with this folder

**Net-new visual work starts with questions.** Before building anything
visual that does not exist yet, collect John's decisions first: three to
five questions covering mood, motion level, and what the element must
never do. The KineticPlate 3D work waited on exactly this and was better
for it.

**Interaction concepts are specified in one paragraph, five parts:**
base state, revealed or changed layer, geometry (mask shape, radius,
feathering), motion (what follows what, at what speed), and the
prefers-reduced-motion behavior. A spec written this way tends to build
in one pass; a vibe described across four messages tends not to.

**Feedback lands in one batch.** Scroll the preview, write everything
down, send it as one numbered list. Serial one-line reactions cost a
build-deploy cycle each.

## Register guardrails (non-negotiable, test-locked)

References inspire; they do not override the register. Ink and ivory,
no metallic ornament. Graded light rather than applied darkness. One
light per surface: the lit element is the active indicator. The
photograph is the only decoration. If a reference fights these rules,
the reference loses.
