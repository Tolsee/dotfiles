---
name: delegate
description: Strict delegation for the current task. Routing is already automatic (Model routing in ~/.claude/CLAUDE.md); /delegate removes the do-it-directly exception, so every edit goes to an implementer subagent and the main session only specs, reads diffs and runs tests. Human-invoked only.
disable-model-invocation: true
---

# Delegate strictly

Model routing in `~/.claude/CLAUDE.md` already applies to every task. For this task, tighten it:

- **No direct edits.** Every file change goes to `mechanical-editor` (exact change known) or `feature-implementer` (approach decided), even a one-liner. The main session writes the spec, reads the diff and runs the tests.
- **No direct lookups past one file.** Searches go to `Explore`, bulky output to `fetcher`, web and docs to `researcher`, Chrome to `browser`.
- **Spec before dispatch.** Decide the structure first and hand down a spelled-out change: the file, the exact change, the constraint, the verification command. "This spans several files" or "this looks intricate" is not a reason to tag `[opus]`.
- **Lessons that still hold:** agents go idle without reporting, report work they never did, and report work they did as "already present". Every real defect caught in delegated work came from reading the diff, not the summary. Overlong briefs correlate with an agent that never starts editing.
