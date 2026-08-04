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

- After finishing an implementation task, push, open the PR, and babysit it to merge-ready (watch CI, address bot and human review, keep rebased) without asking. Never merge or self-approve.
- After pushing a fix for a bot reviewer's comment, re-trigger that bot (`@codex review`, `@cursor review`, `@coderabbitai review`, `@devin-ai-integration review`) as an in-thread reply to one of its existing threads, never a top-level PR comment, and wait for its re-review of current HEAD before resolving the thread or declaring merge-ready.
- When design or behavior changes mid-PR, update the PR description in the same push; a stale description makes reviewers flag the new code as contradicting the stated model.
- Write PR bodies with a quoted heredoc (`<<'EOF'`); never backslash-escape backticks (they render literally on GitHub).

## Git

- Create worktrees with the harness's native worktree tool (e.g. Claude Code's EnterWorktree / Agent `isolation: "worktree"`). Never run `git worktree add` manually, and never create sibling directories (`../<repo>-something`). If no native tool exists, use `<repo>/.claude/worktrees/<branch>` (gitignored).
