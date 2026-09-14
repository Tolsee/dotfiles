---
description: Delegate a bounded task to the installed Claude Code CLI
argument-hint: "<task>"
---

For an authorized task that needs native Claude capabilities, initiate the
handoff directly; the user need not type this slash command.

Delegate this task to native Claude Code in the current repository:
$ARGUMENTS

1. Confirm the requested task and working directory. If no task was supplied,
   ask for it. Preserve read-only, file-scope, and verification constraints in the
   handoff. Give Claude the necessary context and acceptance criteria explicitly;
   it does not inherit this Pi conversation.
2. Write the task to a temporary prompt file using a quoted heredoc, then invoke
   `rtk proxy env -u HERDR_ENV -u HERDR_SOCKET_PATH -u HERDR_PANE_ID claude -p --output-format json < <prompt-file>`.
   Clearing those child variables keeps herdr attached to Pi. Use Claude's existing
   model, plugins, and permissions. Run one bounded child task and wait for it;
   keep other writers out of its files. If it cannot proceed without interactive
   approval, hand off to an interactive Claude pane rather than bypass permissions.
3. Inspect the exit status and JSON result. Report errors or incomplete work.
   For implementation work, inspect the actual diff and run the relevant checks
   before accepting the result; use native Codex review before publishing.
