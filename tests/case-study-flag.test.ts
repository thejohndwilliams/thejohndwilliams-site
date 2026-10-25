// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { showCaseStudy } from '../src/lib/case-study-flag';

const ROOT = new URL('..', import.meta.url).pathname;

function templateText(source: string): string {
  const body = source.replace(/^---[\s\S]*?---/, '');
  const noComments = body.replace(/<!--[\s\S]*?-->/g, '');
  const noTags = noComments.replace(/<[^>]+>/g, ' ');
  return noTags
    .replace(/\{|\}|\(|\)/g, ' ')
    .replace(/\bshowCaseStudy\b|&&/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('case study layout flag', () => {
  it('defaults off unless PUBLIC_SHOW_CASE_STUDY is exactly true', () => {
    const flag = readFileSync(join(ROOT, 'src/lib/case-study-flag.ts'), 'utf8');
    expect(flag).toContain("import.meta.env.PUBLIC_SHOW_CASE_STUDY === 'true'");
    expect(import.meta.env.PUBLIC_SHOW_CASE_STUDY).not.toBe('true');
    expect(showCaseStudy).toBe(false);
  });

  it('allows only the two placeholder strings in the block', () => {
    const component = readFileSync(join(ROOT, 'src/components/CaseStudyLayout.astro'), 'utf8');
    expect(component).toContain('showCaseStudy &&');
    expect(component).not.toMatch(/style=/);
    expect(component).not.toMatch(/aria-label=/);
    expect(component).not.toMatch(/\salt="[^"]+"/);
    expect(component).not.toContain('—');
    expect(templateText(component)).toBe('Case study title Paragraph Paragraph Paragraph');
  });

  it('leaves a default /work build without the placeholder', () => {
    const htmlPath = join(ROOT, 'dist/work/index.html');
    if (!existsSync(htmlPath)) return;
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).not.toContain('Case study title');
    expect(html).not.toContain('case-study');
    expect(html).not.toContain('/case-study.css');
  });
});
