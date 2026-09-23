**Herdr assessment for your Claude Code and Codex workflow**

Assessed 2026-09-23 against herdr 0.9.1 (client and server both 0.9.1, per `herdr status`), Claude Code 2.1.280, codex-cli 0.155.1, your dotfiles working tree, and primary documentation. Nothing was installed, reconfigured, or spawned. Only read-only herdr commands were run (`--help`, bare command groups, `--skill`, `status`, `integration status`, `workspace list`, `agent list`, `plugin list`).

My recommendation: install herdr's own `herdr` skill for both agents through `ai/skills`, add a short herdr section to `ai/agents/AGENTS.md` that states when agents may use it without being asked, and switch Claude's `teammateMode` from `"tmux"` to `"in-process"`. Herdr ships no MCP server and no AGENTS.md snippet; the skill plus the CLI is the whole agent surface. The installed integrations only report session IDs for restore; they do not teach the agents anything.

| Area | What is true today, verified locally | What to change |
| --- | --- | --- |
| Agent knowledge of herdr | No `herdr` skill in `~/.agents/skills`, `~/.claude/skills`, or `~/.codex/skills`. `AGENTS.md` never mentions herdr. Both agents run with `HERDR_ENV=1` and the `HERDR_*` context variables set. | Install `herdrdev/herdr --skill herdr`; add a 6-line AGENTS.md section. |
| Integrations | `claude: current (v10)`, `codex: current (v8)`, `pi: current (v9)`, `devin: current (v2)`. Both hooks send only `pane.report_agent_session` on `SessionStart`. | None. They are herdr-managed; do not edit. |
| Claude agent teams | `teammateMode: "tmux"` in defaults and in local `~/.claude/settings.json`; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Not inside tmux, `TERM_PROGRAM=ghostty`, no `it2`. | `"in-process"` in both files (local wins on merge). |
| Claude notifications | `preferredNotifChannel: "ghostty"` (local only); no `Notification` hook. | Optional: `"notifications_disabled"`. Herdr already owns banners. |
| Codex notifications | `[tui] notifications = [agent-turn-complete, approval-requested]`, `notification_method = "osc9"`, `notification_condition = "always"`. No `notify`. | Optional: `tui.notifications = false`, same reason. |
| herdr config | Silent system banners, session restore on, no agent-navigation keys, no plugins. | See "Worth adding to herdr". |

## 1. Herdr's agent-facing docs

`herdr --help` ends with an explicit agent routing block: [agent-guide.md](https://herdr.dev/agent-guide.md) for helping a human set up herdr, [llms.txt](https://herdr.dev/llms.txt) for debugging, and `herdr --skill` for controlling panes, agents, or workspaces ("SKIP if a Herdr skill is already in your context").

- **agent-guide.md** is for teaching humans. Its rules for agents: do not invent keys or flags, do not give tmux advice for herdr, never tell a user to run `herdr` from inside a pane (nested launches are blocked), and offer to install the skill with `npx skills add herdrdev/herdr --skill herdr -g`. Diagnosis: `herdr agent list`, `herdr agent explain <target> --json`, `herdr integration status`, `herdr status`, logs in `~/.config/herdr/`.
- **llms.txt** is an index of raw docs pinned to the release tag (v0.9.1), plus `llms-full.txt`/`llms-small.txt` bundles. The relevant pages are [Agent automation](https://herdr.dev/docs/agent-automation/), [Agent skill file](https://herdr.dev/docs/agent-skill/), [Integrations](https://herdr.dev/docs/integrations/), [CLI reference](https://herdr.dev/docs/cli-reference/), [Socket API](https://herdr.dev/docs/socket-api/), and [Plugins](https://herdr.dev/docs/plugins/).
- **The skill** (`herdr --skill`, byte-identical to [skills/herdr/SKILL.md on master](https://github.com/herdrdev/herdr/blob/master/skills/herdr/SKILL.md) on 2026-09-23) is the operating manual. Its description gates itself narrowly: use "only when the user explicitly mentions Herdr or asks to use Herdr ... Do not use merely because a task could benefit from a background terminal, delegation, or parallel work." It requires `HERDR_ENV=1` and stops otherwise.

Key rules from the skill that matter for your setup: default to a sibling pane in the current tab and cwd (`pane split --current --direction right|down --cwd "$PWD" --no-focus`); never create workspaces, tabs, or worktrees unless asked; parse IDs from JSON; never close what you did not create; never `herdr server stop`; do not run bare `herdr` for discovery (it attaches the TUI); and treat a timeout as "maybe delivered", so read before re-prompting.

## 2. CLI surface for agents

From the bare command groups (`herdr agent`, `herdr pane`, and so on) on 0.9.1:

| Need | Command |
| --- | --- |
| Where am I | `herdr pane current --current`, `pane layout --current`, env `HERDR_WORKSPACE_ID`/`HERDR_TAB_ID`/`HERDR_PANE_ID` |
| Inventory | `workspace list`, `tab list --workspace ID`, `pane list --workspace ID`, `agent list` (includes cwd, state, session ID, terminal title) |
| Make a terminal | `pane split [--current] --direction right\|down [--cwd] [--env K=V] --no-focus`; `tab create`; `workspace create` |
| Run a process | `pane run ID "cmd"` (text + Enter), `pane send-text`, `pane send-keys` |
| Read output | `pane read ID --source visible\|recent\|recent-unwrapped --lines N`; `pane wait-output ID --match\|--regex --timeout MS` |
| Drive another agent | `agent start NAME --kind claude\|codex\|... --pane ID [-- args]`, `agent prompt NAME "text" --wait --timeout MS`, `agent wait --until blocked`, `agent read`, `agent send-keys NAME esc` |
| States | `idle`, `working`, `blocked` (approval or question UI), `done` (idle, not yet seen), `unknown` |
| Worktrees | `worktree list\|create\|open\|remove` (Git worktree, opened as a grouped workspace) |
| Notify | `notification show TITLE [--body] [--sound none\|done\|request]`, delivered via `[ui.toast]` |
| Sidebar | `pane report-metadata` (title, display name, tokens, TTL), `workspace report-metadata` |
| Other | `plugin install\|link\|action invoke\|...`, `terminal title set`, `--machine` for saved SSH hosts |

Full-screen agents (Claude Code) keep history in the alternate screen; `agent read --lines N` scrolls it for idle agents only and returns `agent_not_idle` otherwise ([Agent automation](https://herdr.dev/docs/agent-automation/)). Server errors are JSON on stderr with exit 1; syntax errors exit 2.

For Claude Code this overlaps with native background Bash. The herdr win is visibility: the process lives in a pane the user can see, focus, and keep after the agent session ends, and another agent (for example a Codex reviewer) is observable and addressable by name.

## 3. What the installed integrations do

Both scripts are herdr-managed ("reinstalling or updating the integration overwrites this file"). Each exits unless `HERDR_ENV=1`, `HERDR_SOCKET_PATH`, and `HERDR_PANE_ID` are set, then sends one `pane.report_agent_session` JSON request over the Unix socket with the native session ID. That is all.

- **Claude** (`~/.claude/hooks/herdr-agent-state.sh`, v10): `SessionStart` entry in `~/.claude/settings.json` with matcher `^(startup|resume|clear|compact|fork)$`. Skips subagents (`agent_id` set) and Cursor. Also sends `transcript_path` and the start source.
- **Codex** (`~/.codex/herdr-agent-state.sh`, v8): `SessionStart` entry in `~/.codex/hooks.json`; install also ensures `[features] hooks = true` in `config.toml` (present at line 89-90). Skips child sessions whose `CODEX_THREAD_ID` differs.

Per [Integrations](https://herdr.dev/docs/integrations/), Claude and Codex are "session identity" integrations: they enable native resume after a server restart (`[session] resume_agents_on_restore = true`, already set). Working/blocked/idle state for both still comes from herdr's screen-manifest detection, not from hooks. There is no documented way to make Claude or Codex authoritative for lifecycle except a custom `pane report-agent` hook, which the docs warn would compete with the managed integration; user hooks should use `pane report-metadata` instead.

Gotcha: `ai/agents/install` merges with `jq '.[0] * .[1]'`, local wins and arrays are replaced whole. The herdr `SessionStart` array lives only in local settings, so it survives. If `settings.defaults.json` ever gains a `SessionStart` hook, local's array wins and the default hook silently disappears.

## 4. Skills, AGENTS.md snippets, MCP

- **Skill: yes.** One skill, `herdr`. Install per [Agent skill file](https://herdr.dev/docs/agent-skill/): `npx skills add herdrdev/herdr --skill herdr -g`. For agents without skills, paste the file into user instructions. `herdr --skill` prints the copy that matches the installed binary.
- **AGENTS.md snippet: no.** Herdr ships none. The agent guide says to paste the skill for agents lacking a skill system, which does not apply here.
- **MCP server: no.** None in llms.txt, the docs pages fetched, or the CLI. The programmatic surfaces are the CLI and the [Socket API](https://herdr.dev/docs/socket-api/) (JSON over `HERDR_SOCKET_PATH`, including `events.subscribe`).

Both agents read `~/.agents/skills` indirectly through the skills CLI links your `ai/skills/install` already manages; Codex also scans `$HOME/.agents/skills` natively ([Codex skills](https://developers.openai.com/codex/skills)).

## 5. tmux and terminal coupling in the agents

**Claude Code agent teams** ([agent teams](https://code.claude.com/docs/en/agent-teams#choose-a-display-mode), [settings reference](https://code.claude.com/docs/en/settings-reference#teammatemode)):

- `teammateMode` accepts exactly `"in-process"` (default), `"auto"`, `"tmux"`, `"iterm2"` (v2.1.186+). No custom or pluggable backend is documented, so herdr cannot stand in for split panes.
- `"auto"` uses split panes only inside tmux or iTerm2; otherwise in-process. `"tmux"` "enables split-pane mode and auto-detects whether to use tmux or iTerm2 based on your terminal". The limitations list says split panes are not supported in Ghostty.
- Your panes are not inside tmux and report `TERM_PROGRAM=ghostty` (herdr passes the outer terminal's value through). What `"tmux"` does in that case is **unverified**; the docs' "Orphaned tmux sessions" section suggests it can create its own tmux session. Herdr does not detect agents inside a tmux launched in a pane ([Agents](https://herdr.dev/docs/agents/)), so any such teammate would be invisible to herdr's sidebar and notifications.
- Net: `"in-process"` is the correct value under herdr. `"auto"` behaves the same here but would silently flip to tmux if you ever run Claude inside tmux again.

**Claude Code notifications** ([settings reference](https://code.claude.com/docs/en/settings-reference#preferrednotifchannel), [terminal config](https://code.claude.com/docs/en/terminal-config#get-a-terminal-bell-or-notification)): values are `auto`, `terminal_bell`, `iterm2`, `iterm2_with_bell`, `kitty`, `ghostty`, `notifications_disabled`. They are all escape sequences written to the pane. Herdr "emulates the terminals in its panes" and documents that OSC 0/2 titles stop at herdr ([Configuration](https://herdr.dev/docs/configuration/)); herdr's source retains OSC 9 payloads for agent detection. Whether herdr forwards a pane's desktop-notification escapes to Ghostty is **unverified** (not documented; not tested to avoid firing a live banner). Either they are swallowed (setting is dead) or they duplicate herdr's banners. `inputNeededNotifEnabled` and `agentPushNotifEnabled` are phone pushes through Remote Control and unrelated to the terminal; keep them.

The only other tmux coupling in the Claude docs is the `~/.tmux.conf` passthrough/extended-keys advice for Shift+Enter, which does not apply to herdr.

**Codex** ([advanced config](https://developers.openai.com/codex/config-advanced), [config reference](https://developers.openai.com/codex/config-reference)): `tui.notifications` (bool or event list), `tui.notification_method` (`auto | osc9 | bel`; auto prefers OSC 9, falls back to BEL), `tui.notification_condition` (`unfocused | always`), and top-level `notify` (external program). Same situation as Claude: pane escapes, forwarding **unverified**. `notification_condition = "always"` means Codex fires even while you watch the pane, whereas herdr suppresses notifications for the active tab. No tmux-specific Codex behavior is documented.

## 6. Recommendations, ranked

**1. Install the herdr skill for all agents** via the existing upstream allowlist, so `./ai/skills/install` and `./ai/skills/update` own it. Add to `ai/skills/upstream-skills`:

```bash
HERDR_SKILLS=(herdr)
UPSTREAM_SKILLS=("${MATTPOCOCK_SKILLS[@]}" "${PORTAL_SKILLS[@]}" "${HERDR_SKILLS[@]}")
```

and to `ai/skills/install`, after the Portal block:

```bash
echo "Installing herdr skill from herdrdev/herdr -> agents: ${SELECTED_AGENTS[*]}"
npx -y skills@latest add herdrdev/herdr \
  --skill "${HERDR_SKILLS[@]}" \
  --agent "${SELECTED_AGENTS[@]}" \
  --global \
  --yes
```

This tracks herdr `master`, which can run ahead of the brew binary. The skill tells the agent to treat `herdr --help` as the authority, which limits the damage. Not run; **unverified** that the skills CLI resolves `skills/herdr/` cleanly, though herdr's docs give exactly this command.

**2. Add a herdr section to `ai/agents/AGENTS.md`.** The skill's own description only fires when you mention herdr. This section records your standing permission for the low-risk cases and keeps the rest gated:

```markdown
## Herdr

My terminal multiplexer is herdr, not tmux. Never give tmux commands or advice, and never start tmux.
When `HERDR_ENV=1`, use the `herdr` skill (or `herdr --skill`) for pane and agent control. Without asking, you may:
- inspect state (`herdr pane current --current`, `pane list`, `agent list`, `pane read`)
- open one sibling pane with `herdr pane split --current --direction right --cwd "$PWD" --no-focus` for a long-running process I should see (dev server, watcher, log tail), and read it with `pane read` / `pane wait-output`
Ask first before creating workspaces, tabs, or worktrees, starting another agent, sending input to a pane you did not create, or closing anything. Herdr owns notifications: do not add bell, sound, or notify hooks.
```

It uses the same `AGENTS.md` both agents already load. It does not relax the existing worktree rule.

**3. Set `teammateMode` to `"in-process"`** in `ai/claude/settings.defaults.json` and in local `~/.claude/settings.json` (the merge keeps the local `"tmux"` otherwise). For visible parallel agents under herdr, ask for the herdr route instead: `pane split` plus `agent start NAME --kind claude|codex`. Trade-off: those agents do not share Claude's team task list or messaging.

**4. Optional: turn off agent-side terminal notifications** to make herdr the single owner, matching `herdr/README.md`. In local `~/.claude/settings.json`, `"preferredNotifChannel": "notifications_disabled"`. In `~/.codex/config.toml` under `[tui]`, `notifications = false`. Low value if herdr already swallows the escapes (**unverified**); do it only if you see duplicate banners, or to remove dead config.

Not recommended: an MCP wrapper around the herdr CLI (the CLI already returns JSON and the skill covers it), or a custom `pane report-agent` lifecycle hook for Claude or Codex (competes with herdr's managed detection).

## Worth adding to herdr

Ranked by value for running several agents at once. All keys are from the [config reference](https://herdr.dev/docs/config-reference/) for 0.9.1. Check the keys for conflicts with `prefix+?` before committing.

1. **Agent navigation keys.** `next_agent`, `previous_agent`, and `focus_agent` are unset by default; `open_notification_target` (`prefix+o`) is the only jump you have. The docs' example binding is `focus_agent = "prefix+alt+1..9"`. Pair with `ui.agent_panel_sort = "priority"` and `ui.status_indicators = "symbols"` (already suggested in `herdr/README.md`) so blocked agents surface first.

   ```toml
   [keys]
   next_agent = "prefix+a"
   previous_agent = "prefix+shift+a"
   focus_agent = "prefix+alt+1..9"

   [ui]
   agent_panel_sort = "priority"
   status_indicators = "symbols"
   ```

2. **Show each Claude session's task in the sidebar.** Claude sets a terminal title. Sidebar rows accept that token ([Configuration: sidebar row layouts](https://herdr.dev/docs/configuration/)):

   ```toml
   [ui.sidebar.agents.rows_by_agent]
   claude = [
     ["state_icon", "agent", "state_text"],
     ["terminal_title_stripped"],
     ["workspace", "tab"],
   ]
   ```

   Add the same for `codex` only if Codex sets a useful title (**unverified**).

3. **Parallel agents per worktree, with one home for checkouts.** Herdr's worktree UI (`New worktree`, `Open worktree...`, grouped under the source workspace) defaults to `~/.herdr/worktrees/<repo>/<branch>`, while `AGENTS.md` sends agent worktrees to the harness tool or `<repo>/.claude/worktrees/<branch>`. Keep the harness as creator and use herdr to group: bind `open_worktree` (unset by default), for example `open_worktree = "prefix+shift+o"`, and pick harness checkouts from it. Then one agent per grouped workspace, driven by `agent start`/`agent prompt`. If you want herdr to create them too, you would need to relax the AGENTS.md rule for herdr's UI; that is a policy call, not a technical limit.

4. **A local dotfiles plugin** (`herdr plugin link <path>`, [Plugins](https://herdr.dev/docs/plugins/)) for repeatable flows. Plugin v1 supports manifest actions, event hooks (for example `worktree.created`), plugin panes, and link handlers, and the whole CLI is the plugin API. Two concrete candidates: a `review` action that splits a pane and runs `agent start reviewer --kind codex` then `agent prompt ... --wait` on the current diff, bound with `type = "plugin_action"`; and a `worktree.created` hook that bootstraps a new checkout. Link it from the repo instead of installing marketplace plugins: the [marketplace](https://herdr.dev/docs/marketplace/) is unreviewed, and plugins run unsandboxed as you.

5. **Popups for tools you open often** ([Configuration: custom command keybindings](https://herdr.dev/docs/configuration/)). The docs' examples are a lazygit popup and a scratch shell:

   ```toml
   [[keys.command]]
   key = "prefix+alt+g"
   type = "popup"
   command = "lazygit"
   description = "lazygit"
   width = "80%"
   height = "80%"
   ```

6. **Sessionizer hardening** (`bin/herdr-sessionizer`). It matches existing workspaces by `label == basename`, so `~/dev/work/x` and `~/dev/hobby/x` collide, and renaming a workspace breaks the match. `herdr workspace list` exposes no cwd (verified), but `pane list`/`agent list` do. Matching on a root pane's cwd, or labelling with the parent directory on collision, fixes it. Low priority until a collision actually happens.

Skip for now: `experimental.pane_history` (persists pane contents to disk; the docs flag the security trade-off, see [Session state](https://herdr.dev/docs/session-state/)) and `ui.toast` changes (the current silent system banners are the recommended setup from the Pi assessment).
