// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JSDOM } from 'jsdom';
import { computeAccessibleName } from 'dom-accessibility-api';

const execAsync = promisify(exec);
// Build to a dedicated dir so this file never races build.test.ts over dist/.
const OUT = path.join(process.cwd(), 'dist-a11y-test');

// A fast, deterministic, layout-free a11y guard for the DOM/ARIA failure modes
// that broke CI (label-content-name-mismatch) and their neighbours. Built on
// dom-accessibility-api — the same accessible-name engine axe uses internally —
// because axe's own rules silently no-op in jsdom (no layout = "everything is
// invisible"). Color-contrast / target-size still belong to CI's real-browser
// Lighthouse run; this is the pre-push smoke detector.

const norm = (s?: string | null) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const SEL = 'button, a[href], [role="button"], [role="link"], summary';

// Visible text = text a sighted user reads: textContent minus aria-hidden,
// visually-hidden (.sr-only), and decorative <svg> descendants.
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"], .sr-only, svg').forEach((n) => n.remove());
  return norm(clone.textContent);
}

function audit(html: string): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const issues: string[] = [];
  const controls = Array.from(doc.querySelectorAll(SEL));

  for (const el of controls) {
    const name = norm(computeAccessibleName(el as any));
    const vis = visibleText(el);
    // label-content-name-mismatch: visible text must be contained in the name.
    if (vis && name && !name.includes(vis)) {
      issues.push(`label-content-name-mismatch: visible "${vis}" not in accessible name "${name}" — ${(el as Element).outerHTML.slice(0, 100)}`);
    }
    // every control/link must have a non-empty accessible name.
    if (!name) issues.push(`missing-accessible-name: ${(el as Element).outerHTML.slice(0, 100)}`);
  }

  doc.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('alt')) issues.push(`image-alt: <img src="${img.getAttribute('src')}"> has no alt`);
  });
  if (!norm(doc.querySelector('title')?.textContent)) issues.push('document-title: missing/empty <title>');
  if (!doc.documentElement.getAttribute('lang')) issues.push('html-has-lang: <html> missing lang');

  const seen: Record<string, number> = {};
  doc.querySelectorAll('[id]').forEach((el) => { const id = (el as Element).id; seen[id] = (seen[id] || 0) + 1; });
  for (const [id, n] of Object.entries(seen)) if (n > 1) issues.push(`duplicate-id: #${id} appears ${n}x`);

  dom.window.close();
  return issues;
}

const PAGES = ['index.html', 'about/index.html', 'work/index.html', 'photography/index.html'];

describe('Accessibility — DOM/ARIA smoke test (dom-accessibility-api)', () => {
  beforeAll(async () => {
    await execAsync(`npx astro build --outDir "${OUT}"`);
  }, 60000);

  it('harness catches label-content-name-mismatch (smoke detector has batteries)', () => {
    const bad =
      '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body>' +
      '<button aria-label="Toggle background"><span>Dim</span></button></body></html>';
    expect(audit(bad).some((i) => i.startsWith('label-content-name-mismatch'))).toBe(true);
  });

  for (const page of PAGES) {
    it(`${page} has no DOM/ARIA a11y violations`, () => {
      const html = fs.readFileSync(path.join(OUT, page), 'utf-8');
      const issues = audit(html);
      expect(issues, issues.join('\n')).toEqual([]);
    });
  }
});
