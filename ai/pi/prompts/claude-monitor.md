---
description: Start and verify a native Claude background monitoring session
argument-hint: "<target, checks, and stop condition>"
---

Monitor this authorized task through native Claude Code:
$ARGUMENTS

1. Identify the repository, exact deployment or PR, expected checks, read-only or
   permitted remediation scope, and terminal success/failure condition. Use the
   conversation context; ask only for required information that is missing.
2. Check `claude --help` for `--bg` and `claude agents --help` for status commands.
   Write a self-contained task to a temporary prompt file using a quoted heredoc.
   Tell Claude to use its available monitoring workflow, report an initial
   observation, continue until the stop condition, and report permission or
   authentication blockers. Preserve the parent's constraints and approvals.
3. Read that file into a quoted shell variable and launch in the repository:
   ```bash
   task=$(cat "$prompt_file")
   rtk proxy env -u HERDR_ENV -u HERDR_SOCKET_PATH -u HERDR_PANE_ID claude --bg -- "$task"
   ```
   Use existing Claude configuration and permissions. Capture the returned
   session ID. Do not bypass approvals or claim the launch succeeded on a
   nonzero exit. Remove the temporary prompt file after launch.
4. Inspect `claude agents --json` and `claude logs <id>`. Confirm the child observed the
   intended target successfully before reporting that monitoring is active.
   If it needs interaction, give `claude attach <id>` and state the blocker.
   Return the ID, observed state, and `claude logs <id>` / `claude attach <id>`.
5. Results remain in Claude; retrieve logs when checking progress. Do not promise
   an automatic callback into Pi. Use `claude stop <id>` to cancel only this task's
   session when requested or after its terminal result. If background commands
   are unavailable, give an interactive Claude handoff with the concrete task.
