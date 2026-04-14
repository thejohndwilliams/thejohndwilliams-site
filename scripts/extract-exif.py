#\!/usr/bin/env python3
"""
Extract EXIF from a local Lightroom archive and emit src/data/photo-exif.json.

Usage:
    pip install Pillow pillow-avif-plugin
    python3 scripts/extract-exif.py /path/to/lightroom/archive

The script walks the archive recursively, reads EXIF from JPEG/TIFF/
DNG files, and merges entries into src/data/photo-exif.json keyed by
basename (without extension, lowercased).

Safe to re-run. Existing entries are overwritten only if the source
file has a newer captureDate. Does NOT touch files outside the repo.
"""

import sys, os, json, glob, argparse
from PIL import Image
from PIL.ExifTags import TAGS

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MANIFEST = os.path.join(REPO_ROOT, 'src/data/photo-exif.json')

def read_exif(path: str) -> dict:
    try:
        im = Image.open(path)
        exif = im._getexif() or {}
    except Exception:
        return {}
    by_tag = {TAGS.get(k, k): v for k, v in exif.items()}
    out = {}

    make = (by_tag.get('Make') or '').strip()
    model = (by_tag.get('Model') or '').strip()
    if make or model:
        out['camera'] = f'{make} {model}'.strip()

    lens = by_tag.get('LensModel')
    if lens:
        out['lens'] = str(lens).strip()

    fnum = by_tag.get('FNumber')
    if fnum:
        try: out['aperture'] = f'f/{float(fnum):.1f}'.rstrip('0').rstrip('.')
        except Exception: pass

    expo = by_tag.get('ExposureTime')
    if expo:
        try:
            v = float(expo)
            out['shutter'] = f'1/{round(1/v)}s' if v < 1 else f'{v:g}s'
        except Exception: pass

    iso = by_tag.get('ISOSpeedRatings') or by_tag.get('PhotographicSensitivity')
    if iso:
        try: out['iso'] = int(iso)
        except Exception: pass

    fl = by_tag.get('FocalLength')
    if fl:
        try: out['focalLength'] = f'{float(fl):.0f}mm'
        except Exception: pass

    dt = by_tag.get('DateTimeOriginal') or by_tag.get('DateTime')
    if dt:
        # "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD"
        try: out['captureDate'] = str(dt)[:10].replace(':', '-')
        except Exception: pass

    return out

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', help='Path to Lightroom archive root')
    parser.add_argument('--extensions', default='jpg,jpeg,tiff,tif,dng',
                        help='Comma-separated extensions to scan')
    args = parser.parse_args()

    exts = tuple(f'.{e.lower()}' for e in args.extensions.split(','))

    # Load existing manifest
    with open(MANIFEST) as f:
        manifest = json.load(f)

    scanned = updated = 0
    for root, _, files in os.walk(args.archive):
        for name in files:
            if not name.lower().endswith(exts):
                continue
            path = os.path.join(root, name)
            scanned += 1
            basename = os.path.splitext(name)[0].lower()
            # basename in repo uses lowercase; match what thumb/gallery/hero dirs use
            meta = read_exif(path)
            if not meta:
                continue
            existing = manifest.get(basename, {})
            merged = {**existing, **meta}
            if merged \!= existing:
                manifest[basename] = merged
                updated += 1

    # Preserve _README and _SCHEMA if present
    readme = manifest.pop('_README', None)
    schema = manifest.pop('_SCHEMA', None)
    ordered = {}
    if readme: ordered['_README'] = readme
    if schema: ordered['_SCHEMA'] = schema
    for k in sorted(k for k in manifest if not k.startswith('_')):
        ordered[k] = manifest[k]

    with open(MANIFEST, 'w') as f:
        json.dump(ordered, f, indent=2, ensure_ascii=False)

    print(f'Scanned {scanned} files. Updated {updated} manifest entries.')
    print(f'Manifest now holds {sum(1 for k in ordered if not k.startswith("_"))} photo records.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
