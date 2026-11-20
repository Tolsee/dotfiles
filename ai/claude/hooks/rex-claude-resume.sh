#!/usr/bin/env bash
# Claude Code SessionStart and SessionEnd hook, for sessions running inside Rex.
# Remembers which conversation each Rex pane ($REX_BLOCK) holds, so a pane that Rex restores
# after an update or crash can resume it (see the rex-claude-resume block in .zshrc).
# - SessionStart: records "<session_id>\t<cwd>" for this pane (a /resume or /clear rewrites it).
# - SessionEnd on a deliberate quit (/exit, Ctrl+D, logout): forgets it, so the pane comes back
#   as a plain shell. Any other end (Rex killed the pane, a crash) keeps it for the restore.
# State: ${REX_CLAUDE_STATE:-~/.local/state/rex-claude}/<block uuid>.
[ -n "${REX_BLOCK:-}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)

state=${REX_CLAUDE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/rex-claude}
file="$state/${REX_BLOCK#block:}"
event=$(jq -r '.hook_event_name // empty' <<<"$input")
id=$(jq -r '.session_id // empty' <<<"$input")
[ -n "$id" ] || exit 0

case "$event" in
    SessionStart)
        cwd=$(jq -r '.cwd // empty' <<<"$input")
        mkdir -p "$state"
        printf '%s\t%s\n' "$id" "${cwd:-$PWD}" > "$file.tmp" && mv -f "$file.tmp" "$file"
        # Panes closed while Claude ran leave a file behind; drop the month-old ones.
        find "$state" -type f -mtime +30 -delete 2>/dev/null
        ;;
    SessionEnd)
        case "$(jq -r '.reason // empty' <<<"$input")" in
            prompt_input_exit|logout)
                # Only this conversation's record: another may have replaced it since.
                [ "$(cut -f1 "$file" 2>/dev/null)" = "$id" ] && rm -f "$file"
                ;;
        esac
        ;;
esac
exit 0
