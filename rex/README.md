# Rex

Config for [Rex](https://www.superlogical.com/rex), the terminal multiplexer. `setup` links
`~/.config/rex/init.lua` and `~/bin/rex-task` here, and applies `settings.plist`.

## Keys

Prefix `ctrl+b`, the same letters as Herdr (`herdr/.config/herdr/config.toml`).

| Key | Does |
| --- | --- |
| `prefix+t` | Start a task: a Linear link or id, branch or free text. Creates the worktree, opens a session named `ABC-123 title`, starts Claude with the ticket |
| `prefix+o` | Open the focused pane's ticket, PR, changed files, checks or branch |
| `prefix+f` | Open or focus a project session (`HERDR_TASK_PROJECT_ROOTS`) |
| `prefix+w`, `prefix+g` | Session picker |
| `prefix+(` / `prefix+)` | Previous / next session |
| `prefix+c`, `prefix+1..9` | New tab, go to tab |
| `prefix+h/j/k/l` | Focus pane |
| `prefix+v`, `prefix+%` / `prefix+-`, `prefix+"` | Split right / down |
| `prefix+x`, `prefix+z`, `prefix+shift+r` | Close, zoom, resize mode (arrows; enter or esc leaves) |
| `prefix+shift+t`, `prefix+shift+x`, `prefix+shift+q` | Rename tab, close tab, close session |
| `prefix+r`, `prefix+s` | Reload config, settings |
| `prefix+shift+s` | Import the TokyoNight Moon theme from Ghostty |
| `prefix+ctrl+b` | Send `ctrl+b` to the program |
| `cmd+k` | Clear the terminal (Rex's default is the session picker) |

## Tasks

`bin/rex-task` shares `herdr-task`'s conventions: the ticket is saved on its branch
(`git config branch.<b>.linear-*`) and worktrees go to `~/.herdr/worktrees`, so a task started
in either tool opens in the other. Switching the app to a new session needs Settings > Server >
Client Info > Remote Control; without it the session is created and `prefix+w` lists it.

Rex only makes OSC 8 hyperlinks clickable, not plain URLs in output, so scripts print links
with OSC 8 (see `hyperlink` in `bin/rex-task` and `ai/claude/statusline-command.sh`).

## Look

Theme, font, padding, cursor and selection are app preferences (`com.superlogical.rex`), which
`init.lua` cannot set. Change them in Rex Settings, then:

```sh
rex/settings save    # copy them into rex/settings.plist, then commit
rex/settings apply   # write them back (quit Rex first); setup runs this
```
