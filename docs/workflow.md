# Workflow

One task, one branch, one worktree, one agent, one PR. The Herdr TUI, the Herdr app and Rex
all run this loop with the same keys (prefix `Ctrl+B`) and the same stored facts, so a task
started in one opens in the others. The per-tool READMEs ([herdr](../herdr/README.md),
[rex](../rex/README.md)) cover install and look; agent rules are in
[`ai/agents/AGENTS.md`](../ai/agents/AGENTS.md).

## The loop

1. **Start** (`prefix+t`): a Linear link or id, a branch, or free text. A worktree is made under
   `~/.herdr/worktrees/<repo>/<branch>`, the ticket is saved on the branch, and a fresh agent
   starts there with the ticket as its first prompt.
2. **Work**: the agent grooms the ticket, implements, and keeps the sidebar line current
   (`herdr-task doing`).
3. **Links** (`prefix+o`): ticket, PR, changed files, checks, failing checks, branch.
4. **Review** (`prefix+y`): Codex and a no-edit Claude reviewer in splits.
5. **Ship** (`prefix+u`): the agent reviews, pushes, opens the PR and babysits it to merge-ready.
   Nobody merges but you.
6. **Prune** (`prefix+alt+t`): remove task worktrees whose branch has merged.

## Which tool does what

| Step | Herdr TUI | Herdr app (Tasks layout) | Rex |
| --- | --- | --- | --- |
| Start | `prefix+t`, `herdr-task start` | same key, opens a space | `prefix+t`, `rex-task` |
| Links | `prefix+o` | same key, popup and status bar icons | `prefix+o` |
| GitHub PRs, recap | `prefix+m`, `prefix+i` (plugins) | same keys (app mods) | none |
| Review, ship, prune | `prefix+y`, `prefix+u`, `prefix+alt+t` | TUI only | none |
| Grouping | sidebar workspaces | task list grouped by stream, foldable | sessions |
| Agent control | `herdr` CLI | `hc` and `herdr-app` | Rex |

Keys are checked against each other: `herdr/check-keymap` (TUI table vs config) and
`herdr-app/check-keys` (app vs TUI, with its `TUI_ONLY` list).

## What is stored, and where

Everything a task needs lives outside any one tool, so each can pick it up:

| Fact | Where |
| --- | --- |
| Ticket | `git config branch.<b>.linear-id`, `linear-url`, `linear-title` (goes with the branch) |
| Stream of work | `git config branch.<b>.herdr-stream` |
| Worktree | `~/.herdr/worktrees/<repo>/<branch>` |
| PR answer | `~/.cache/herdr-task/prs/<checkout>@<branch>.json`; a failed refresh also writes `.error` beside it |

`herdr-task links` reads these and is the one source for the rows in every UI: the TUI's
`prefix+o`, the app's popup and status bar, and the Claude status line. It answers from the PR
cache at once and lets `gh` refresh it. The app's status bar shows the answer's age next to the
PR icon (red, with the reason on hover, when the last refresh failed).

## Starting without blocking

`herdr-task prepare` makes the branch and worktree and saves the ticket. It does not wait on a
full `git fetch`: a PR link fetches just that branch, anything else starts from the cached
default branch and refreshes in the background.

## Agents

- **Rules** are shared by every agent in `ai/agents/AGENTS.md`: one pane, one branch, one PR;
  sub-tickets run as child sessions in their parent's space (see its Host section).
- **Stop hook** (`ai/claude/hooks/pr-watch-stop.sh`): a Claude session that opened a PR that is
  still open, with nothing watching it, is blocked once and told to babysit it. It reads the PR
  cache, so it costs no model call and no `gh` call.
- **Delegation** goes to the cheapest model that fits (`ai/claude/CLAUDE.md`, Model routing).

## Checks

`./test` runs everything: shellcheck, config parsing, the keymap checks, `herdr-task` against a
fake herdr, the app's mods and installer, the Claude policy tests, and `knip` (unused files,
exports and dependencies in the JS and TS; `npm ci` once to get it). CI runs the same with
nothing skipped.
