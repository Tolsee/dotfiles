# Herdr task icons

`HerdrTaskIcons-Regular.ttf` holds brand glyphs that Nerd Fonts lack, at private-use
codepoints Nerd Fonts leave free, so mapping them in Ghostty shadows nothing:

| Codepoint | Glyph  | Used by |
| --------- | ------ | ------- |
| U+E1B0    | Linear | `bin/herdr-task` sidebar token, Claude status line |

Built by `build-task-icons.py` from the Simple Icons font (npm `simple-icons-font`
16.34.0, CC0 1.0). The Linear mark itself remains Linear's trademark. `herdr/install`
copies the font to `~/Library/Fonts`; Ghostty maps the range in `ghostty/.config/ghostty/config`
and needs a fresh launch to load a new font.
