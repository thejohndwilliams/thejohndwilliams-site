# VOICE.md, the register law for public copy

Core law: cut every sentence that argues for seriousness; keep only sentences
that assume it. If a line sounds like a resume bullet or a pitch, delete it.

Adopted 2026-07-11 from the four-reader audit and the twelve-specialist
roadmap pass. Every public string on this site obeys the rules below. The
mechanically checkable subset is locked in tests/hazards.test.ts; the rest
is enforced by reading every public string aloud before it ships.

## The twelve rules

1. Lead with finished identity. Name plus two present-tense roles inside the
   first fifteen words of the site. Identity is declared once, on the home
   hero; every page after assumes it.
2. Ban ascent labels. No rising, aspiring, emerging, pursuing, or any label
   that describes a climb rather than a station.
3. Omit unfinished credentials. No "(in progress)", no GPA, no certifications
   or commissions that are not yet held.
4. Delete interrupted-life explanations. No "life intervened", no detours
   narrated to justify the path taken.
5. Never defend the work's seriousness. No "not a hobby", no "actually",
   no litigation of intent. State the practice; stop.
6. Silence future claims until they are live. No "coming soon", no
   "on the way", no "one day". A thing exists or it is not mentioned.
7. Professional nouns in Connect and navigation. Code, Photography, Design.
   Labels name the thing, never the enthusiasm.
8. No rhetorical questions soliciting work. "Work together?" and
   "Have a project in mind?" are replaced by plain declaratives.
9. Sentences end on the practice, never on the proof. "The discipline is
   the point" is the model.
10. Paths are presented as sequence, never as argument. Film, then data,
    then security, then photography. No "ended up here", no apology.
11. Captions stay under eight words, declarative. "Sky, earth, water,
    structure, light." is the model.
12. Architecture obeys the same law. Section order ranks what is assumed
    serious: what you are, what you have made, what you support.

## Always

Zero em-dashes in public copy. Professional framings only: "satellite
communications company", "enterprise operations", "incident command",
"regulated environments". Nothing more specific about systems, customers,
or programs. The discipline, not the details.

## Enforcement

Mechanical locks (tests/hazards.test.ts, voice-law suite): banned phrases
fail the gate in src/pages, src/components, src/content. Everything else:
read it aloud. If it argues, it dies.
