# Herdr

Run `./herdr/install` to install the shared config, `herdr-task`, `herdr-status`, the
plugins, and integrations for installed agents. Root `./setup` includes it. Existing regular
config files are backed up once; rerunning keeps links current.

Background agents use silent macOS banners with a two-second delay. macOS must
allow notifications for terminal-notifier. Click a banner to return to the detected
hosting terminal. Herdr owns notifications; keep additional agent sound hooks off.

## Task loop

One task, one worktree workspace, one agent. `prefix` is Ctrl+B.

| Key | Action |
| --- | --- |
| `prefix+t` | Start a task: Linear link or id, branch, or free text (prefilled from the clipboard) |
| `prefix+m` | Pick from my open PRs and PRs waiting for my review (CI and review state in the preview): Enter opens it as a task workspace, ctrl-o in the browser |
| `prefix+y` | Review the focused task's branch: Codex (`codex-review`) and a no-edit Claude reviewer in splits |
| `prefix+u` | Ship: prompt the task's agent to review, push, open the PR and babysit it; with no agent, push and open a draft PR |
| `prefix+o` | Open the focused agent's ticket, issue or PR in the browser |
| `prefix+alt+t` | Prune task worktrees whose branch has merged |
| `prefix+f` | Pick a project directory and open or focus its workspace |

Review and ship report through notifications. A second `prefix+y` while the reviewer splits
are open only says so; close them (`prefix+x`) for a fresh review. Reviewers are named
`rv-claude-<n>` / `rv-codex-<n>` and labelled "review" in the sidebar. Set
`HERDR_TASK_REVIEWERS=codex` or `claude` for a single reviewer. Agents can run the same
flows: `herdr-task review`, `herdr-task ship`, `herdr-task --help`.

## Moving around

| Key | Action |
| --- | --- |
| `prefix+a` / `prefix+shift+a` | Next / previous agent |
| `prefix+alt+1..9` | Focus agent by sidebar index |
| `prefix+shift+o` | Open the latest notification target |
| `prefix+;` | Last pane (task agent and reviewer) |
| `prefix+(` / `prefix+)` | Previous / next workspace |
| `prefix+g` | Search across workspaces, tabs, and panes |
| `prefix+w` | Pick a workspace |
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

`ui.tab_bar_right` shows the zoom pill, `~/bin/herdr-status`, and the time. The status reads
like `▲ 2 blocked · #123 draft · changes requested · CI ✗`: agents waiting for you across the
session, then the focused pane's branch PR (draft, review decision, CI rollup). It needs `gh`
logged in; CI shows whatever checks report to GitHub (Buildkite needs its GitHub integration).

## Links

With `ui.mouse_capture = true`, Herdr owns clicks: **Ctrl-click** opens links, Cmd-click does
not reach Ghostty. Herdr opens `http(s)` itself; the `dotfiles.task` plugin handles the rest:

- Linear links open the `prefix+t` popup prefilled with the link.
- `file://` links (file paths agents print) open in `$EDITOR` in a split, at the line.

Claude Code only prints real (OSC 8) links when it trusts the terminal, and it does not
recognise `TERM_PROGRAM=herdr`, so `.zshrc` sets `FORCE_HYPERLINK=1` inside Herdr panes.

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
| `dotfiles.task` | Review and ship actions, link handlers for Linear and files |

Plugin output: `herdr plugin log list --plugin <id>`. Tests for `herdr-task` and
`herdr-status` (fake herdr, no server): `bash herdr/tests/herdr-task.test.sh`.

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
