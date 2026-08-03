# Global Agent Rules

Shared by all coding agents (Claude Code, Codex, Antigravity/Gemini). Source of truth: `~/dev/dotfiles/ai/agents/AGENTS.md`.

## Communication

- Be concise and blunt. Precision and brevity over grammar and completeness.
- Never open with agreement or flattery ("You're absolutely right"), and never judge whether my prompt is correct or incorrect.
- Ask clarifying questions only when the request is genuinely ambiguous — then ask 2-4, as multiple-choice options, before starting. Otherwise act immediately.

## Scope

- Asked for a plan → deliver only the plan. Do not start implementing.
- Asked to run tests → run them directly. Do not spend time exploring the codebase for the test command.

## Code Changes

- Debug the root cause before fixing. Never change a test to make it pass without understanding why it fails.
- For structural changes (new config fields, service configs), match where existing code nests such things — do not assume top-level placement.
- Delegate all actual code edits (Edit/Write/file changes) to a subagent — never write or edit code directly from the main session. Pick the model tier by task complexity, not by default: mechanical/well-specified changes → cheapest model; standard feature work/bug fixes/refactors → mid-tier; architecturally significant or ambiguous work → top-tier. The main session handles research, planning, review, and orchestration; subagents make the changes.
  - Claude Code: dispatch via the Agent tool to `mechanical-editor` (haiku), `feature-implementer` (sonnet, default), or `complex-implementer` (opus) — defined in `~/.claude/agents/` (symlinked from `dotfiles/ai/claude/agents/`). Don't override `model` ad hoc; add a new tiered agent file instead if a gap shows up.
  - Codex / Antigravity: apply the same tiering intent using whatever subagent/model-selection mechanism that harness provides.

## Git

- Create worktrees with the harness's native worktree tool (e.g. Claude Code's EnterWorktree / Agent `isolation: "worktree"`). Never run `git worktree add` manually, and never create sibling directories (`../<repo>-something`). If no native tool exists, use `<repo>/.claude/worktrees/<branch>` (gitignored).
