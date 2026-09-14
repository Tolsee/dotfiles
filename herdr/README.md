# Herdr

Run `./herdr/install` to install the shared config, project picker, and integrations
for installed agents. Root `./setup` includes it. Existing regular config files
are backed up once; rerunning keeps links current. tmux remains available.

Background agents use silent macOS banners with a two-second delay. macOS must
allow notifications for terminal-notifier. Click a banner to return to the detected
hosting terminal. Herdr owns notifications; keep additional agent sound hooks off.

Useful bindings (`prefix` is Ctrl+B):

| Keys | Action |
| --- | --- |
| Ctrl+B, f | Pick a project directory and open/focus its workspace |
| Ctrl+B, g | Search across workspaces, tabs, and panes |
| Ctrl+B, w | Pick a workspace |
| Ctrl+B, o | Open the latest notification target |
| Ctrl+B, r | Reload configuration in the attached client/server |
| Ctrl+B, ? | Show the active keymap |
| Ctrl+B, [ then / | Search scrollback |
| Ctrl+B, e | Open scrollback in the editor |

For isolated agent work, use Open worktree... to group existing harness/LTD
checkouts and keep one task per workspace. Session restore is enabled; integrations supply resumable agent IDs.
Re-run the installer after adding an agent such as Pi.

`herdr status` reports client/server version compatibility. Homebrew upgrades the
binary but an existing server may still run the older version. Use the running
TUI's reload action for config-only changes; plan a server restart separately
when its version is stale. Do not stop active work merely to reload preferences.

The previous machine-local Claude sound/bell Notification hook and Codex
`notify-codex` hook were removed during setup. They are not part of this repo.

References: [configuration](https://herdr.dev/docs/configuration/),
[session restore](https://herdr.dev/docs/session-state/).

For several active agents, try `ui.agent_panel_sort = "priority"` and
`ui.status_indicators = "symbols"` in Herdr settings. These optional presentation
preferences are not forced by the shared config.
