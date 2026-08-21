#!/usr/bin/env node
/**
 * traffic-report.mjs
 *
 * Zone traffic report for thejohndwilliams.com straight from the Cloudflare
 * GraphQL Analytics API — the same data behind the dashboard's Traffic view,
 * without the dashboard. Sibling of preview-status.mjs: plain node, no deps.
 *
 * Usage:
 *   npm run traffic:report                     # last 30 days
 *   npm run traffic:report -- --days 7         # last N days (1..364)
 *   npm run traffic:report -- --no-paths       # skip sampled top-paths query
 *   npm run traffic:report -- --json           # raw JSON to stdout
 *   npm run traffic:report -- --md             # also write Traffic_Report_YYYY-MM-DD.md (untracked)
 *   npm run traffic:report -- --capabilities   # dump per-dataset limits for this zone/plan
 *
 * CREDENTIALS (read-only Analytics token; never committed, never in chat):
 *   1. env CLOUDFLARE_ANALYTICS_TOKEN (or gitignored .env)
 *   2. macOS keychain item `cloudflare-analytics`:
 *      security add-generic-password -s cloudflare-analytics -a thejohndwilliams.com -w '<token>' -U
 *   Token permissions: Zone.Zone:Read + Zone.Analytics:Read, scoped to the zone.
 *   Optional .env: CF_ZONE_ID skips the one REST zone-lookup call.
 *
 * Dataset notes: httpRequests1dGroups is the classic per-day rollup (requests,
 * page views, uniques, bytes, cache, threats, country/status/browser maps).
 * httpRequestsAdaptiveGroups (sampled) adds top paths — free plan caps it at a
 * 24h window and withholds referer-host fields; unsupported queries degrade
 * gracefully and say so.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZONE_NAME = 'thejohndwilliams.com';
const API = 'https://api.cloudflare.com/client/v4';

// ── args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
const has = (name) => args.includes(`--${name}`);
const DAYS = Math.min(364, Math.max(1, Number(flag('days', '30')) || 30));
const WANT_PATHS = !has('no-paths');
const AS_JSON = has('json');
const AS_MD = has('md');
const CAPABILITIES = has('capabilities');

// ── credentials ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

function getToken() {
  loadEnv();
  if (process.env.CLOUDFLARE_ANALYTICS_TOKEN) return process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  try {
    const t = execSync('security find-generic-password -s cloudflare-analytics -w', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (t) return t;
  } catch { /* fall through to the error below */ }
  console.error('traffic:report  no credential found.');
  console.error('  Provide CLOUDFLARE_ANALYTICS_TOKEN in env/.env, or store it in the keychain:');
  console.error(`  security add-generic-password -s cloudflare-analytics -a ${ZONE_NAME} -w '<token>' -U`);
  process.exit(2);
}

// ── api helpers ──────────────────────────────────────────────────────
async function rest(pathname, tok) {
  const r = await fetch(`${API}${pathname}`, { headers: { authorization: `Bearer ${tok}` } });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body?.success) {
    throw new Error(`REST ${pathname} -> HTTP ${r.status} ${JSON.stringify(body?.errors ?? body)}`);
  }
  return body.result;
}

async function gql(query, tok) {
  const r = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => null);
  if (!body) throw new Error(`GraphQL -> HTTP ${r.status} (unparseable body)`);
  return body; // caller inspects .data / .errors — partial data is normal
}

// ── formatting ───────────────────────────────────────────────────────
const n = (x) => (x ?? 0).toLocaleString('en-US');
function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log2(b) / 10));
  return `${(b / 2 ** (10 * i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
const pct = (part, whole) => (whole ? `${((100 * part) / whole).toFixed(1)}%` : '—');
function spark(values) {
  const glyphs = '▁▂▃▄▅▆▇█';
  const max = Math.max(...values, 1);
  return values.map((v) => glyphs[Math.min(7, Math.round((v / max) * 7))]).join('');
}
const iso = (d) => d.toISOString().slice(0, 10);

// ── queries (literals inlined; all values are internally generated) ──
const qZone = (tag, from, to) => `{ viewer { zones(filter: { zoneTag: "${tag}" }) {
  days: httpRequests1dGroups(limit: 366, filter: { date_geq: "${from}", date_leq: "${to}" }, orderBy: [date_ASC]) {
    dimensions { date }
    sum { requests cachedRequests bytes cachedBytes threats pageViews }
    uniq { uniques }
  }
  totals: httpRequests1dGroups(limit: 1, filter: { date_geq: "${from}", date_leq: "${to}" }) {
    sum { requests cachedRequests bytes cachedBytes threats pageViews
      countryMap { clientCountryName requests }
      responseStatusMap { edgeResponseStatus requests }
      browserMap { uaBrowserFamily pageViews } }
    uniq { uniques }
  }
} } }`;

const qPaths = (tag, fromIso, toIso) => `{ viewer { zones(filter: { zoneTag: "${tag}" }) {
  paths: httpRequestsAdaptiveGroups(limit: 12, filter: { datetime_geq: "${fromIso}", datetime_lt: "${toIso}" }, orderBy: [count_DESC]) {
    count sum { visits } dimensions { clientRequestPath }
  }
} } }`;

const qCaps = (tag) => `{ viewer { zones(filter: { zoneTag: "${tag}" }) { settings {
  httpRequests1dGroups { enabled maxDuration maxNumberOfFields maxPageSize notOlderThan }
  httpRequestsAdaptiveGroups { enabled maxDuration maxNumberOfFields maxPageSize notOlderThan }
} } } }`;

// ── report ───────────────────────────────────────────────────────────
function topOf(map, key, metric, total, count) {
  return (map ?? [])
    .slice()
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, count)
    .map((row) => `${row[key]} ${pct(row[metric], total)}`)
    .join(' · ');
}

function render(out, { from, to, plan, days, totals, pathsBlock, pathsNote, pathsWindow }) {
  const t = totals?.sum ?? {};
  const uniques = totals?.uniq?.uniques ?? 0;
  out.push(`traffic:report  ${ZONE_NAME}  ${from} → ${to}${plan ? `  [${plan}]` : ''}`);
  if (!days.length) {
    out.push('  no data returned for this window.');
    return;
  }
  const reqSeries = days.map((d) => d.sum?.requests ?? 0);
  out.push(`  requests        ${n(t.requests)}   (${n(Math.round((t.requests ?? 0) / days.length))}/day)`);
  out.push(`  page views      ${n(t.pageViews)}`);
  out.push(`  unique visitors ${n(uniques)}   (range-wide uniques, not a daily sum)`);
  out.push(`  data served     ${fmtBytes(t.bytes)}   cache-hit ${pct(t.cachedRequests, t.requests)} of requests, ${pct(t.cachedBytes, t.bytes)} of bytes`);
  out.push(`  threats blocked ${n(t.threats)}`);
  out.push(`  daily requests  ${spark(reqSeries)}   min ${n(Math.min(...reqSeries))} · max ${n(Math.max(...reqSeries))}`);
  const countries = topOf(t.countryMap, 'clientCountryName', 'requests', t.requests, 6);
  if (countries) out.push(`  countries       ${countries}`);
  const statuses = topOf(t.responseStatusMap, 'edgeResponseStatus', 'requests', t.requests, 6);
  if (statuses) out.push(`  edge status     ${statuses}`);
  const browsers = topOf(t.browserMap, 'uaBrowserFamily', 'pageViews', t.pageViews, 5);
  if (browsers) out.push(`  browsers        ${browsers} (of page views)`);
  if (pathsBlock) {
    out.push('  top paths       (sampled, last 24h — free-plan adaptive cap)');
    for (const p of pathsBlock.paths ?? []) {
      out.push(`    ${String(p.sum?.visits ?? p.count).padStart(8)}  ${p.dimensions?.clientRequestPath ?? '?'}`);
    }
  } else if (pathsNote) {
    out.push(`  top paths       unavailable — ${pathsNote}`);
  }
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  const tok = getToken();
  let zoneTag = process.env.CF_ZONE_ID;
  let plan = '';
  if (!zoneTag) {
    const zones = await rest(`/zones?name=${ZONE_NAME}`, tok);
    if (!zones?.length) throw new Error(`zone ${ZONE_NAME} is not visible to this token`);
    zoneTag = zones[0].id;
    plan = zones[0].plan?.name ?? '';
  }

  if (CAPABILITIES) {
    const caps = await gql(qCaps(zoneTag), tok);
    console.log(JSON.stringify(caps, null, 2));
    return;
  }

  const now = new Date();
  const to = iso(now);
  const from = iso(new Date(now.getTime() - (DAYS - 1) * 86400000));

  const zres = await gql(qZone(zoneTag, from, to), tok);
  for (const e of zres.errors ?? []) console.error(`  ! zone query: ${e.message}`);
  const zone = zres.data?.viewer?.zones?.[0];
  if (!zone) {
    console.error('traffic:report  zone query returned no data — see errors above.');
    process.exit(1);
  }

  let pathsBlock = null;
  let pathsNote = null;
  const pathsWindow = 1; // free-plan cap: httpRequestsAdaptiveGroups maxDuration = 24h (see --capabilities)
  if (WANT_PATHS) {
    const pFrom = new Date(now.getTime() - pathsWindow * 86400000).toISOString();
    const pres = await gql(qPaths(zoneTag, pFrom, now.toISOString()), tok);
    const pzone = pres.data?.viewer?.zones?.[0];
    if (pzone?.paths) pathsBlock = pzone;
    else pathsNote = (pres.errors ?? []).map((e) => e.message).join('; ') || 'no data';
  }

  const payload = { from, to, plan, days: zone.days ?? [], totals: zone.totals?.[0] ?? null, pathsBlock, pathsNote, pathsWindow };
  if (AS_JSON) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const out = [];
  render(out, payload);
  console.log(out.join('\n'));
  if (AS_MD) {
    const mdPath = path.join(ROOT, `Traffic_Report_${to}.md`);
    writeFileSync(mdPath, `# Traffic Report — ${ZONE_NAME}\n\n\`\`\`\n${out.join('\n')}\n\`\`\`\n`);
    console.log(`\n  wrote ${mdPath} (untracked)`);
  }
}

main().catch((e) => {
  console.error(`traffic:report  ${e.message}`);
  process.exit(1);
});
