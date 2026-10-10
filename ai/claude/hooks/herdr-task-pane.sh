#!/bin/sh
# Claude Code SessionStart hook, for sessions running inside Herdr.
# - Labels the agent row with the Claude glyph (nf-cod-claude).
# - Inside a task workspace (created by ~/bin/herdr-task), copies the workspace's ticket tokens
#   onto this pane so the agent row shows the ticket for any Claude started here, by hand or not,
#   and sets hs_title (the sidebar plugin's label override) to the ticket title.
[ "${HERDR_ENV:-}" = "1" ] || exit 0
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
command -v herdr >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0
cat >/dev/null 2>&1 # hook input is not needed

tokens=""
if [ -n "${HERDR_WORKSPACE_ID:-}" ]; then
    tokens=$(herdr workspace get "$HERDR_WORKSPACE_ID" 2>/dev/null \
        | jq -r '.result.workspace.tokens // {}
            | (to_entries[] | select(.key | startswith("linear")) | "--token\n\(.key)=\(.value)"),
              (select(.linear_title != null and .linear_title != "") | "--token\nhs_title=\(.linear_title)")' 2>/dev/null)
fi
printf '%s\n' "$tokens" | grep -v '^$' | tr '\n' '\0' \
    | xargs -0 herdr pane report-metadata "$HERDR_PANE_ID" --source herdr-task \
        --display-agent "$(printf '\356\262\202') claude" >/dev/null 2>&1
exit 0
