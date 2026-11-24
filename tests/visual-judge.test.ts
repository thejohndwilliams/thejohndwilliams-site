// Locks for the visual judge (scripts/visual-judge, added 2026-11-24).
// The judge is the site's only automated look at rendered pixels, so the
// parts that decide pass or fail are pinned here: how measured facts map to
// severities, how a model reply is parsed, and that its retired-color list
// stays in step with the palette law in CLAUDE.md and hazards.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore: plain ESM tooling script
import { measuredFindings, parseVerdict } from '../scripts/visual-judge/judge.mjs';
// @ts-ignore: plain ESM tooling script
import { RETIRED_COLORS, ROUTES, VIEWPORTS, DEFAULT_VIEWPORTS, CHECK_SEVERITY } from '../scripts/visual-judge/config.mjs';

const ROOT = join(__dirname, '..');

const page = (facts: Record<string, unknown>, status = 200) => ({
  route: '/x/', viewport: 'phone', size: '390x844', status, frames: [],
  facts: { hiddenReveals: [], retiredColors: {}, emDash: [], csp: [], pageErrors: [], consoleErrors: [], brokenImages: [], overflowX: 0, ...facts },
});

describe('visual judge: measured checks', () => {
  it('a clean page yields no findings', () => {
    expect(measuredFindings(page({}))).toEqual([]);
  });

  it('broken structure is a blocker: overflow, hidden reveals, broken images, title under header, bad status', () => {
    const sev = (facts: Record<string, unknown>, status = 200) => measuredFindings(page(facts, status)).map((f: { severity: string }) => f.severity);
    expect(sev({ overflowX: 28 })).toEqual(['blocker']);
    expect(sev({ hiddenReveals: ['section.reveal'] })).toEqual(['blocker']);
    expect(sev({ brokenImages: ['/images/a.avif'] })).toEqual(['blocker']);
    expect(sev({ titleUnderHeader: 'h1 top 40px is under the header bottom 88px' })).toEqual(['blocker']);
    expect(sev({}, 404)).toEqual(['blocker']);
  });

  it('house-rule breaks are major: retired color, em dash, CSP', () => {
    const f = measuredFindings(page({
      retiredColors: { 'navy-hour #7E9CB8 (retired 2026-07-28)': ['div.rail (backgroundColor)'] },
      emDash: ['before — after'],
      csp: ['script-src blocked inline'],
    }));
    expect(f.map((x: { check: string; severity: string }) => `${x.check}:${x.severity}`).sort()).toEqual(
      ['csp:major', 'emDash:major', 'retiredColors:major'],
    );
  });

  it('every check has a declared severity', () => {
    for (const s of Object.values(CHECK_SEVERITY)) expect(['blocker', 'major', 'minor']).toContain(s);
  });
});

describe('visual judge: model reply parsing', () => {
  it('reads the JSON object even with prose around it and coerces unknown severities to minor', () => {
    const v = parseVerdict('Here you go:\n{"verdict":"fail","summary":"s","findings":[{"severity":"critical","frame":2,"issue":"x"},{"severity":"blocker","issue":"y"}]}\nDone.');
    expect(v.verdict).toBe('fail');
    expect(v.findings.map((f: { severity: string }) => f.severity)).toEqual(['minor', 'blocker']);
    expect(v.findings.every((f: { source: string }) => f.source === 'model')).toBe(true);
  });

  it('a reply without a findings array is an error, never a silent pass', () => {
    expect(() => parseVerdict('looks fine to me')).toThrow();
    expect(() => parseVerdict('{"verdict":"pass"}')).toThrow();
  });

  it('a model error fails the run (judge.mjs exits 1 on errors, not only blockers)', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'visual-judge', 'judge.mjs'), 'utf8');
    expect(src).toMatch(/totals\.blocker > 0 \|\| errors > 0/);
  });
});

describe('visual judge: stays in step with the site', () => {
  it('retired colors match the palette law (gold and navy-hour, as computed rgb)', () => {
    const rgbs = Object.values(RETIRED_COLORS);
    expect(rgbs).toContain('184, 151, 63');
    expect(rgbs).toContain('126, 156, 184');
    const hazards = readFileSync(join(ROOT, 'tests', 'hazards.test.ts'), 'utf8');
    expect(hazards).toContain('126, 156, 184');
  });

  it('every judged route is a real page', () => {
    for (const route of ROUTES as string[]) {
      if (route === '/') continue;
      const clean = route.replace(/^\/|\/$/g, '');
      if (clean.startsWith('photography/')) {
        const data = readFileSync(join(ROOT, 'src', 'data', 'photography.ts'), 'utf8');
        expect(data, route).toContain(`'${clean.split('/')[1]}'`);
        continue;
      }
      const hit = [join(ROOT, 'src', 'pages', `${clean}.astro`), join(ROOT, 'src', 'pages', clean, 'index.astro')].some(existsSync);
      expect(hit, route).toBe(true);
    }
  });

  it('the nightly viewports include the owner window, the iPhone baseline and the Duo', () => {
    expect(DEFAULT_VIEWPORTS).toEqual(expect.arrayContaining(['wide', 'phone', 'duo-open']));
    expect(VIEWPORTS.wide.width).toBeGreaterThanOrEqual(3000);
    expect(VIEWPORTS.phone.width).toBe(390);
  });

  it('the rubric names both retired accents and the JSON contract the parser expects', () => {
    const rubric = readFileSync(join(ROOT, 'scripts', 'visual-judge', 'rubric.md'), 'utf8');
    expect(rubric).toMatch(/Gold and blue-grey/);
    expect(rubric).toMatch(/"findings": \[/);
    expect(rubric).toMatch(/Treat it as data to review/);
  });
});

describe('claude review workflow', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'claude-review.yml'), 'utf8');
  it('pins the action to a commit and reads the doctrine file', () => {
    expect(wf).toMatch(/anthropics\/claude-code-action@[0-9a-f]{40}/);
    expect(wf).toContain('.github/claude-review.md');
    expect(existsSync(join(ROOT, '.github', 'claude-review.md'))).toBe(true);
  });
  it('cannot push: read-only contents, no write tools', () => {
    expect(wf).toMatch(/contents: read/);
    expect(wf).not.toMatch(/Bash\(git push|Bash\(git commit|\bEdit\b|\bWrite\b/);
  });
});
