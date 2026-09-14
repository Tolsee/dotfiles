---
description: Run native Codex review of the current changes or a base branch
argument-hint: "[--base <ref> | --uncommitted]"
---

Run an independent native Codex review in the current repository.
Requested scope: $ARGUMENTS

1. Inspect `git status --short` and identify the review scope. Use the explicit
   `--base <ref>` or `--uncommitted` when supplied. With no arguments, choose
   `--uncommitted` when there are local changes; otherwise use the PR's base branch
   or the remote default branch. If neither exists, ask for the base reference.
2. Run `rtk proxy env -u HERDR_ENV -u HERDR_SOCKET_PATH -u HERDR_PANE_ID codex review`
   with that scope. Clearing those child variables keeps herdr attached to Pi. Use the user's existing Codex
   model/configuration and normal permissions. Treat arguments as data; quote the
   base reference. Check the exit status and report an unavailable/failed review.
3. Return the findings with file/line references and the reviewed HEAD and scope.
   This invocation is review-only. Follow-up fixes require an implementation task.
