# Build-time monocular DEPTH derivation for the KineticPlate 3D renderer.
#
# Companion to build-kinetic-signature.mjs (the LUMINANCE builder). It reads
# src/data/kinetic-signature.json — which the Node builder wrote, including the
# RESOLVED source path per frame — so depth runs on the exact same image and
# grid as luminance (no drift). For each frame it runs a monocular depth model
# (Depth-Anything-V2 Small, ONNX) and writes a depth grid aligned cell-for-cell
# with the luminance grid.
#
# Output: src/data/kinetic-depth.json
#   { cols, rows, model, generatedAt, frames: [{ id, file, depth: number[] }] }
#
# Depth-Anything outputs RELATIVE INVERSE depth (larger = nearer the camera),
# which is exactly the sign the renderer wants (bright depth-cell -> forward).
#
# The model path comes from $KINETIC_DEPTH_MODEL (set by the orchestrator,
# `npm run kinetic:build`) or defaults to the setup cache. Run `npm run
# kinetic:setup` once to provision the venv + model. Model is build-time only;
# the committed JSON is the runtime source of truth (no model, torch, or CSP
# surface ships to the browser).

import json
import os
from datetime import date

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIG_FILE = os.path.join(ROOT, "src/data/kinetic-signature.json")
OUT_FILE = os.path.join(ROOT, "src/data/kinetic-depth.json")
PREVIEW_DIR = os.path.join(ROOT, ".kinetic-depth-preview")
DEFAULT_MODEL = os.path.join(ROOT, "scripts/kinetic/.cache/depth-anything-v2-small.onnx")
MODEL = os.environ.get("KINETIC_DEPTH_MODEL", DEFAULT_MODEL)

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def center_square(im):
    w, h = im.size
    s = min(w, h)
    return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def depth_for(sess, in_name, in_size, src_abs, cols, rows):
    im = center_square(Image.open(src_abs).convert("RGB"))
    imr = im.resize((in_size, in_size), Image.LANCZOS)
    arr = (np.asarray(imr).astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    arr = np.transpose(arr, (2, 0, 1))[None, ...].astype(np.float32)
    out = np.squeeze(sess.run(None, {in_name: arr})[0]).astype(np.float32)

    small = np.asarray(
        Image.fromarray(out, mode="F").resize((cols, rows), Image.BICUBIC),
        dtype=np.float32,
    )
    lo, hi = float(small.min()), float(small.max())
    norm = (small - lo) / max(1e-6, hi - lo)
    return norm, im


def main():
    if not os.path.exists(MODEL):
        raise SystemExit(
            f"kinetic: depth model not found at {MODEL}\n"
            f"Run `npm run kinetic:setup` first (downloads it to the cache)."
        )
    if not os.path.exists(SIG_FILE):
        raise SystemExit(
            "kinetic: kinetic-signature.json missing; run the luminance builder "
            "first (`node scripts/build-kinetic-signature.mjs` or `npm run kinetic:build`)."
        )

    sig = json.load(open(SIG_FILE))
    cols, rows = sig["cols"], sig["rows"]
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    in_node = sess.get_inputs()[0]
    in_name = in_node.name
    in_size = in_node.shape[2] if isinstance(in_node.shape[2], int) else 518
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    frames_out = []
    for fr in sig["frames"]:
        src_abs = os.path.join(ROOT, fr["src"])
        norm, im = depth_for(sess, in_name, in_size, src_abs, cols, rows)
        frames_out.append({
            "id": fr["id"],
            "file": fr["file"],
            "depth": [round(float(v), 4) for v in norm.reshape(-1)],
        })
        Image.fromarray((norm * 255).astype(np.uint8)).resize((256, 256), Image.NEAREST).save(
            os.path.join(PREVIEW_DIR, f"{fr['id']}-depth.png"))
        im.resize((256, 256), Image.LANCZOS).save(
            os.path.join(PREVIEW_DIR, f"{fr['id']}-source.png"))
        print(f"[kinetic:depth] {fr['id']:<10} near%={float((norm>0.66).mean())*100:5.1f} "
              f"far%={float((norm<0.33).mean())*100:5.1f}  <- {fr['src']}")

    payload = {
        "cols": cols,
        "rows": rows,
        "model": os.path.basename(MODEL),
        "generatedAt": date.today().isoformat(),
        "frames": frames_out,
    }
    json.dump(payload, open(OUT_FILE, "w"))
    print(f"[kinetic:depth] wrote {os.path.relpath(OUT_FILE, ROOT)} -- {len(frames_out)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
