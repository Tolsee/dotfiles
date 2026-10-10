#!/usr/bin/env python3
"""Build HerdrTaskIcons-Regular.ttf: single brand glyphs the sidebar and herdr-task use.

Source: the Simple Icons font (npm simple-icons-font, CC0 1.0), subset to the glyphs
below and remapped to private-use codepoints that Nerd Fonts leave free
(U+E1B0.. sits between the Powerline and Font Awesome Extension blocks), so a Ghostty
font-codepoint-map for this range never shadows a Nerd Font glyph.

    uv run --with fonttools python3 -I herdr/fonts/build-task-icons.py SimpleIcons.ttf

Download the source first:
    curl -sLO https://cdn.jsdelivr.net/npm/simple-icons-font@16.34.0/font/SimpleIcons.ttf
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FAMILY = "Herdr Task Icons"
# target codepoint -> source codepoint in SimpleIcons.ttf (see font/simple-icons.css)
GLYPHS = {0xE1B0: 0xF09B}  # linear

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent / "HerdrTaskIcons-Regular.ttf"

font = TTFont(src)
options = subset.Options()
options.name_IDs = ["*"]
options.notdef_outline = True
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=list(GLYPHS.values()))
subsetter.subset(font)

cmap = font["cmap"]
for table in cmap.tables:
    remapped = {}
    for target, source in GLYPHS.items():
        if source in table.cmap:
            remapped[target] = table.cmap[source]
    table.cmap = remapped

for rec in font["name"].names:
    nid = rec.nameID
    if nid in (1, 16):
        rec.string = FAMILY
    elif nid == 4:
        rec.string = f"{FAMILY} Regular"
    elif nid == 6:
        rec.string = "HerdrTaskIcons-Regular"
    elif nid == 3:
        rec.string = f"{FAMILY}:Regular:herdr-dotfiles"

font.save(out)
check = TTFont(out)
got = check.getBestCmap()
missing = [hex(cp) for cp in GLYPHS if cp not in got]
if missing:
    sys.exit(f"missing glyphs after build: {missing}")
print(f"wrote {out} ({out.stat().st_size} bytes) with {sorted(hex(c) for c in got)}")
