---
name: delegate
description: Route work off the main session by task type. Code edits go to tiered implementer subagents (mechanical-editor / feature-implementer), browser automation to sonnet general-purpose agents, bulky fetches (CI logs, Datadog, Buildkite) to haiku or sonnet general-purpose agents, waits to background watchers. Human-invoked only, never auto-invoke.
disable-model-invocation: true
---

# Delegate edits to implementer subagents

For this task, delegate the actual code edits (Edit/Write/file changes) to subagents — the main session handles research, planning, review, and orchestration. Implementer subagents cannot spawn further subagents — their tool lists exclude the Agent tool — so a dispatched subagent makes its assigned edits itself.

**Small-edit exception:** if a change is small (roughly ≤15 lines across 1–2 files already read into context) and fully decided, make it directly — a subagent re-reading context costs more tokens than the edit itself.

## Rules

- **Default to the mid-tier model for implementation.** The top-tier main session does the *logical* work — diagnosis, deciding the exact change, verifying the result — and hands the *implementation* down. A top-tier subagent re-derives reasoning the main session already did, so it costs far more for the same diff. Tiers: mechanical/well-specified edits, bulk renames, an already-diagnosed one-liner → `mechanical-editor` (haiku); everything else, including multi-file feature work, bug fixes and refactors → `feature-implementer` (sonnet, default). Agents defined in `~/.claude/agents/` (symlinked from `dotfiles/ai/claude/agents/`). Don't override `model` ad hoc; add a new tiered agent file instead if a gap shows up. There is no top-tier implementer: the main session decides the structure first, then hands a spelled-out change to the mid-tier. "This spans several files" or "this looks intricate" is not a reason to escalate. The same logic applies to non-edit subagents; see the routing table below, and batch independent lookups into one dispatch.
- **Verify the artifact, never the agent's report.** Read the actual diff and run the tests yourself before believing a subagent finished. Agents go idle without reporting, report work they never did, and report work they did do as "already present when I opened the file". A report is a claim; the diff is the evidence. This is the highest-value rule here: every real defect caught in delegated work has come from reading the diff, not the summary.
- **Keep briefs short.** State the file, the exact change, the constraint, and the verification command. Put the long diagnosis in the task list, not the prompt. Overlong briefs correlate strongly with an agent that never starts editing at all, which costs more wall-clock than a wrong edit because there is nothing to review.
- **Dispatch one agent per file, not one per finding.** Two agents editing the same file conflict, and serialising them turns work that looked parallel into a queue. Group every change a given file needs into a single dispatch, even when the changes are unrelated.
- **Scope a subagent's verification to the specs it touched; run the full suite once yourself before committing.** Every subagent running the entire suite multiplies wall-clock for no extra signal, and a subagent cannot distinguish its own failures from a concurrent agent's anyway.

## Routing table: everything that is not a decision leaves the main session

The main session is the most expensive context in the system. It keeps the decisions (what to change, whether a diff is right, whether tests prove it, what to tell the user) and hands every other kind of work down. Pick the cheapest row that fits.

| Work | Route | Model |
| --- | --- | --- |
| Diagnosis, exact-change specs, reading the diff, the one full test run, commit, Codex review, push, PR text | main session | top tier |
| Well-specified edits, renames, already-diagnosed one-liners | `mechanical-editor` | haiku |
| Feature, bug fix or refactor with the approach decided | `feature-implementer` | sonnet |
| Browser automation: Buildkite unblock dialogs, Chrome end-to-end checks on live pages, clicking through a dashboard, any screenshot-driven loop | `general-purpose` with the Chrome MCP tools | sonnet, always. Haiku wanders and every extra tool call is a permission prompt for the user (2026-09-10) |
| Bulky fetches: CI logs, Buildkite failure summaries, Datadog spans, DBM samples, log queries, long `gh` comment dumps | `general-purpose` | haiku |
| Repo recon, call-site sweeps, verifying a claim against code | `Explore` | sonnet, haiku for a single grep sweep |
| Waiting on CI, a deploy, a merge, a metric to settle | background Bash watcher that prints one line when the condition flips | no agent |

**The main session never drives Chrome, and browser agents are sonnet.** A screenshot is a full image in top-tier context, but haiku takes many exploratory calls to land a click and each Chrome call is a permission prompt, so sonnet is cheaper for the user. Tell the agent to minimise tool calls: plan the sequence, one ToolSearch, one navigate, one find, one click, one verification. Brief the browser agent with: the start URL, the exact sequence, the success signal to look for, what to return (one line plus a saved screenshot path when the user should see it), and the standing limits (read-only, no logins, no form submissions, never type credentials, call `tabs_context_mcp` first, create its own tab, close it when done). If the click path is unknown, the first agent's job is to discover and report it, not to finish the task.

**Fetchers return tables, not transcripts.** Ask for the compact shape you will act on (top-N table, one bullet per failing test with its message, a yes/no with the evidence line). Cap the report length in the brief. One fetcher per question; do not spawn a second one for the same data while the first runs, and do not repeat the fetch yourself after delegating it.
