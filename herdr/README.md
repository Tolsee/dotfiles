# Herdr

Run `./herdr/install` to install the shared config, `herdr-task`, `herdr-status`, the
plugins (local and marketplace), and integrations for installed agents. Root `./setup` includes it. Existing regular
config files are backed up once; rerunning keeps links current.

Background agents use silent macOS banners with a two-second delay. macOS must
allow notifications for terminal-notifier. Click a banner to return to the detected
hosting terminal. Herdr owns notifications; keep additional agent sound hooks off.

## Task loop

One task, one worktree workspace, one agent. `prefix` is Ctrl+B.

| Key | Action |
| --- | --- |
| `prefix+t` | Start a task: Linear link or id, branch, or free text (prefilled from the clipboard) |
| `prefix+m` | GitHub PRs ([herdr-github](https://github.com/mrolafsson/herdr-github)): mine, waiting for my review, this repo's; checks, reviews and threads; merge, draft/ready, or a worktree for one |
| `prefix+i` | Recap ([herdr-recap](https://github.com/mrolafsson/herdr-recap)): every agent, the ones waiting on you first, with what each got to and the question it's stuck on; reply from the list, or Enter to go to it |
| `prefix+y` | Review the focused task's branch: Codex (`codex-review`) and a no-edit Claude reviewer in splits |
| `prefix+u` | Ship: prompt the task's agent to review, push, open the PR and babysit it; with no agent, push and open a draft PR |
| `prefix+o` | Links for the focused task: ticket, PR, changed files, checks, each failing check, the branch (compare view before a PR); Enter opens, ctrl-y copies |
| `prefix+alt+t` | Prune task worktrees whose branch has merged |
| `prefix+f` | Pick a project directory and open or focus its workspace |

Review and ship report through notifications. A second `prefix+y` while the reviewer splits
are open only says so; close them (`prefix+x`) for a fresh review. Reviewers are named
`rv-claude-<n>` / `rv-codex-<n>` and labelled "review" in the sidebar. Set
`HERDR_TASK_REVIEWERS=codex` or `claude` for a single reviewer. Agents can run the same
flows: `herdr-task review`, `herdr-task ship`, `herdr-task --help`.

Every picker (these popups and fzf in the shell) uses `fzf/fzfrc`: type to filter,
ctrl-j/ctrl-k move; Esc for normal mode, where j/k move, g/G jump to the ends, ctrl-d/ctrl-u
page, i or / go back to typing, q or Esc quit. The `prefix+t` prompt edits with vi keys.

## Moving around

| Key | Action |
| --- | --- |
| `prefix+a` / `prefix+shift+a` | Next / previous agent |
| `prefix+alt+1..9` | Focus agent by sidebar index |
| `prefix+shift+o` | Open the latest notification target |
| `prefix+;` | Last pane (task agent and reviewer) |
| `prefix+(` / `prefix+)` | Previous / next workspace |
| `prefix+g` | Search across workspaces, tabs, and panes |
| `prefix+w` | Workspace navigation: j/k (or ↑/↓) move between workspaces, h/l and ctrl+j/ctrl+k between panes, Enter opens, Esc leaves |
| `prefix+shift+g` / `prefix+alt+x` | New / remove worktree |
| `prefix+shift+t` / `prefix+shift+x` | Rename / close tab (Herdr defaults) |
| `prefix+r` | Reload configuration in the attached client/server |
| `prefix+?` | Show the active keymap |
| `prefix+[` | Copy mode (then `/` to search scrollback) |
| `prefix+e` | Open scrollback in the editor |

`herdr/check-keymap` (run by the installer) fails when a key documented here or in
`ai/agents/AGENTS.md` is not bound in `config.toml`, or a custom command key is missing from
either doc. Agents read the AGENTS.md table, so keep both in step with the config.

## Status bar

`ui.tab_bar_right` shows the zoom pill, `~/bin/herdr-status`, and the time. The status uses
GitHub's own Octicons (Nerd Font) and reads like `(alert) 2 blocked · (draft PR) #123 ·
(diff) changes · (x) CI`: agents waiting for you across the session, then the focused pane's
branch PR (open, draft, merged or closed icon), its review decision and CI rollup. It needs
`gh` logged in; CI shows whatever checks report to GitHub (Buildkite needs its GitHub
integration). Herdr strips escape sequences from the tab bar, so nothing in it is clickable:
`prefix+o` opens the same PR.

## Links

With `ui.mouse_capture = true`, Herdr owns clicks: **Ctrl-click** opens links, Cmd-click does
not reach Ghostty. Herdr opens `http(s)` itself; the `dotfiles.task` plugin handles the rest:

- Linear links focus that ticket's task workspace when one is open, else open in the browser.
  Starting a task stays on `prefix+t` (copy the link first and it is prefilled).
- `file://` links (file paths agents print) open in `$EDITOR` in a split, at the line.

Claude Code only prints real (OSC 8) links when it trusts the terminal, and it does not
recognise `TERM_PROGRAM=herdr`, so `.zshrc` sets `FORCE_HYPERLINK=1` inside Herdr panes.

## One source for task links

`herdr-task links` is the single place that knows a task's links: the Linear ticket saved on
the branch, the branch's PR with its failing checks, checks and changed files (a compare view
before there is a PR), uncommitted changes, and the branch on GitHub. It answers from git and a
PR cache on disk (`~/.cache/herdr-task/prs`) in tens of milliseconds; `--fresh` (or
`--max-age N`) asks gh and updates the cache. Everything reads it:

| Where | How |
| --- | --- |
| TUI `prefix+o` | fzf opens at once on the cached rows, then gh's answer replaces them in place |
| Herdr app `prefix+o` (`task-links`) | the same rows, cached first, then gh's |
| Herdr app status bar (`task-status`) | the ticket and PR, cached on a focus change, gh at most every 20 s |
| Claude status line | `herdr-task pr --max-age 60`, its gh fallback |

So all of them list the same rows in the same order, and a PR one of them fetched shows up at
once in the others.

## Restarts

A server restart brings back workspaces, tabs, panes and agent conversations (native
session restore), but Herdr keeps no metadata tokens, so the ticket, repo and agent labels
would go blank. They are saved outside Herdr instead and put back:

- `herdr-task start` and `tag` save the ticket on its branch:
  `git config branch.<branch>.linear-id`, `linear-url`, `linear-title`. It goes with the branch.
- The `dotfiles.task` plugin runs `herdr-task retag` at startup, when a worktree is created or
  opened, and when an agent appears in a pane. It reads each task workspace's branch and
  reports the ticket on the workspace and its panes, plus the agent glyph labels.
- Branches from before this (or opened by herdr-github) fall back to the id in the branch name
  (`abc-12-fix`, `me/abc-12-fix`), for team keys a task was started with before, linked through
  the Linear workspace seen last. No Linear API.
- PR badges come from herdr-github, which re-reads them from GitHub on its own startup hook.
  `retag --startup` also drops the Claude status line's PR markers so it reports its links again.

Run `herdr-task retag` by hand any time; it only reports, never changes git or layout.

## Worktrees and plugins

For isolated agent work, use Open worktree... to group existing harness/LTD checkouts and keep
one task per workspace. Session restore is enabled; integrations supply resumable agent IDs.
Re-run the installer after adding an agent such as Pi.

Closing a worktree workspace prunes it: the local `worktree-cleanup` plugin runs
`herdr-task prune-worktree`, which removes the worktree only when its branch has
merged (branch kept) and stops the Codex plugin's leftover brokers for it. Anything
unmerged, dirty or with an open PR stays for `prefix+alt+t` (`herdr-task prune`).

Local plugins, linked by the installer:

| Plugin | Does |
| --- | --- |
| `dotfiles.worktree-cleanup` | Prune a task worktree when its workspace closes |
| `dotfiles.task` | Review and ship actions, link handlers for Linear and files, task tags after a restart |

Marketplace plugins, installed (pinned) by the installer:

| Plugin | Does |
| --- | --- |
| [testy-cool/herdr-sidebar-config](https://github.com/testy-cool/herdr-sidebar-config) | Agent logos, state spinners, workspace > tab > agent tree |
| [mrolafsson/herdr-github](https://github.com/mrolafsson/herdr-github) `v0.11.0` | `prefix+m` PR popup, `$prs` badge on agent rows; uses `gh`'s sign-in. Its app mod is installed at the same ref |
| [mrolafsson/herdr-recap](https://github.com/mrolafsson/herdr-recap) `v0.12.11` | `prefix+i` recap popup. A recap is written once an agent has sat done or blocked, unlooked at, for 3 minutes: one short request on that agent's own Claude/Codex conversation, so it costs tokens (a few cents). Its app mod is installed at the same ref |

Plugin output: `herdr plugin log list --plugin <id>`. Tests for `herdr-task` and
`herdr-status` (fake herdr, no server): `bash herdr/tests/herdr-task.test.sh`.

## Herdr app (GUI)

`./setup` also runs `herdr-app/install`. It installs the [Herdr desktop app](https://github.com/herdrdev/herdr-app)
and herdr-core (`hc`) with the official installer (once; the app updates itself), then links this
repo's files into `~/.config/herdr-app`. Anything there before is kept once as `<name>.backup`.

The app is a separate program on a new core: it does not see the TUI's workspaces or agents,
and the TUI keeps working as before. Pick the **Tasks** layout (Settings, or
`herdr-app do layout.switch --name tasks`). It mirrors the TUI:

| TUI | Tasks layout |
| --- | --- |
| Sidebar: spaces, then agents | Same two lists (the app's `spaces` and `agents`) |
| Tab row, `herdr-status` and the time on its right | Tab row, the `task-status` mod on its right: blocked agents, Linear ticket, PR, review, CI, time. Ticket, PR and CI are clickable |
| TokyoNight Moon, `#82aaff` accent, flat bordered panes, no gaps | `themes/tokyo-night-moon.json`, the same colors, 1px borders, no gaps, JetBrains Mono 14 like Ghostty |

**Keys:** `herdr-app/keys.json` keeps the app's own Cmd shortcuts and adds the TUI keys as
`Ctrl+B` sequences: `ctrl-b c` new tab, `ctrl-b h/j/k/l` move between panes, `ctrl-b v`/`-` split,
`ctrl-b z` zoom, `ctrl-b w` picker, `ctrl-b a` next agent, `ctrl-b ( )` spaces, and the rest.
`ctrl-b ctrl-b` sends Ctrl+B to the program. Press the second key within a second (the app's
limit for key sequences). `herdr-app/check-keys` (in `./test config`) fails when the two keymaps
drift apart. The task keys work in both: `ctrl-b t` start, `f` projects, `o` links (the same
`herdr-task links` as the TUI), `m` herdr-github's app mod, `i` herdr-recap's app mod, plus
`ctrl-b shift-m` (app only) for a PR's worktree with the ticket remembered. Review, ship and
prune (`y`, `u`, `alt+t`) stay TUI-only until herdr-task learns the app, and so do a few with no
app equivalent; its `TUI_ONLY` list says which and why. The app mods of herdr-github and
herdr-recap are copied at the refs pinned in `herdr-app/install` (`EXTERNAL_MODS`), not linked;
only their popup-scoped keys are taken, never their Cmd shortcuts.

Agents in the app run in herdr-core. Claude Code and Codex report working, blocked and done to
it themselves (OSC 7501), so no hooks are needed. `herdr-app check ~/.config/herdr-app/mods/task-status`
checks the mod on the Mac. `node --test herdr-app/tests/*.test.mjs` runs the mods' logic, the
installer and check-keys here against stand-ins.

## Versions

`herdr status` reports client/server version compatibility. Homebrew upgrades the
binary but an existing server may still run the older version. Use the running
TUI's reload action for config-only changes; plan a server restart separately
when its version is stale. Do not stop active work merely to reload preferences.

The previous machine-local Claude sound/bell Notification hook and Codex
`notify-codex` hook were removed during setup. They are not part of this repo.

References: [configuration](https://herdr.dev/docs/configuration/),
[plugins](https://herdr.dev/docs/plugins/),
[session restore](https://herdr.dev/docs/session-state/).
