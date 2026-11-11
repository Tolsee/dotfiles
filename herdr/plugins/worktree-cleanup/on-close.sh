#!/bin/sh
# Herdr passes the event in HERDR_PLUGIN_EVENT_JSON. Only linked worktrees go to herdr-task;
# output lands in `herdr plugin log list --plugin dotfiles.worktree-cleanup`.
# Herdr runs it with its own environment: add the bin directories jq, git and gh live in, as
# the task plugin's run.sh does.
export PATH="$HOME/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
checkout=$(printf '%s' "${HERDR_PLUGIN_EVENT_JSON:-}" | jq -r '
    (.data // .) | .workspace.worktree // empty
    | select(.is_linked_worktree) | .checkout_path // empty' 2>/dev/null)
[ -n "$checkout" ] || exit 0
exec "$HOME/bin/herdr-task" prune-worktree "$checkout"
