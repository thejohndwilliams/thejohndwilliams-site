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
    // only. Navy-hour #7E9CB8 joined gold in retirement on 2026-07-28
    // (John: "Nix it for continuity"): hierarchy is brightness in the cream
    // family, never hue. Any painted accent chroma below fails the gate.
    const css = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');
    const banned = [
      '126,156,184', '126, 156, 184', '#7E9CB8', '#7e9cb8',
      '170,200,225', '170, 200, 225',
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

describe('hazard locks: p1 review fixes (2026-07-19)', () => {
  // Tri-fleet code review P1s. Each lock pins the FIX pattern in source so a
  // refactor cannot silently reintroduce the defect class.
  const base = readFileSync(join(SRC, 'layouts/BaseLayout.astro'), 'utf8');
  const gallery = readFileSync(join(SRC, 'pages/photography/index.astro'), 'utf8');
  const lab = readFileSync(join(SRC, 'pages/about-lab.astro'), 'utf8');

  it('initBottomNav tears down via AbortController — per-swap window listeners retained detached page trees (2026-06-09 class)', () => {
    expect(base).toMatch(/bottomNavAbort\?\.abort\(\)/);
    expect(base).toMatch(/\{ passive: true, signal \}/);
  });

  it('after-swap owner restarts Lenis and clears lb-open — history-back with the viewer open left scroll dead site-wide', () => {
    const afterSwap = base.slice(base.indexOf("astro:after-swap', () => {", base.indexOf('import Lenis')));
    expect(afterSwap).toContain("classList.remove('lb-open')");
    expect(afterSwap).toContain('lenis.start?.()');
    expect(gallery).toContain('__lenis?.start?.()');
  });

  it('glass-lab is gated off the production branch - shader bench must never ship on main', () => {
    const glab = readFileSync(join(SRC, 'pages/glass-lab.astro'), 'utf8');
    expect(glab).toContain("CF_PAGES_BRANCH ?? '') === 'main'");
    expect(glab).toMatch(/Astro\.redirect\(['"]\/['"]/);
    expect(glab).toContain('noindex={true}');
  });

  it('about-lab is gated off the production branch — "Private" lab copy served publicly on main', () => {
    expect(lab).toMatch(/CF_PAGES_BRANCH[\s\S]{0,80}=== 'main'/);
    expect(lab).toContain("Astro.redirect('/', 308)");
  });
});

describe('hazard locks: /relief sweep video (2026-07-25)', () => {
  // The relief sweep is the first <video> on the site and the single
  // heaviest asset it serves (~1.5 MB, versus ~150 KB for a gallery hero).
  // It is only affordable because it is never fetched until it is on screen
  // and never fetched at all under reduced motion. Every lock below pins one
  // half of that bargain; losing any one of them turns a quiet page into a
  // 1.5 MB tax on every visitor, including the ones who asked for stillness.
  // Relief folded into Labs (owner ruling 2026-07-31): the body lives in
  // the ReliefStudies component now; every lock below still applies to it.
  const relief = readFileSync(join(SRC, 'components/ReliefStudies.astro'), 'utf8');

  it('the video ships srcless — src is assigned by the observer, not the parser', () => {
    // preload="none" alone is a hint browsers may ignore; a real src in the
    // markup is a real request. The guarantee is the missing attribute.
    expect(relief).toContain('data-src="/video/relief-sweep.mp4"');
    expect(relief).toMatch(/preload="none"/);
    expect(relief).not.toMatch(/<video[^>]*\ssrc=/);
  });

  it('reduced motion removes the video outright — a paused <video> with a src still downloads', () => {
    const rm = relief.slice(relief.indexOf('prefers-reduced-motion: reduce'));
    expect(rm.slice(0, 200)).toContain('video.remove()');
  });

  it('the sweep observer and its listeners tear down on re-init (2026-06-09 detached-tree class)', () => {
    expect(relief).toMatch(/sweepObserver\?\.disconnect\(\)/);
    expect(relief).toMatch(/sweepAbort\?\.abort\(\)/);
    expect(relief).toContain("document.addEventListener('astro:after-swap', initSweep)");
  });

  it('the still is the LCP candidate — the video is decorative and never the accessible content', () => {
    // BaseLayout's lcpImage prop builds /images/photography/<tier>/… by
    // construction and cannot address /images/relief/, so the priority hint
    // lives on the <img> itself. See the page's frontmatter note.
    expect(relief).toContain('fetchpriority="high"');
    expect(relief).toMatch(/<video[^>]{0,400}aria-hidden="true"/);
  });
});

describe('hazard locks: p2 review fixes (2026-07-19)', () => {
  const header = readFileSync(join(SRC, 'components/Header.astro'), 'utf8');
  const gallery = readFileSync(join(SRC, 'pages/photography/index.astro'), 'utf8');
  const baseL = readFileSync(join(SRC, 'layouts/BaseLayout.astro'), 'utf8');
  const slug = readFileSync(join(SRC, 'pages/photography/[slug].astro'), 'utf8');

  it('glass-shelf scroll listener binds once — per-swap re-binding stacked N listeners on the persisted header', () => {
    expect(header).toMatch(/glassHeaderBound/);
  });

  it('lightbox open/close invalidate the slide token — pending swapIn fired post-close and desynced reopen', () => {
    const open = gallery.slice(gallery.indexOf('function openLightbox'), gallery.indexOf('function closeLightbox'));
    const close = gallery.slice(gallery.indexOf('function closeLightbox'), gallery.indexOf('function closeLightbox') + 600);
    expect(open).toContain('navToken++');
    expect(close).toContain('navToken++');
    expect(gallery).toMatch(/abort'.*navToken\+\+.*clearTimeout\(swapTimer\)/);
  });

  it('page observers disconnect on re-init — undisconnected IntersectionObservers pinned detached page trees', () => {
    expect(gallery).toMatch(/atmosObserver\?\.disconnect\(\)/);
    expect(baseL).toMatch(/revealObserver\?\.disconnect\(\)/);
    expect(slug).toMatch(/exifObserver\?\.disconnect\(\)/);
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
    // Owner ruling 2026-07-28: "Rising" is the fourth verb of the page
    // eyebrow sequence (making visible / noticing / building / rising) and
    // is LEGAL as the About hero eyebrow. The 2026-07-11 audit read it as
    // an ascent status label; John: "it should read Rising just above my
    // name. Defeats the spirit otherwise." Ascent NOUNS/labels stay banned
    // via the phrase list above; no exact-match element ban remains.
    const bannedExact: string[] = [];
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

describe('hazard locks: /beyond is reachable (the experiments wing, 2026-07-31)', () => {
  // /relief shipped 2026-07-25 with exactly one inbound link: a 12px muted
  // line at the bottom of /photography, below the fold and below the Inquire
  // button. It was a top-level URL nobody could arrive at from inside the
  // site. Restraint applied to a navigation element is not restraint, it is
  // a dead end. These locks pin the three entry points that fixed it.
  const home = readFileSync(join(SRC, 'pages/index.astro'), 'utf8');
  const work = readFileSync(join(SRC, 'pages/work.astro'), 'utf8');
  const gallery = readFileSync(join(SRC, 'pages/photography/index.astro'), 'utf8');

  it('the home page grid carries a /beyond card', () => {
    expect(home).toMatch(/href="\/beyond"/);
  });

  it('/work hands off to Beyond by name', () => {
    expect(work).toMatch(/href="\/beyond"/);
  });

  it('/photography links the object axis with a photograph, not a 12px line', () => {
    const idx = gallery.indexOf('href="/beyond"');
    expect(idx).toBeGreaterThan(-1);
    expect(gallery.slice(idx, idx + 900)).toContain('/images/relief/');
  });

  it('/relief bio links survive the fold: real 301s to /beyond ship', () => {
    // The relief page folded onward to /beyond (owner rulings 2026-07-31). The
    // link-in-bio URLs printed on cards and profiles must keep resolving:
    // public/_redirects gives Cloudflare Pages a server-side 301.
    const redirects = readFileSync(join(SRC, '../public/_redirects'), 'utf8');
    expect(redirects).toMatch(/^\/relief\s+\/beyond#relief\s+301$/m);
    expect(redirects).toMatch(/^\/labs\s+\/beyond\s+301$/m);
  });

  it('no surface gains a second ivory CTA for relief: btn-primary is Inquire only', () => {
    for (const [name, body] of [['index', home], ['work', work], ['photography', gallery]] as const) {
      const hits = Array.from(body.matchAll(/href="\/relief"[^>]*/g)).map((m) => m[0]);
      for (const h of hits) expect(h, `${name}: relief link must not be a btn-primary`).not.toContain('btn-primary');
    }
  });
});
