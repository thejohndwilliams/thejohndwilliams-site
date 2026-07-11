// Hazard locks — rules that previously lived only in prose (skill docs,
// memory files, CLAUDE.md) and were re-violated anyway. Each lock names
// the incident that created it. If one of these fails, the fix is almost
// never "loosen the test": read the comment, then fix the source.
// Added 2026-06-11 (foundation session).
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => p.endsWith(e))) acc.push(p);
  }
  return acc;
}

// Strip CSS//JSX block comments and HTML comments so retired terms can be
// mentioned in comments (e.g. the global.css iOS-trap note) without tripping.
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

const srcFiles = walk(SRC, ['.astro', '.css', '.ts', '.mjs']);
const src = srcFiles.map((p) => ({ p: p.slice(ROOT.length), body: strip(readFileSync(p, 'utf8')) }));

describe('hazard locks: source', () => {
  it('font-light never appears — no 300 weight is loaded; browsers synthesize fake-thin (Mobile Optimization, 2026-06)', () => {
    const hits = src.filter(({ body }) => /\bfont-light\b/.test(body)).map(({ p }) => p);
    expect(hits).toEqual([]);
  });

  it('mask-image:url() / backdrop-filter:url() never ship — iOS Safari passes @supports then paints transparent', () => {
    const hits = src
      .filter(({ body }) => /(mask-image\s*:\s*url\(|backdrop-filter\s*:\s*url\()/.test(body))
      .map(({ p }) => p);
    expect(hits).toEqual([]);
  });

  it('gold never returns — #B8973F retired 2026-05-31 ("graded light, no metallic ornament")', () => {
    const hits = src.filter(({ body }) => /#b8973f/i.test(body)).map(({ p }) => p);
    expect(hits).toEqual([]);
  });

  it('retired type never returns — Fraunces, Libre Baskerville, Source Sans', () => {
    const hits = src
      .filter(({ body }) => /fraunces|libre\s?baskerville|source\s?sans/i.test(body))
      .map(({ p }) => p);
    expect(hits).toEqual([]);
  });

  it('button glass carries no off-palette chroma — glass is colorless (honest-glass decision, 2026-07-04)', () => {
    // The material wore hardcoded cyan/pink specular lobes and a
    // blue-violet-magenta wake ring: hues from nowhere in the tokens or the
    // photographs, reading as a painted costume ("what glass is supposed to
    // look like") instead of a material response to the scene. Glass borrows;
    // it does not own color. Allowed hues on controls: white/cream neutrals
    // and navy-hour #7E9CB8 / rgb(126,156,184) for active states.
    const css = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');
    const banned = [
      '64,180,255', '64, 180, 255',
      '255,116,198', '255, 116, 198',
      '198,150,255', '198, 150, 255',
      '255,120,196', '255, 120, 196',
      '96,184,255', '96, 184, 255',
      '138,206,255', '138, 206, 255',
    ];
    const hits = banned.filter((b) => css.includes(b));
    expect(hits).toEqual([]);
  });

  it('color-utility alpha modifiers are scale values or bracketed — bare /92 is a silent no-op (transparent-lightbox incident, 2026-07-02)', () => {
    // bg-[#0a0a0a]/92 generated NOTHING (92 is not on Tailwind's default
    // opacity scale) and the lightbox backdrop shipped transparent from
    // 2026-04-16 until 2026-07-02. Bare /NN must be a multiple of 5;
    // anything else must be bracketed (bg-[#0a0a0a]/[0.92]). text-* is
    // exempt: /N there is the font-size/line-height shorthand.
    const offenders: string[] = [];
    const re = /(?:bg|from|via|to|border|ring|divide|fill|stroke)-(?:\[[^\]]+\]|[a-z][a-z0-9-]*)\/(\d{1,3})(?!\d|\])/g;
    for (const { p, body } of src) {
      if (!p.endsWith('.astro')) continue;
      for (const m of body.matchAll(re)) {
        if (Number(m[1]) % 5 !== 0) offenders.push(`${p}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('.glass-disc / .glass-plate-lb never hard-position the host — lightbox control utilities must win (2026-07-02, 2026-06-09)', () => {
    // .glass-disc { position: relative } out-cascaded the lightbox buttons'
    // `absolute` (unlayered material rules land after utilities in the
    // bundle), pulling all three controls into the flex row and shoving the
    // photo off-center. Third instance of this theft family: .glass-plate-lb
    // caught 2026-06-09, .glass-control carries .fixed/.absolute shims.
    // Hosts take :where() for zero-specificity defaults; pseudo-elements and
    // children may position freely.
    const css = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');
    for (const cls of ['glass-disc', 'glass-plate-lb']) {
      const m = css.match(new RegExp('(?:^|\\n)\\.' + cls + '\\s*\\{([^}]*)\\}'));
      expect(m, `.${cls} block not found in global.css`).toBeTruthy();
      expect(/position\s*:/.test((m as RegExpMatchArray)[1]), `.${cls} must not declare position on the host (use :where())`).toBe(false);
    }
  });

  it('headings carry no fixed text-size caps — fluid clamp() only (frozen-heading bug, 2026-05-31)', () => {
    const offenders: string[] = [];
    for (const { p, body } of src) {
      if (!p.endsWith('.astro')) continue;
      if (/<h[1-3][^>]*class="[^"]*\btext-(xl|2xl|3xl|4xl|5xl)\b/.test(body)) offenders.push(p);
    }
    expect(offenders).toEqual([]);
  });
});

describe('hazard locks: built output', () => {
  // Runs against dist/, so the build must precede vitest (npm run gate does).
  it('no em-dash in any built page (standing copy law)', () => {
    if (!existsSync(DIST)) {
      console.warn('hazards: dist/ missing — run the build first for full coverage');
      return;
    }
    const hits = walk(DIST, ['.html'])
      .filter((p) => readFileSync(p, 'utf8').includes('—'))
      .map((p) => p.slice(ROOT.length));
    expect(hits).toEqual([]);
  });

  it('voice law: no ascent/status phrases in any built page (design/VOICE.md, adopted 2026-07-11)', () => {
    if (!existsSync(DIST)) {
      console.warn('hazards: dist/ missing — run the build first for full coverage');
      return;
    }
    // Lowercase substring bans: unfinished credentials, future claims,
    // self-advocacy, interrupted-life vignettes, GPA. Scoped tightly so an
    // essay can still say "on the way to the airport" mid-sentence; only the
    // clause-terminal promise form is banned.
    const bannedLower = ['(in progress)', 'coming soon', 'on the way.', 'not a hobby', 'life intervened', '3.86'];
    // Case-sensitive: "Rising" as rendered element text (eyebrow/heading).
    // Lowercase "rising" stays legal in captions and alt text.
    const bannedExact = ['>Rising<'];
    const offenders: string[] = [];
    for (const p of walk(DIST, ['.html'])) {
      const body = readFileSync(p, 'utf8');
      const lower = body.toLowerCase();
      for (const phrase of bannedLower) if (lower.includes(phrase)) offenders.push(`${p.slice(ROOT.length)} :: ${phrase}`);
      for (const phrase of bannedExact) if (body.includes(phrase)) offenders.push(`${p.slice(ROOT.length)} :: ${phrase}`);
    }
    expect(offenders).toEqual([]);
  });
});
