// @vitest-environment node
// Owner ruling 2026-11-14: prints are not for sale ("I do not have the infra
// to make that happen"). The site offered limited-edition archival prints on
// every photo page, the Photography colophon, About and llms.txt. This lock
// keeps the offer off every built page until fulfilment exists; lift it
// deliberately, not by accident.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const BANNED = [
  /by inquiry/i,
  /limited edition/i,
  /edition of \d+/i,
  /archival print/i,
  /Inquire about this print/i,
  /Browse all prints/i,
  /Hahnem(ü|&uuml;|u)hle/i,
  /gicl(é|&eacute;|e)e/i,
  /prints are sold/i,
];

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

describe('no print-sale offer while prints are not for sale', () => {
  it('no built page or llms.txt offers prints', () => {
    const files = [...htmlFiles(dist), path.join(dist, 'llms.txt')];
    expect(files.length).toBeGreaterThan(50);
    const hits: string[] = [];
    for (const file of files) {
      const rel = path.relative(dist, file);
      // Draft labs stay out of scope; they are gated and noindex.
      if (/^(glass-lab|about-lab)\//.test(rel)) continue;
      const body = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      for (const re of BANNED) if (re.test(body)) hits.push(`${rel}: ${re}`);
    }
    expect(hits, hits.slice(0, 10).join('\n')).toEqual([]);
  });
});
