# Global Agent Rules

Shared by all coding agents (Claude Code, Codex, Antigravity/Gemini). Source of truth: `~/dev/dotfiles/ai/agents/AGENTS.md`.

## Communication

- Be concise and blunt. Precision and brevity over grammar and completeness.
- Never open with agreement or flattery ("You're absolutely right"), and never judge whether my prompt is correct or incorrect.
- Ask clarifying questions only when the request is genuinely ambiguous — then ask 2-4, as multiple-choice options, before starting. Otherwise act immediately.
- Never use em dashes in anything written for me: chat, docs, PR text, commit messages, UI copy. Use a comma, colon, period, or parentheses instead.

## Scope

- Asked for a plan → deliver only the plan. Do not start implementing.
- Asked to run tests → run them directly. Do not spend time exploring the codebase for the test command.

## Delegation

- Main session only. A subagent (anything spawned by the Agent tool or a workflow) reads, greps and fetches directly and never spawns another agent; it reports and stops.
- In the main session, context gathering (docs, READMEs, plugin repos, repo sweeps, bulky fetches) goes to haiku or sonnet subagents per the `/delegate` routing table, even when `/delegate` was not invoked. The main session keeps judgment and edits. A lookup of one known file or one command is done directly.
- Subagent briefs are bounded: the exact question, the shape and length cap of the answer, and a stop condition ("report what you found after N files" or "give up after two failed fetches"). One dispatch per question; a subagent that fails, stalls or comes back empty is not re-dispatched, the main session does that lookup itself. Haiku for mechanical sweeps only; anything needing judgment goes to sonnet.

## Code Changes

- Debug the root cause before fixing. Never change a test to make it pass without understanding why it fails.
- For structural changes (new config fields, service configs), match where existing code nests such things — do not assume top-level placement.

## Pull Requests

- Before opening a PR, run a local Codex review on the branch diff and address its findings first, so review bots and humans see the cleaned-up version. In Claude Code run `~/.codex-review/codex-review --wait --base <base> --scope branch`: it wraps the Codex plugin's native review with a cheaper review-only config. Do not call `/codex:review` (it cannot be self-invoked) or the plugin's `codex-companion.mjs` directly (that uses interactive Codex's config). Other agents use their native Codex review (Codex's `/review`, Pi's `/codex-review`).
- Before a later push to the PR, run it again only when the push adds substantive new logic. Skip it for review-comment fixes, renames, test, doc or config tweaks and rebases; the PR's review bots cover those. At most three local Codex reviews per PR.
- Only the main session runs the local Codex review. Subagents never run it.
- After finishing an implementation task, push, open the PR, and babysit it to merge-ready (watch CI, address bot and human review, keep rebased) without asking. Never merge or self-approve.
- After pushing a fix for a bot reviewer's comment, re-trigger that bot (`@codex review`, `@cursor review`, `@coderabbitai review`; Devin re-reviews on push and has no working mention trigger) as an in-thread reply to one of its existing threads, never a top-level PR comment, and wait for its re-review of current HEAD before resolving the thread or declaring merge-ready.
- When design or behavior changes mid-PR, update the PR description in the same push; a stale description makes reviewers flag the new code as contradicting the stated model.
- Write PR bodies with a quoted heredoc (`<<'EOF'`); never backslash-escape backticks (they render literally on GitHub).

## Terminal

- The multiplexer is Herdr, not tmux. Never run tmux commands, never check `$TMUX`, and never suggest tmux keybindings.
- When I ask how to do something in Herdr, answer with my keys below (prefix is Ctrl+B). For anything not listed, check `herdr --help` or tell me to press `prefix+?`; never guess a key.
- When the work itself is one of these flows, run the command in the last column rather than redoing the flow by hand. "Ask first" means ask me before running it.

| Key | Does | You run instead |
| --- | --- | --- |
| `prefix+t` | Start a task (Linear link or id, branch or free text) in its own worktree workspace with an agent | `herdr-task start <ticket> --project <repo> --title "<title>"` (see Git) |
| `prefix+m` | Pick one of my PRs or a PR waiting for my review: task workspace or browser | `gh search prs --author=@me --state=open` to list; ask first before opening workspaces |
| `prefix+y` | Review the branch: Codex and a no-edit Claude reviewer in splits | `herdr-task review` (ask first: starts agents) |
| `prefix+u` | Ship: the task's agent reviews, pushes, opens the PR, babysits it | Nothing: you already do this when the task is done (see Pull Requests) |
| `prefix+o` | Pick from the task's links (ticket, PR, changed files, checks, failing checks, branch) | Print the link instead |
| `prefix+alt+t` | Prune task worktrees whose branch has merged | `herdr-task prune` (ask first) |
| `prefix+f` | Open or focus a project workspace | Ask first |
| `prefix+a` / `prefix+shift+a` | Next / previous agent | |
| `prefix+alt+1..9` | Focus agent 1 to 9 in the sidebar | |
| `prefix+shift+o` | Jump to the latest notification | |
| `prefix+;` | Last pane (task agent and reviewer) | |
| `prefix+(` / `prefix+)` | Previous / next workspace | |
| `prefix+g` / `prefix+w` | Search everything / workspace picker | |
| `prefix+shift+g` / `prefix+alt+x` | New / remove worktree | Ask first |
| `prefix+[` / `prefix+e` | Copy mode / scrollback in the editor | |
| `prefix+?` | Show every binding | |
| Ctrl-click a link | http(s) opens in the browser; a Linear link starts a task; a file path opens in nvim at its line | |

- Inside Herdr (`HERDR_ENV=1`), use the `herdr` skill for pane and agent control. Without asking you may inspect (`herdr pane current --current`, `pane list`, `agent list`, `pane read`) and open one sibling pane with `herdr pane split --current --direction right --cwd "$PWD" --no-focus` for a long-running process I should see (dev server, watcher, log tail).
- Ask first before creating workspaces, tabs or worktrees outside `herdr-task start`, starting another agent, sending input to a pane you did not create, or closing anything. Herdr owns notifications: do not add bell, sound or notify hooks.
- This table is checked against `herdr/.config/herdr/config.toml` by `herdr/check-keymap`: change both together.

## Git

- Inside Herdr (`HERDR_WORKSPACE_ID` is set) the pane's cwd is usually a task worktree that `herdr-task` created under `~/.herdr/worktrees`. Work there and never create another worktree for the same task.
- Otherwise create worktrees with the harness's native worktree tool (e.g. Claude Code's EnterWorktree / Agent `isolation: "worktree"`). Never run `git worktree add` manually, and never create sibling directories (`../<repo>-something`). If no native tool exists, use `<repo>/.claude/worktrees/<branch>` (gitignored).
- Asked to start or pick up a ticket while inside Herdr: run `herdr-task start <ticket link> --project <repo> --title "<title>"` (look the title up with the Linear MCP first). It creates the worktree workspace and starts a fresh agent there with the ticket as its first prompt; do not start editing in the current pane.
- A task branch carries the ticket id (for example `abc-123-short-title`) so Linear links it. Put the id in the PR title or body too.
- One pane, one branch, one PR. When the ticket also needs a change in another repository, do not edit that repository from this pane: run `herdr-task start <ticket link> --project <repo> --title "<title>" --prompt "<one-paragraph brief of the change needed there>"` to open a sibling workspace with its own agent, then carry on here. Unrelated work in the same repository gets its own ticket and its own `herdr-task start`.

## Advisor

When an advisor model is configured (`advisorModel` in Claude settings), consult it at exactly these points and stay silent otherwise:

- Before locking a plan that touches more than one file: does it miss an invariant, a schema or an API contract?
- When the same test or compiler error fails twice: root cause, or a rabbit hole?
- Before declaring a task done or staging a commit: does the full diff hide a regression?

## AWS

When working with AWS, also read and follow
`~/dev/dotfiles/ai/agents/aws-agent-rules.md`.
