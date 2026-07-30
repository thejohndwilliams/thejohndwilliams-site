---
title: "The Transparent Lightbox"
description: "A photo viewer that rendered as fog for two and a half months, and the four separate defects stacked underneath it. A UI treated as an attack surface."
pubDate: 2026-07-29
category: "Engineering forensics"
draft: true
---

<!-- DRAFT for John's editorial pass. Every fact is drawn from the 2026-07-02
     root-cause record; nothing here names a customer, system, or program.
     The voice follows Making Visible: declarative, spare, mechanism over
     mood. Edit freely. Publish by setting draft: false. -->

For two and a half months, opening a photograph on this site produced fog.
Not an error. Not a blank screen. A translucent smear, the grid still faintly
visible through it, a close button floating in the wrong place, the
navigation painting over the top of everything. It looked like one bug. It
was four, stacked, and only one of them was mine.

The lesson is the one I keep relearning in every discipline: what looks like
a single failure is usually several, and they hide inside each other. You do
not fix the fog. You take the fog apart.

The first defect was the oldest, shipped months before anyone noticed. The
dialog's only darkening layer was written as a color at ninety-two percent
opacity, in a shorthand the build tool silently discards when the number is
not on its scale. So the rule was never emitted. For weeks the viewer
composited a heavy blur over a fully transparent background. Over dark
photographs it read as almost-black, close enough to correct that no one
questioned it. The bug survived precisely because it was nearly invisible.

The second defect was a material stealing position from its neighbors. A
glass surface declared where it sat on the page, and because of the order the
styles load, that declaration outranked the buttons that were supposed to
anchor to the corners. The controls became loose furniture. The photograph
shoved off center. This was the third time that same theft had happened in
the same codebase, to a different element each time. A defect class, not a
defect.

The third defect was a doubling that no one saw coming. Months earlier the
spacing scale had been rebuilt on an eight-point grid, which quietly redefined
what the size tokens meant. Controls authored under the old scale to be forty
and forty-eight pixels became eighty and ninety-six. One control used a token
that was not on the new scale at all and fell through to a default. The close
button was two defects wearing one mask: the grid sized it, the position
theft placed it.

The fourth defect was mine, and it was the one that turned three latent flaws
into a visible failure. A performance change I had shipped inlined each
page's styles instead of loading one shared file. On this site the
page-to-page transition aborts routinely, a harmless quirk until my change
gave it something to break. An aborted transition dropped whole blocks of the
viewer's styles. Measured directly: four scoped rules present on a fresh load,
zero after navigating. Under the old shared file this could not have happened.
I built the surface the other three defects needed to become fog.

Here is the part worth keeping. Every one of my pre-merge checks had passed.
I ran the build, I checked the markup, I ran the performance audit. Not one
of them ever clicked a photograph. Three of the four defects were invisible
to every check I had because they only compose wrong on interaction. A load
test cannot see them. A human opening the viewer sees them instantly.

So the viewer is now treated the way a security engineer treats any surface
that takes input: as a thing that will be exercised adversarially, not
politely. The test suite opens the photograph on a direct load and again
after a navigation, and asserts the composed geometry both ways. The silent
opacity class fails the build now. The position theft fails the build now. A
photograph carries the whole thing, so the machine has to look at the
photograph, not just weigh the page.

The fog is gone. What replaced it is not a fix. It is the assumption that the
next fog is already here, latent, waiting for one more change to make it
visible, and the discipline of looking before it does.
