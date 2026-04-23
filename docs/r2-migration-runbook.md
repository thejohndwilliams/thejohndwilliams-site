# R2 + Cloudflare Image Resizing — Migration Runbook

Goal: move the photography pipeline from pre-rendered AVIF/WebP tiers
in `public/images/photography/{thumb,gallery,hero}/` to a single
original in Cloudflare R2, with every variant (width, format, quality)
negotiated at the edge per request via Cloudflare Image Resizing.

This document is the click path. The code is staged but inert until
the R2 bucket exists and Image Resizing is enabled on the zone.

## Why this pipeline

| Lever | Local tiers (current) | R2 + Image Resizing (target) |
| --- | --- | --- |
| Origin storage | git + Pages build output | R2 (origin-adjacent, S3-compatible) |
| Egress cost | Pages bandwidth (free tier) | $0 from R2 to Cloudflare edge |
| Variant count | 3 per photo (thumb/gallery/hero) × 2 formats | arbitrary; negotiated per-request |
| Format evolution | manual re-encode of 58 photos × 6 files each | JPEG-XL / AVIF / future codec auto-emit |
| Ingestion friction | Lightroom export → local resize script → git add (58 blobs) | Lightroom export → `ingest-to-r2.mjs` → manifest entry |
| Git repo size | ~180 MB and growing | stays flat (no binaries in-tree) |

The first 58 photographs keep the local pipeline — zero regression,
zero migration risk. New uploads take the R2 path. `<Photo>` resolves
the pipeline per-image via the `source` field on each `PhotoImage`.

## Prerequisites

1. Cloudflare account with the site's zone (`thejohndwilliams.com`) on
   it and the $5/mo Image Resizing subscription active.
2. Wrangler CLI auth'd to the same account (optional — everything is
   doable through the dashboard, but wrangler is faster for bucket
   creation).
3. Local clone of the repo with `node >= 20` and `npm install` run
   recently (the `@aws-sdk/client-s3` devDependency is required).

## One-time setup (~20 min)

### 1. Create the R2 bucket

Dashboard path: **Cloudflare dashboard → R2 → Create bucket**.

- Name: `thejohndwilliams-photos` (matches `.env.example`)
- Location: Automatic (let Cloudflare pick the nearest data center)
- Default storage class: Standard

No public access on the bucket itself. Serving is done via the
Image Resizing worker path, which proxies through the zone.

### 2. Generate an R2 API token

Dashboard path: **R2 → Manage R2 API Tokens → Create API Token**.

- Permissions: **Object Read & Write**
- Specify bucket(s): `thejohndwilliams-photos` (scope-limit)
- TTL: leave blank (no expiration) — or set to a year if security
  posture prefers rotation

You get an access key ID and a secret. The secret is shown **once** —
copy it immediately into your local `.env`:

```
R2_ACCESS_KEY_ID=<access key id>
R2_SECRET_ACCESS_KEY=<secret>
R2_ACCOUNT_ID=<Cloudflare account id, from R2 sidebar>
R2_BUCKET=thejohndwilliams-photos
```

**Never commit `.env`.** It's already in `.gitignore`.

### 3. Enable Image Resizing on the zone

Dashboard path: **Cloudflare dashboard → [thejohndwilliams.com] →
Speed → Optimization → Image Resizing**.

- Toggle: **On**
- Billing: confirms the $5/mo charge on the zone

Without this toggle, `/cdn-cgi/image/...` URLs return the origin file
unresized. The toggle is billing-gated; no free tier.

### 4. Wire a custom hostname for R2 (recommended)

Serving images from the same apex zone as the site avoids CORS and
cross-origin Cache-Control headaches, and gives you a pretty hostname
to put in `<img src>`.

Dashboard path: **R2 → [bucket] → Settings → Custom Domains → Connect
Domain**.

- Domain: `images.thejohndwilliams.com`
- Cloudflare auto-creates the CNAME (requires the zone to be on the
  same account)

Propagation is instant on-zone. Verify with:

```
curl -I https://images.thejohndwilliams.com/<any-known-key>
```

Expected: `200 OK` with R2 headers when the key exists, `404` when it
doesn't. Then set in `.env`:

```
R2_PUBLIC_BASE=https://images.thejohndwilliams.com
PUBLIC_R2_IMAGE_BASE=https://images.thejohndwilliams.com
```

`PUBLIC_R2_IMAGE_BASE` must also be set as a build-time env var in
the **Cloudflare Pages dashboard** (Settings → Environment variables →
Production) so `<Photo>` renders the right srcset URLs at build time.

## Pilot run (first upload)

### 5. Dry-run the ingestion script

From the repo root with `.env` populated:

```
node scripts/ingest-to-r2.mjs --dry-run
```

Expected output:

```
[ingest] Source:  /Users/you/Library/Mobile Documents/com~apple~CloudDocs/05_Creative/Gallery_Images
[ingest] Bucket:  <dry-run>
[ingest] Mode:    DRY RUN
[ingest] Found N candidate file(s).
[ingest] WOULD PUT  photography/<sha>_<basename>.jpg  (X.X MB)
...
```

No network calls in dry-run mode. The `@aws-sdk/client-s3` dependency
is lazy-imported, so dry-run works even on a fresh clone.

### 6. Live ingestion

```
node scripts/ingest-to-r2.mjs
```

Uploads are idempotent: re-running skips any key already in the
manifest or the bucket. On success, `src/data/photo-r2-manifest.json`
gains new entries keyed by `photography/<sha>_<basename>.<ext>`.

### 7. Add the photo to `src/data/photography.ts`

For each newly-uploaded file, add a `PhotoImage` entry to the
appropriate category:

```ts
{
  file: 'some-descriptor',
  alt: 'Thoughtful description',
  orientation: 'landscape',
  source: 'r2',
  key: 'photography/3f9a7b2c_my-file.jpg',  // from manifest
}
```

The slug (`file`) can be any unique descriptor — it does NOT need to
match the R2 key basename. It's what shows up in the URL at
`/photography/<file>`.

### 8. Local build verification

```
npm run build
```

Expected:

- `astro build` emits `dist/photography/<file>/index.html` referencing
  `https://images.thejohndwilliams.com/cdn-cgi/image/width=1200,format=auto/<key>` in the `<img srcset>`
- `node scripts/build-og-images.mjs` generates the 1200×630 OG card
  for the new slug into `dist/og/photography/<file>.jpg`

Run tests:

```
npm run test
```

The R2-aware test in `tests/build.test.ts` should continue to pass
(the Photo.astro fallback logic keeps local-source photos rendering
identically).

### 9. Deploy

```
git add src/data/photography.ts src/data/photo-r2-manifest.json
git commit -m "feat(photography): add N photographs via R2 pipeline"
git push origin main
```

Cloudflare Pages builds + deploys in ~90 seconds. No blob was
committed — the manifest is JSON metadata only.

## Migration of existing 58 photos (deferred)

Not on the critical path. To migrate:

1. Copy each `dscf1234.jpg` (or equivalent original) into the
   Gallery_Images directory.
2. Run ingestion (it's idempotent, it only uploads new files).
3. In `photography.ts`, flip `source` from implicit `'local'` to
   `'r2'` and add the `key` field per entry.
4. Once all 58 are flipped and live, delete
   `public/images/photography/{thumb,gallery,hero}/` and the
   `build:placeholders` script (LQIP regeneration becomes an R2-side
   concern if we still want it — open question).

Defer this until:

- The R2 pipeline has been in production for at least a month.
- Lighthouse LCP on `/photography/<slug>` is within 5% of the local
  pipeline's measured LCP.
- There's a batch of new uploads ready, so the local → R2 migration
  can happen alongside a visible site refresh.

## Rollback

The local pipeline remains intact. If R2 serves corrupt or
unreachable images:

1. Comment out `source: 'r2'` on the affected entries in
   `photography.ts`.
2. Re-push — the build falls back to 404s for those photos (they
   don't have local tiers unless someone pre-rendered them).

For emergency full-site rollback, `git revert` the commit that flipped
the first entry to `source: 'r2'`. Pages redeploys in 90 seconds.

## Known unknowns

- **LQIP (blur-up placeholder) regeneration** for R2-sourced photos
  is not yet wired. Current `build:placeholders` script reads from
  `public/images/photography/hero/`; R2 photos have nothing there.
  Options: (a) extend script to fetch the R2 original, hash + cache,
  regenerate locally; (b) accept no LQIP on R2-sourced photos until
  this is resolved; (c) move LQIP generation server-side as a
  one-time post-upload step in `ingest-to-r2.mjs`. Current behavior
  with (a) unresolved: `getPlaceholder()` returns `undefined`, and
  `<Photo>` falls through to a hard load (no blur-up). Measure LCP
  impact on pilot uploads before picking.
- **Image Resizing cache hit rate** should be watched in the Cloudflare
  dashboard post-pilot. Cold-miss cost is a few hundred ms of sharp
  execution at the edge; steady-state should hit the CDN every time.
- **`PUBLIC_R2_IMAGE_BASE` env in Pages** needs to be set in the
  dashboard (can't be inferred from repo). If it's unset in
  production, `<Photo>` emits path-form `/cdn-cgi/image/...` URLs that
  work only because Pages and the R2 custom hostname are on the same
  zone. Safer to set it explicitly.

## References

- [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [Cloudflare Image Resizing URL format](https://developers.cloudflare.com/images/transform-images/transform-via-url/)
- [R2 pricing](https://www.cloudflare.com/r2/) ($0.015/GB-month storage, $0 egress to CF)
- Code: `scripts/ingest-to-r2.mjs`, `src/components/Photo.astro`, `src/data/photography.ts`
