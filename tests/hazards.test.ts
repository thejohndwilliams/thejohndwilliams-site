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
