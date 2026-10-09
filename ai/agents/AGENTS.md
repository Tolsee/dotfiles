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

## Code Changes

- Debug the root cause before fixing. Never change a test to make it pass without understanding why it fails.
- For structural changes (new config fields, service configs), match where existing code nests such things — do not assume top-level placement.

## Pull Requests

- Before opening a PR and before every push that updates one, run a local Codex review (`/codex:review` in Claude Code, or the equivalent companion command) on the branch diff and address its findings first, so review bots and humans see the cleaned-up version.
- After finishing an implementation task, push, open the PR, and babysit it to merge-ready (watch CI, address bot and human review, keep rebased) without asking. Never merge or self-approve.
- After pushing a fix for a bot reviewer's comment, re-trigger that bot (`@codex review`, `@cursor review`, `@coderabbitai review`; Devin re-reviews on push and has no working mention trigger) as an in-thread reply to one of its existing threads, never a top-level PR comment, and wait for its re-review of current HEAD before resolving the thread or declaring merge-ready.
- When design or behavior changes mid-PR, update the PR description in the same push; a stale description makes reviewers flag the new code as contradicting the stated model.
- Write PR bodies with a quoted heredoc (`<<'EOF'`); never backslash-escape backticks (they render literally on GitHub).

## Git

- Inside Herdr (`HERDR_WORKSPACE_ID` is set) the pane's cwd is usually a task worktree that `herdr-task` created under `~/.herdr/worktrees`. Work there and never create another worktree for the same task.
- Otherwise create worktrees with the harness's native worktree tool (e.g. Claude Code's EnterWorktree / Agent `isolation: "worktree"`). Never run `git worktree add` manually, and never create sibling directories (`../<repo>-something`). If no native tool exists, use `<repo>/.claude/worktrees/<branch>` (gitignored).
- Asked to start or pick up a ticket while inside Herdr: run `herdr-task start <ticket link> --project <repo> --title "<title>"` (look the title up with the Linear MCP first). It creates the worktree workspace and starts a fresh agent there with the ticket as its first prompt; do not start editing in the current pane.
- A task branch carries the ticket id (for example `abc-123-short-title`) so Linear links it. Put the id in the PR title or body too.

## Advisor

When an advisor model is configured (`advisorModel` in Claude settings), consult it at exactly these points and stay silent otherwise:

- Before locking a plan that touches more than one file: does it miss an invariant, a schema or an API contract?
- When the same test or compiler error fails twice: root cause, or a rabbit hole?
- Before declaring a task done or staging a commit: does the full diff hide a regression?

## AWS

When working with AWS, also read and follow
`~/dev/dotfiles/ai/agents/aws-agent-rules.md`.
