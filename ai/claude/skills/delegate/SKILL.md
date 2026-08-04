---
name: delegate
description: Dispatch code edits to tiered implementer subagents (mechanical-editor / feature-implementer) instead of editing from the main session. Human-invoked only — never auto-invoke.
disable-model-invocation: true
---

# Delegate edits to implementer subagents

For this task, delegate the actual code edits (Edit/Write/file changes) to subagents — the main session handles research, planning, review, and orchestration. Implementer subagents cannot spawn further subagents — their tool lists exclude the Agent tool — so a dispatched subagent makes its assigned edits itself.

**Small-edit exception:** if a change is small (roughly ≤15 lines across 1–2 files already read into context) and fully decided, make it directly — a subagent re-reading context costs more tokens than the edit itself.

## Rules

- **Default to the mid-tier model for implementation.** The top-tier main session does the *logical* work — diagnosis, deciding the exact change, verifying the result — and hands the *implementation* down. A top-tier subagent re-derives reasoning the main session already did, so it costs far more for the same diff. Tiers: mechanical/well-specified edits, bulk renames, an already-diagnosed one-liner → `mechanical-editor` (haiku); everything else, including multi-file feature work, bug fixes and refactors → `feature-implementer` (sonnet, default). Agents defined in `~/.claude/agents/` (symlinked from `dotfiles/ai/claude/agents/`). Don't override `model` ad hoc; add a new tiered agent file instead if a gap shows up. There is no top-tier implementer: the main session decides the structure first, then hands a spelled-out change to the mid-tier. "This spans several files" or "this looks intricate" is not a reason to escalate. The same logic applies to non-edit subagents: pick the cheapest sufficient model (haiku for mechanical lookups and grep sweeps, sonnet for repo recon/verification) and batch independent lookups into one dispatch.
- **Verify the artifact, never the agent's report.** Read the actual diff and run the tests yourself before believing a subagent finished. Agents go idle without reporting, report work they never did, and report work they did do as "already present when I opened the file". A report is a claim; the diff is the evidence. This is the highest-value rule here: every real defect caught in delegated work has come from reading the diff, not the summary.
- **Keep briefs short.** State the file, the exact change, the constraint, and the verification command. Put the long diagnosis in the task list, not the prompt. Overlong briefs correlate strongly with an agent that never starts editing at all, which costs more wall-clock than a wrong edit because there is nothing to review.
- **Dispatch one agent per file, not one per finding.** Two agents editing the same file conflict, and serialising them turns work that looked parallel into a queue. Group every change a given file needs into a single dispatch, even when the changes are unrelated.
- **Scope a subagent's verification to the specs it touched; run the full suite once yourself before committing.** Every subagent running the entire suite multiplies wall-clock for no extra signal, and a subagent cannot distinguish its own failures from a concurrent agent's anyway.
