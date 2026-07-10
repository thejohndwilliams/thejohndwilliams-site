#!/usr/bin/env node
/**
 * site-pulse.mjs — the feedback loop (2026-07-08).
 *
 * Pulls Cloudflare Web Analytics (RUM) for thejohndwilliams.com and emits a
 * monthly-pulse markdown report: visits, pageviews, deltas vs the prior
 * window, top pages, referrer hosts, countries, and Core Web Vitals p75 as
 * real visitors experienced them. If the Obsidian Local REST API is up, the
 * report is also written into the vault (04_Research/Site_Pulse/).
 *
 * Credentials (environment; never committed, never logged):
 *   CF_API_TOKEN    — Cloudflare API token, scope: Account > Account
 *                     Analytics > Read. Created at dash.cloudflare.com >
 *                     My Profile > API Tokens > Create Token.
 *   CF_ACCOUNT_TAG  — the 32-hex account id from the dashboard URL
 *                     (dash.cloudflare.com/<ACCOUNT_TAG>/...).
 *   CF_SITE_TAG     — optional; defaults to the site's public beacon token.
 *   OBSIDIAN_REST_API_KEY — optional; enables vault capture.
 *
 * Missing credentials is a supported state: the script prints setup
 * instructions and exits 0 so the scheduled runner surfaces them in chat.
 */

const SITE_TAG = process.env.CF_SITE_TAG || '790c0f9cba2844f5b8fc9435854c9794';
const TOKEN = process.env.CF_API_TOKEN || '';
const ACCOUNT = process.env.CF_ACCOUNT_TAG || '';
const GQL = 'https://api.cloudflare.com/client/v4/graphql';

const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || 30);

function iso(d) { return d.toISOString(); }
function day(d) { return d.toISOString().slice(0, 10); }

if (!TOKEN || !ACCOUNT) {
  console.log(`# Site Pulse — not yet wired

The pulse needs two values that only John can provision (5 minutes, once):

1. dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom.
   Permission: Account / Account Analytics / Read. Scope it to the account.
2. The account tag: the 32-character id in the dashboard URL
   (dash.cloudflare.com/<THIS PART>).

Then add to ~/.zshrc (same pattern as OBSIDIAN_REST_API_KEY):

    export CF_API_TOKEN="<token>"
    export CF_ACCOUNT_TAG="<account tag>"

Re-run: node scripts/site-pulse.mjs
`);
  process.exit(0);
}

async function gql(query, variables) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

async function window_(geq, leq) {
  const filter = { AND: [{ datetime_geq: geq }, { datetime_leq: leq }, { siteTag: SITE_TAG }] };
  const q = `
    query ($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
      viewer { accounts(filter: { accountTag: $account }) {
        total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) {
          count sum { visits }
        }
        paths: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 10, orderBy: [count_DESC]) {
          count dimensions { requestPath }
        }
        refs: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 10, orderBy: [count_DESC]) {
          count dimensions { refererHost }
        }
        geo: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 8, orderBy: [count_DESC]) {
          count dimensions { countryName }
        }
      } }
    }`;
  const d = await gql(q, { account: ACCOUNT, filter });
  return d.viewer.accounts[0];
}

async function vitals(geq, leq) {
  const filter = { AND: [{ datetime_geq: geq }, { datetime_leq: leq }, { siteTag: SITE_TAG }] };
  const q = `
    query ($account: String!, $filter: AccountRumWebVitalsEventsAdaptiveGroupsFilter_InputObject) {
      viewer { accounts(filter: { accountTag: $account }) {
        v: rumWebVitalsEventsAdaptiveGroups(filter: $filter, limit: 1) {
          quantiles {
            largestContentfulPaintP75
            interactionToNextPaintP75
            cumulativeLayoutShiftP75
          }
        }
      } }
    }`;
  try {
    const d = await gql(q, { account: ACCOUNT, filter });
    return d.viewer.accounts[0]?.v?.[0]?.quantiles || null;
  } catch (err) {
    return { _error: String(err.message).slice(0, 160) };
  }
}

function fmtDelta(now, prev) {
  if (!prev) return 'n/a';
  const pct = ((now - prev) / prev) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs prior ${DAYS}d`;
}

const now = new Date();
const start = new Date(now.getTime() - DAYS * 864e5);
const prevStart = new Date(now.getTime() - 2 * DAYS * 864e5);

const [cur, prev, cwv] = await Promise.all([
  window_(iso(start), iso(now)),
  window_(iso(prevStart), iso(start)),
  vitals(iso(start), iso(now)),
]);

const visits = cur.total?.[0]?.sum?.visits ?? 0;
const views = cur.total?.[0]?.count ?? 0;
const pVisits = prev.total?.[0]?.sum?.visits ?? 0;
const pViews = prev.total?.[0]?.count ?? 0;

const rows = (list, key) =>
  (list || [])
    .filter((r) => r.dimensions?.[key])
    .map((r) => `| ${r.dimensions[key] || '(direct)'} | ${r.count} |`)
    .join('\n');

let cwvLine = 'no field data yet (needs traffic volume)';
if (cwv && !cwv._error) {
  const lcp = cwv.largestContentfulPaintP75;
  const inp = cwv.interactionToNextPaintP75;
  const cls = cwv.cumulativeLayoutShiftP75;
  cwvLine = `LCP p75 ${lcp != null ? (lcp / 1000).toFixed(2) + 's' : 'n/a'} · INP p75 ${inp != null ? inp + 'ms' : 'n/a'} · CLS p75 ${cls != null ? cls : 'n/a'}`;
} else if (cwv?._error) {
  cwvLine = `web-vitals query error: ${cwv._error}`;
}

const md = `---
type: research
domain: projects
tags: [site-pulse, analytics, thejohndwilliams-site]
status: active
created: ${day(now)}
updated: ${day(now)}
---

# Site Pulse ${day(now)} (last ${DAYS} days)

**Visits:** ${visits} (${fmtDelta(visits, pVisits)}) · **Pageviews:** ${views} (${fmtDelta(views, pViews)})
**Core Web Vitals (real visitors):** ${cwvLine}

## Top pages

| Path | Views |
|---|---|
${rows(cur.paths, 'requestPath')}

## Referrers

| Host | Views |
|---|---|
${rows(cur.refs, 'refererHost') || '| (direct / none recorded) | |'}

## Countries

| Country | Views |
|---|---|
${rows(cur.geo, 'countryName')}

## Links

[[Projects_MOC]] · [[GitHub_Portfolio]] · [[Site_Direction_Eval_2026-07-08]]
`;

console.log(md);

// Vault capture (best effort; the pulse never fails because Obsidian is closed).
const OBS = process.env.OBSIDIAN_REST_API_KEY;
if (OBS) {
  try {
    const res = await fetch(
      `http://localhost:27123/vault/04_Research/Site_Pulse/Pulse_${day(now)}.md`,
      { method: 'PUT', headers: { Authorization: `Bearer ${OBS}`, 'Content-Type': 'text/markdown' }, body: md }
    );
    console.error(`[pulse] vault capture: HTTP ${res.status}`);
  } catch {
    console.error('[pulse] vault capture skipped (Obsidian REST API not reachable)');
  }
}
