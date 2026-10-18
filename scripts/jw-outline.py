#!/usr/bin/env python3
"""Emit one SVG path for the JW app mark, in EB Garamond at weight 400.

An SVG used as an icon cannot load the site webfonts, so the glyphs are
outlined here. The variable file has a single wght axis (400-800) and no
optical-size axis. This instantiates wght 400, shapes "JW", and applies
the font kern pair.

Setup (not a package.json dependency):

    python3 -m pip install 'fonttools>=4.55' brotli

Stdout is a single JSON object. Diagnostics go to stderr.
"""

import json
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

TEXT = "JW"


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def x_fields(value):
    """Return (xPlacement, xAdvance) from a GPOS ValueRecord."""
    if value is None:
        return 0, 0
    return (
        int(getattr(value, "XPlacement", 0) or 0),
        int(getattr(value, "XAdvance", 0) or 0),
    )


def pair_adjustment(lookup, glyph_a, glyph_b):
    """First matching kern subtable wins, per the GPOS lookup rule.

    Returns (xAdvance added to the first glyph, xPlacement of the second).
    """
    for subtable in lookup.SubTable:
        real = getattr(subtable, "ExtSubTable", subtable)
        if real.LookupType != 2 and type(real).__name__ != "PairPos":
            continue
        glyphs = real.Coverage.glyphs
        if glyph_a not in glyphs:
            continue
        if real.Format == 1:
            pair_set = real.PairSet[glyphs.index(glyph_a)]
            for record in pair_set.PairValueRecord:
                if record.SecondGlyph != glyph_b:
                    continue
                adv_a = x_fields(record.Value1)[1]
                place_b = x_fields(record.Value2)[0]
                return adv_a, place_b
            continue
        if real.Format == 2:
            class_a = real.ClassDef1.classDefs.get(glyph_a, 0)
            class_b = real.ClassDef2.classDefs.get(glyph_b, 0)
            record = real.Class1Record[class_a].Class2Record[class_b]
            adv_a = x_fields(record.Value1)[1]
            place_b = x_fields(record.Value2)[0]
            return adv_a, place_b
    return 0, 0


def main():
    if len(sys.argv) != 2:
        fail("usage: jw-outline.py <eb-garamond-normal.woff2>")
    font = TTFont(sys.argv[1])
    if "fvar" not in font:
        fail("font has no fvar table; expected a variable EB Garamond")
    axes = font["fvar"].axes
    if len(axes) != 1 or axes[0].axisTag != "wght":
        fail(f"expected a single wght axis, found {[a.axisTag for a in axes]}")
    axis = axes[0]
    if axis.minValue != 400 or axis.maxValue != 800:
        fail(f"expected wght 400-800, found {axis.minValue}-{axis.maxValue}")

    instantiateVariableFont(font, {"wght": 400}, inplace=True)
    if font["OS/2"].usWeightClass != 400:
        fail(f"instantiated weight class is {font['OS/2'].usWeightClass}, expected 400")

    cmap = font.getBestCmap()
    names = []
    for char in TEXT:
        name = cmap.get(ord(char))
        if not name:
            fail(f"cmap has no glyph for {char}")
        names.append(name)

    gpos = font["GPOS"].table
    kern_lookup = None
    for feature in gpos.FeatureList.FeatureRecord:
        if feature.FeatureTag != "kern":
            continue
        indexes = feature.Feature.LookupListIndex
        if len(indexes) != 1:
            fail(f"expected one kern lookup, found {len(indexes)}")
        kern_lookup = gpos.LookupList.Lookup[indexes[0]]
        break
    if kern_lookup is None:
        fail("font has no kern feature")

    glyph_set = font.getGlyphSet()
    cursor = 0
    kern_units = 0
    parts = []
    bounds_pen = BoundsPen(glyph_set)
    for index, name in enumerate(names):
        placement = 0
        if index:
            advance, placement = pair_adjustment(kern_lookup, names[index - 1], name)
            kern_units += advance + placement
            cursor += advance + placement
        matrix = (1, 0, 0, -1, cursor, 0)
        path_pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(TransformPen(path_pen, matrix))
        parts.append(path_pen.getCommands())
        glyph_set[name].draw(TransformPen(bounds_pen, matrix))
        cursor += glyph_set[name].width

    bounds = bounds_pen.bounds
    if bounds is None:
        fail("JW outline has no ink")
    x_min, y_min, x_max, y_max = bounds
    payload = {
        "text": TEXT,
        "unitsPerEm": font["head"].unitsPerEm,
        "weight": 400,
        "kern": kern_units,
        "d": "".join(parts),
        "bounds": {
            "xMin": x_min,
            "yMin": y_min,
            "xMax": x_max,
            "yMax": y_max,
        },
    }
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
