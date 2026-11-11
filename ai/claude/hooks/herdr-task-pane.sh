#!/bin/sh
# Claude Code SessionStart hook, for sessions running inside Herdr.
# - Labels the agent row with the Claude glyph (nf-cod-claude).
# - Inside a task workspace (created by ~/bin/herdr-task), copies the workspace's ticket tokens
#   onto this pane so the agent row shows the ticket for any Claude started here, by hand or not.
[ "${HERDR_ENV:-}" = "1" ] || exit 0
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
command -v herdr >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0
cat >/dev/null 2>&1 # hook input is not needed

# Arguments built here rather than through xargs: BSD xargs runs nothing on empty input, so
# outside a task the glyph would never be set on a Mac.
set -- --display-agent "$(printf '\356\262\202') claude"
if [ -n "${HERDR_WORKSPACE_ID:-}" ]; then
    tokens=$(herdr workspace get "$HERDR_WORKSPACE_ID" 2>/dev/null \
        | jq -r '.result.workspace.tokens // {} | to_entries[] | select(.key | startswith("linear"))
                 | "\(.key)=\(.value | tostring | gsub("\n"; " "))"' 2>/dev/null)
    while IFS= read -r kv; do
        [ -n "$kv" ] && set -- "$@" --token "$kv"
    done <<EOF
$tokens
EOF
fi
herdr pane report-metadata "$HERDR_PANE_ID" --source herdr-task "$@" >/dev/null 2>&1
exit 0
