// Visual judge, step 2: grade the captured frames.
//
//   npm run visual:judge                     # capture production, then grade
//   node scripts/visual-judge/judge.mjs --in visual-judge-out [--no-fail]
//
// Two layers, one report:
//   1. Measured checks from the capture facts (overflow, hidden reveals,
//      broken images, retired colors, em dashes, CSP, page errors). Free and
//      deterministic; they always run.
//   2. Model judgment: each page x viewport goes to Claude with its frames
//      and rubric.md, and comes back as structured findings. Runs only when
//      ANTHROPIC_API_KEY is set; without it the report says so and the
//      measured layer still gates.
//
// Writes findings.json, summary.md (GitHub job summary) and report.html
// (frames beside findings) into the capture folder. Exits 1 when any
// blocker is found, unless --no-fail.
//
// Env: ANTHROPIC_API_KEY, VJ_MODEL (default claude-opus-5-5: the strongest
// Claude for reading screenshots as of 2026-09), VJ_CONCURRENCY (default 3).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CHECK_SEVERITY } from './config.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const IN = path.resolve(flag('in', 'visual-judge-out'));
const NO_FAIL = args.includes('--no-fail');
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.VJ_MODEL || 'claude-opus-5-5';
const CONCURRENCY = Number(process.env.VJ_CONCURRENCY || 3);
const MAX_EDGE = 1568; // larger images are downscaled by the API anyway
const HERE = path.dirname(new URL(import.meta.url).pathname);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- layer 1: measured checks ----------

export function measuredFindings(p) {
  const f = p.facts || {};
  const out = [];
  const add = (check, issue, fix) => out.push({ source: 'measured', check, severity: CHECK_SEVERITY[check], frame: null, where: 'page', issue, fix });
  if (p.status && p.status !== 200) out.push({ source: 'measured', check: 'status', severity: 'blocker', frame: null, where: 'page', issue: `HTTP ${p.status}`, fix: 'Check the route and the deploy.' });
  if (f.loadError) out.push({ source: 'measured', check: 'load', severity: 'blocker', frame: null, where: 'page', issue: `page did not load: ${f.loadError}`, fix: 'Check the route and the deploy.' });
  if (f.overflowX > 0) add('overflow', `page scrolls sideways by ${f.overflowX}px`, 'Find the element wider than the viewport (npm run audit:pages at this width).');
  if (f.titleUnderHeader) add('titleUnderHeader', f.titleUnderHeader, 'Hero top padding must clear --header-h at this viewport.');
  if (f.brokenImages?.length) add('brokenImages', `images failed to load: ${f.brokenImages.join(', ')}`, 'Check the asset paths and the /images cache rule (new file, new name).');
  if (f.hiddenReveals?.length) add('hiddenReveals', `content still invisible after entering the viewport: ${f.hiddenReveals.join(', ')}`, 'A .reveal/.stagger-children element never got .visible. Check the reveal orchestrator and the failsafe.');
  for (const [name, els] of Object.entries(f.retiredColors || {})) {
    add('retiredColors', `${name} rendered on: ${els.join(', ')}`, 'Replace with a cream-family brightness step. The hazards lock scans global.css only, so this slipped past CI.');
  }
  if (f.emDash?.length) add('emDash', `em dash in visible copy: "${f.emDash.join('" | "')}"`, 'VOICE.md: periods, commas, colons.');
  if (f.csp?.length) add('csp', `CSP violations: ${f.csp.join('; ')}`, 'Audit CSP against the BUILT output (inline modules, inline styles).');
  if (f.pageErrors?.length) add('pageErrors', `uncaught errors: ${f.pageErrors.join(' | ')}`, 'Reproduce in the browser console.');
  if (f.consoleErrors?.length) add('consoleErrors', `console errors: ${f.consoleErrors.join(' | ')}`, 'Review; some may be third-party noise.');
  return out;
}

// ---------- layer 2: model judgment ----------

async function imageBlock(file) {
  const img = sharp(path.join(IN, file));
  const meta = await img.metadata();
  const big = Math.max(meta.width || 0, meta.height || 0) > MAX_EDGE;
  const buf = big ? await img.resize({ width: meta.width >= meta.height ? MAX_EDGE : undefined, height: meta.height > meta.width ? MAX_EDGE : undefined }).png().toBuffer() : fs.readFileSync(path.join(IN, file));
  return { type: 'image', source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') } };
}

export function parseVerdict(text) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in model reply');
  const v = JSON.parse(text.slice(a, b + 1));
  if (!Array.isArray(v.findings)) throw new Error('model reply has no findings array');
  const sev = new Set(['blocker', 'major', 'minor']);
  v.findings = v.findings
    .filter((x) => x && typeof x.issue === 'string')
    .map((x) => ({ ...x, severity: sev.has(x.severity) ? x.severity : 'minor', source: 'model' }));
  return v;
}

async function callModel(system, content) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }] }),
    });
    if (res.ok) {
      const body = await res.json();
      const text = (body.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      return { text, usage: body.usage || {} };
    }
    const detail = (await res.text()).slice(0, 300);
    if (![429, 500, 502, 503, 529].includes(res.status) || attempt === 4) throw new Error(`API ${res.status}: ${detail}`);
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error('unreachable');
}

async function judgePage(p, rubric, base) {
  const facts = JSON.stringify({ ...p.facts, pageHeight: undefined }, null, 1);
  const content = [{
    type: 'text',
    text: `Site: ${base}\nPage: ${p.route}\nViewport: ${p.viewport} (${p.size} CSS px)\nFrames: ${p.frames.length}, top to bottom.\nCapture facts (measured):\n${facts}`,
  }];
  for (let i = 0; i < p.frames.length; i++) {
    content.push({ type: 'text', text: `Frame ${i + 1} (scrollY ${p.frames[i].scrollY})` });
    content.push(await imageBlock(p.frames[i].file));
  }
  content.push({ type: 'text', text: 'Judge this page at this viewport against the rubric. Return only the JSON object.' });
  const { text, usage } = await callModel(rubric, content);
  return { ...parseVerdict(text), usage };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------- report ----------

const RANK = { blocker: 0, major: 1, minor: 2 };

function writeReports(manifest, results, modelNote) {
  const all = results.flatMap((r) => r.findings.map((f) => ({ route: r.route, viewport: r.viewport, ...f })));
  all.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const count = (s) => all.filter((f) => f.severity === s).length;
  const totals = { blocker: count('blocker'), major: count('major'), minor: count('minor') };
  fs.writeFileSync(path.join(IN, 'findings.json'), JSON.stringify({ base: manifest.base, capturedAt: manifest.capturedAt, model: modelNote, totals, results }, null, 2));

  const md = [
    `## Visual judge: ${manifest.base}`,
    '',
    `Captured ${manifest.capturedAt}. ${results.length} page views. Model: ${modelNote}.`,
    '',
    `**${totals.blocker} blocker, ${totals.major} major, ${totals.minor} minor.**`,
    '',
  ];
  if (all.length) {
    md.push('| Severity | Page | Viewport | Where | Issue | Source |', '|---|---|---|---|---|---|');
    for (const f of all.filter((x) => x.severity !== 'minor')) {
      md.push(`| ${f.severity} | ${f.route} | ${f.viewport} | ${(f.where || '').replace(/\|/g, '/')} | ${f.issue.replace(/\|/g, '/')} | ${f.source} |`);
    }
    if (totals.minor) md.push('', `${totals.minor} minor findings are in report.html.`);
  } else {
    md.push('Clean.');
  }
  fs.writeFileSync(path.join(IN, 'summary.md'), md.join('\n') + '\n');

  const sections = results.map((r) => {
    const frames = r.frames.map((f, i) => `<figure><img loading="lazy" src="${esc(f.file)}" alt="frame ${i + 1}"><figcaption>frame ${i + 1} · y ${f.scrollY}</figcaption></figure>`).join('');
    const rows = r.findings.length
      ? r.findings.map((f) => `<li class="${f.severity}"><b>${f.severity}</b> <span class="src">${f.source}</span> ${esc(f.where || '')}<br>${esc(f.issue)}${f.fix ? `<br><i>${esc(f.fix)}</i>` : ''}</li>`).join('')
      : '<li class="clean">clean</li>';
    return `<section><h2>${esc(r.route)} <small>${esc(r.viewport)} · ${esc(r.size)}</small></h2>${r.summary ? `<p>${esc(r.summary)}</p>` : ''}${r.error ? `<p class="err">model error: ${esc(r.error)}</p>` : ''}<ul>${rows}</ul><div class="frames">${frames}</div></section>`;
  }).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Visual judge ${esc(manifest.capturedAt)}</title>
<style>body{background:#0a0a0a;color:#f4eade;font:14px/1.5 system-ui,sans-serif;margin:2rem}h1{font-weight:500}h2{font-size:1.1rem;border-top:1px solid #333;padding-top:1.5rem}small{color:#868686}
ul{list-style:none;padding:0}li{padding:.5rem .75rem;margin:.25rem 0;border-left:3px solid #555;background:#141414}li.blocker{border-color:#e5484d}li.major{border-color:#f5a524}li.clean{border-color:#46a758}.src{color:#868686;font-size:12px}.err{color:#e5484d}
.frames{display:flex;gap:.75rem;overflow-x:auto;padding-bottom:1rem}figure{margin:0;flex:0 0 auto}figure img{max-height:520px;border:1px solid #333}figcaption{color:#868686;font-size:12px}</style>
<h1>Visual judge</h1><p>${esc(manifest.base)} · ${esc(manifest.capturedAt)} · model: ${esc(modelNote)}</p>
<p><b>${totals.blocker} blocker · ${totals.major} major · ${totals.minor} minor</b></p>${sections}`;
  fs.writeFileSync(path.join(IN, 'report.html'), html);
  return totals;
}

// ---------- main ----------

const run = async () => {
  const manifestPath = path.join(IN, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`no capture at ${manifestPath}; run scripts/visual-judge/capture.mjs first`);
    process.exit(2);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const rubric = fs.readFileSync(path.join(HERE, 'rubric.md'), 'utf8');
  const modelNote = KEY ? MODEL : 'skipped (no ANTHROPIC_API_KEY): measured checks only';
  console.log(`visual-judge  ${manifest.pages.length} page views  model: ${modelNote}`);

  let tokensIn = 0;
  let tokensOut = 0;
  const results = await pool(manifest.pages, CONCURRENCY, async (p) => {
    const r = { route: p.route, viewport: p.viewport, size: p.size, frames: p.frames, findings: measuredFindings(p) };
    if (KEY) {
      try {
        const v = await judgePage(p, rubric, manifest.base);
        r.summary = v.summary;
        r.findings.push(...v.findings);
        tokensIn += v.usage.input_tokens || 0;
        tokensOut += v.usage.output_tokens || 0;
      } catch (e) {
        r.error = String(e.message || e);
      }
    }
    const worst = r.findings.reduce((w, f) => Math.min(w, RANK[f.severity]), 3);
    console.log(`  ${['✗', '!', '·', '✓'][worst]} ${p.route} @ ${p.viewport}  ${r.findings.length} findings${r.error ? '  (model error)' : ''}`);
    return r;
  });

  const totals = writeReports(manifest, results, modelNote);
  if (KEY) console.log(`tokens: ${tokensIn} in, ${tokensOut} out`);
  const errors = results.filter((r) => r.error).length;
  console.log(`\n${totals.blocker} blocker, ${totals.major} major, ${totals.minor} minor${errors ? `, ${errors} model errors` : ''}`);
  console.log(`report -> ${path.relative(process.cwd(), path.join(IN, 'report.html'))}`);
  // A model that silently failed must not read as a clean page.
  if (!NO_FAIL && (totals.blocker > 0 || errors > 0)) process.exit(1);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
