@~/dev/dotfiles/ai/agents/AGENTS.md

## Model routing

Main session only; a subagent ignores this section, does its own task and reports. This is automatic: it applies without `/delegate`.

The main session keeps the decisions: diagnosis, the exact change, reading diffs, the one full test run, commit, Codex review, push, PR text. Every other kind of work goes to the cheapest row below. The jev-model-router mod sets each spawn's model from its agent type, so leave `model` unset unless a row says otherwise.

| Work | Agent | Model |
| --- | --- | --- |
| Repo search: where or how X works, call sites, config, tests, checking a claim against code | `Explore` | haiku; pass `model: sonnet` when the answer needs design judgment |
| CI and Buildkite logs, Datadog, gh comment dumps, Linear lists, any large CLI or API output | `fetcher` | haiku |
| Docs, changelogs, GitHub issues, plugin or example repos, comparing tools | `researcher` | sonnet |
| Anything in Chrome. The main session never drives Chrome | `browser` | sonnet |
| Well-specified edit, rename, boilerplate, an already-diagnosed fix | `mechanical-editor` | haiku |
| Feature, bug fix or refactor whose approach is decided, spelled out file by file | `feature-implementer` | sonnet |
| Delegated work that fits no row | `general-purpose` | Jev picks haiku or sonnet |
| Waiting on CI, a deploy, a merge or a metric | background Bash watcher printing one line when it flips | no agent |

- Do it directly instead when it is one known file or one command, or an edit of about 15 lines or less in files already read and fully decided.
- Opus for a subagent only when the task needs it: start the description with `[opus]`.
- A brief states the exact question or change, the answer shape with a length cap, and a stop condition. Long diagnosis goes in the task list, not the brief.
- One agent per question, one implementer per file (group every change a file needs into one dispatch). Never re-dispatch a failed or empty agent: do that lookup yourself.
- Verify delegated edits by reading the diff and running the tests yourself, never by the agent's report. Implementers run only the specs they touched; run the full suite once before committing.

## Memory

Do not save project-status snapshots as memories (open TODOs, review rounds, handoffs, dated research, "current state of X"): git, PRs, and Linear are the record for those. Save only durable constraints, gotchas, preferences, and reference facts.

<!-- CODEGRAPH_START -->
## CodeGraph

CodeGraph builds a semantic knowledge graph of codebases for faster, smarter code exploration.

### If `.codegraph/` exists in the project

**NEVER call `codegraph_explore` or `codegraph_context` directly in the main session.** These tools return large amounts of source code that fills up main session context. Instead, ALWAYS spawn an Explore agent for any exploration question (e.g., "how does X work?", "explain the Y system", "where is Z implemented?").

**When spawning Explore agents**, include this instruction in the prompt:

> This project has CodeGraph initialized (.codegraph/ exists). Use `codegraph_explore` as your PRIMARY tool — it returns full source code sections from all relevant files in one call.
>
> **Rules:**
> 1. Follow the explore call budget in the `codegraph_explore` tool description — it scales automatically based on project size.
> 2. Do NOT re-read files that codegraph_explore already returned source code for. The source sections are complete and authoritative.
> 3. Only fall back to grep/glob/read for files listed under "Additional relevant files" if you need more detail, or if codegraph returned no results.

**The main session may only use these lightweight tools directly** (for targeted lookups before making edits, not for exploration):

| Tool | Use For |
|------|---------|
| `codegraph_search` | Find symbols by name |
| `codegraph_callers` / `codegraph_callees` | Trace call flow |
| `codegraph_impact` | Check what's affected before editing |
| `codegraph_node` | Get a single symbol's details |

### If `.codegraph/` does NOT exist

At the start of a session, ask the user if they'd like to initialize CodeGraph:

"I notice this project doesn't have CodeGraph initialized. Would you like me to run `codegraph init -i` to build a code knowledge graph?"
<!-- CODEGRAPH_END -->

@RTK.md
