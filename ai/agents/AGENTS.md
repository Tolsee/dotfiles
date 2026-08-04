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
- Delegate all actual code edits (Edit/Write/file changes) to a subagent — never write or edit code directly from the main session. The main session handles research, planning, review, and orchestration; subagents make the changes. Implementer subagents cannot spawn further subagents — their tool lists exclude the Agent tool — so a dispatched subagent makes its assigned edits itself.
- **Default to the mid-tier model for implementation.** The top-tier main session does the *logical* work — diagnosis, deciding the exact change, verifying the result — and hands the *implementation* down. A top-tier subagent re-derives reasoning the main session already did, so it costs far more for the same diff. Tiers: mechanical/well-specified edits, renames, an already-diagnosed one-liner → cheapest model; everything else, including multi-file feature work, bug fixes and refactors → mid-tier. There is no top-tier implementer: the main session decides the structure first, then hands a spelled-out change to the mid-tier. "This spans several files" or "this looks intricate" is not a reason to escalate.
  - Claude Code: dispatch via the Agent tool to `mechanical-editor` (haiku) or `feature-implementer` (sonnet, default) — defined in `~/.claude/agents/` (symlinked from `dotfiles/ai/claude/agents/`). Don't override `model` ad hoc; add a new tiered agent file instead if a gap shows up.
  - Codex / Antigravity: apply the same tiering intent using whatever subagent/model-selection mechanism that harness provides.
- **Verify the artifact, never the agent's report.** Read the actual diff and run the tests yourself before believing a subagent finished. Agents go idle without reporting, report work they never did, and report work they did do as "already present when I opened the file". A report is a claim; the diff is the evidence. This is the highest-value rule here: every real defect caught in delegated work has come from reading the diff, not the summary.
- **Keep briefs short.** State the file, the exact change, the constraint, and the verification command. Put the long diagnosis in the task list, not the prompt. Overlong briefs correlate strongly with an agent that never starts editing at all, which costs more wall-clock than a wrong edit because there is nothing to review.
- **Dispatch one agent per file, not one per finding.** Two agents editing the same file conflict, and serialising them turns work that looked parallel into a queue. Group every change a given file needs into a single dispatch, even when the changes are unrelated.
- **Scope a subagent's verification to the specs it touched; run the full suite once yourself before committing.** Every subagent running the entire suite multiplies wall-clock for no extra signal, and a subagent cannot distinguish its own failures from a concurrent agent's anyway.

## Git

- Create worktrees with the harness's native worktree tool (e.g. Claude Code's EnterWorktree / Agent `isolation: "worktree"`). Never run `git worktree add` manually, and never create sibling directories (`../<repo>-something`). If no native tool exists, use `<repo>/.claude/worktrees/<branch>` (gitignored).
