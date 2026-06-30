// Preview-deploy notifier — credential-free.
//
//   npm run preview:status                 # watch the current branch's preview
//   npm run preview:status -- <branch>     # a specific branch
//   npm run preview:status -- --path /about-lab/ --expect "depth-mapped cloud"
//
// Computes a branch's Cloudflare Pages preview URL, polls until it's live
// (optionally until a content marker appears, to confirm the NEW build shipped
// and not a stale cache), and reports status + URL + elapsed. Removes the
// manual "wait ~90s and curl" dance after every push.
//
// No Cloudflare API token needed — it just polls the public alias URL.

import { execSync } from 'node:child_process';

const PROJECT = 'thejohndwilliams-site';
const args = process.argv.slice(2);

function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const positional = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);

const branch = positional || execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const path = flag('path', '/');
const expect = flag('expect', null);
const timeoutS = Number(flag('timeout', '210'));
const intervalS = Number(flag('interval', '6'));

// Cloudflare Pages branch-alias sanitization: lowercase, non-alphanumeric -> '-',
// collapse repeats, trim, cap at 28 chars.
function alias(b) {
  return b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28).replace(/-+$/g, '');
}
const url = `https://${alias(branch)}.${PROJECT}.pages.dev`;
const target = url + path;

async function probe() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await fetch(target, { signal: ac.signal, redirect: 'follow' });
    if (r.status !== 200) return { ok: false, status: r.status };
    if (!expect) return { ok: true, status: 200 };
    const body = await r.text();
    return { ok: body.includes(expect), status: 200, matched: body.includes(expect) };
  } catch (e) {
    return { ok: false, status: e.name === 'AbortError' ? 'timeout' : 'no-conn' };
  } finally { clearTimeout(t); }
}

console.log(`preview:status  branch=${branch}`);
console.log(`  url   ${target}`);
if (expect) console.log(`  expect "${expect}"`);

const start = Date.now();
const deadline = start + timeoutS * 1000;
let last = '';
while (Date.now() < deadline) {
  const r = await probe();
  const elapsed = Math.round((Date.now() - start) / 1000);
  if (r.ok) {
    console.log(`\n✓ live in ${elapsed}s — ${target}${expect ? '  (new content confirmed)' : ''}`);
    process.exit(0);
  }
  const note = r.status === 200 && expect ? '200 (awaiting new content)' : `${r.status}`;
  if (note !== last) { process.stdout.write(`\n  ${elapsed}s  ${note} `); last = note; }
  else process.stdout.write('.');
  await new Promise((res) => setTimeout(res, intervalS * 1000));
}
console.log(`\n✗ not live after ${timeoutS}s — ${target}\n  Check Cloudflare Pages > ${PROJECT} > deployments.`);
process.exit(1);
