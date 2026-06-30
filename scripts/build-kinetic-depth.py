# Build-time monocular DEPTH derivation for the KineticPlate 3D renderer.
#
# Companion to build-kinetic-signature.mjs (which derives the LUMINANCE grid).
# For each featured photo this runs a monocular depth model (Depth-Anything-V2
# Small, ONNX) and writes a 128x128 normalized depth grid, spatially aligned
# cell-for-cell with the luminance grid (identical center-square -> 128 crop).
#
# Output: src/data/kinetic-depth.json
#   { cols, rows, model, generatedAt, frames: [{ id, file, depth: number[] }] }
#
# The 3D renderer reads `depth` for each point's Z (true relief from the
# photograph's structure). When depth is absent it falls back to luminance.
# Depth-Anything outputs RELATIVE INVERSE depth (larger = nearer the camera),
# which is exactly the sign we want: bright depth-cell -> point sits forward.
#
# Run manually when the featured photos change (like build-kinetic-signature):
#   KINETIC_DEPTH_MODEL=/path/depth_anything_v2_vits.onnx \
#   /path/to/venv/bin/python scripts/build-kinetic-depth.py
# Model is build-time only; the committed JSON is the runtime source of truth
# (no model, torch, or new CSP surface ships to the browser).

import json
import os
from datetime import date

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTO_DIR = os.path.join(ROOT, "public/images/photography")
OUT_FILE = os.path.join(ROOT, "src/data/kinetic-depth.json")
PREVIEW_DIR = os.path.join(ROOT, ".kinetic-depth-preview")
MODEL = os.environ.get("KINETIC_DEPTH_MODEL", "/tmp/jdw-depth-vits.onnx")

COLS = ROWS = 128
INPUT = 518  # Depth-Anything-V2 ONNX fixed input
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Mirror build-kinetic-signature.mjs FRAMES exactly so depth aligns to luminance.
FRAMES = [
    {"id": "sky", "file": "7r52326", "alt": "Thunderheads against black sky"},
    {"id": "earth", "file": "7r51025-enhanced-sr", "alt": "Rain-wet leaf in darkness"},
    {"id": "water", "file": "7r50674-enhanced-sr", "alt": "El Arco de Cabo San Lucas"},
    {"id": "structure", "file": "img-7576-enhanced", "alt": "Shanghai Tower from below"},
]


def resolve_source(file):
    for tier in ("hero", "gallery"):
        cand = os.path.join(PHOTO_DIR, tier, f"{file}.webp")
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError(f"No webp source for {file}")


def center_square(im):
    w, h = im.size
    s = min(w, h)
    return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def depth_for(sess, in_name, src):
    im = center_square(Image.open(src).convert("RGB"))
    imr = im.resize((INPUT, INPUT), Image.LANCZOS)
    arr = (np.asarray(imr).astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    arr = np.transpose(arr, (2, 0, 1))[None, ...].astype(np.float32)
    out = np.squeeze(sess.run(None, {in_name: arr})[0]).astype(np.float32)

    # Downsample the 518 depth to the 128 grid (BICUBIC on float).
    small = np.asarray(
        Image.fromarray(out, mode="F").resize((COLS, ROWS), Image.BICUBIC),
        dtype=np.float32,
    )
    lo, hi = float(small.min()), float(small.max())
    norm = (small - lo) / max(1e-6, hi - lo)
    return norm, im


def main():
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    in_name = sess.get_inputs()[0].name
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    frames_out = []
    for f in FRAMES:
        src = resolve_source(f["file"])
        norm, im = depth_for(sess, in_name, src)
        flat = [round(float(v), 4) for v in norm.reshape(-1)]
        frames_out.append({"id": f["id"], "file": f["file"], "depth": flat})

        Image.fromarray((norm * 255).astype(np.uint8)).resize((256, 256), Image.NEAREST).save(
            os.path.join(PREVIEW_DIR, f"{f['id']}-depth.png")
        )
        im.resize((256, 256), Image.LANCZOS).save(
            os.path.join(PREVIEW_DIR, f"{f['id']}-source.png")
        )
        print(f"[depth] {f['id']:<10} {os.path.basename(src):<32} "
              f"near%={float((norm>0.66).mean())*100:5.1f} far%={float((norm<0.33).mean())*100:5.1f}")

    payload = {
        "cols": COLS,
        "rows": ROWS,
        "model": "depth-anything-v2-small-onnx",
        "generatedAt": date.today().isoformat(),
        "frames": frames_out,
    }
    with open(OUT_FILE, "w") as fh:
        json.dump(payload, fh)
    print(f"[depth] wrote {OUT_FILE} -- {len(frames_out)} frames, {COLS}x{ROWS}")


if __name__ == "__main__":
    main()
