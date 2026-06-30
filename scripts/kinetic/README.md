# KineticPlate toolkit

Turns a photograph into the geometry the `/about` dot-plot flagship renders:
a **luminance** grid (tonality) and a **true monocular depth** grid (3D relief).
The committed JSON is the only thing the browser needs — no model, no PyTorch,
no new CSP surface ever ships.

## One-time setup

```sh
npm run kinetic:setup
```

Creates an isolated Python venv (`scripts/kinetic/.venv`), installs
`onnxruntime numpy pillow` (no PyTorch, nothing touching system Python), and
downloads + checksum-verifies the depth model into `scripts/kinetic/.cache/`.
Idempotent — safe to re-run. Both `.venv/` and `.cache/` are gitignored.

> Why a download: the 99 MB ONNX weights are too big to commit. The committed
> artifact is `src/data/kinetic-depth.json` (the derived depth grids).

## Swap or add a plate

1. **Choose the photo.** Strongest with a clear subject separable from its
   background and a full tonal range. Either:
   - drop a `jpg`/`png`/`webp` master in `plates-source/` (a scratch dropzone,
     gitignored), or
   - point at a photo already in `public/images/photography/{hero,gallery}/`.
2. **Edit the manifest** `src/data/kinetic-plates.json` — set the plate's
   `file` (basename, no extension) and `alt`. Add or remove plates freely;
   the `id` is what `<KineticPlate3D category="…">` references.
3. **Rebuild:**

   ```sh
   npm run kinetic:build
   ```

   Luminance → depth → per-frame emit → alignment validation, in one shot.
   QA previews (source + depth, per plate) land in `.kinetic-depth-preview/`.
4. **Review** the previews, then `npm run gate:quick`, then commit
   `src/data/kinetic-signature.json` + `src/data/kinetic-depth.json`.

## How it stays correct

- **One source of truth.** The manifest drives both builders.
- **One resolver.** Node resolves each photo and writes the resolved path into
  `kinetic-signature.json`; the Python depth step reads *that*, so luminance and
  depth can never run on different images or crops.
- **Aligned by construction.** Identical center-square → grid crop on both
  sides; `kinetic:build` validates `grid.length === cols*rows` and
  `depth.length === grid.length` and fails loud otherwise. `tests/kinetic.test.ts`
  locks the same invariant in CI.

## Files

| Path | Role |
|------|------|
| `src/data/kinetic-plates.json` | manifest (input — edit this) |
| `scripts/build-kinetic-signature.mjs` | luminance grid (Node/sharp) |
| `scripts/build-kinetic-depth.py` | depth grid (venv/onnxruntime) |
| `scripts/emit-kinetic-frames.mjs` | merge → `public/data/kinetic/<id>.json` (build step) |
| `scripts/kinetic/setup.mjs` | `npm run kinetic:setup` |
| `scripts/kinetic/build.mjs` | `npm run kinetic:build` |
| `src/data/kinetic-signature.json`, `src/data/kinetic-depth.json` | committed derived geometry |
