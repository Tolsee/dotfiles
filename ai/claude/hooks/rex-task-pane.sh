#!/usr/bin/env bash
# Claude Code SessionStart and SessionEnd hook, for sessions running inside Rex: the Rex
# counterpart of herdr-task-pane.sh. Labels the pane after its task so the sidebar's pane list
# shows it for any Claude started here, by rex-task or by hand:
# - SessionStart: "claude · ABC-123 title" from the branch's ticket (saved by rex-task or
#   herdr-task as git config branch.<b>.linear-*, or an id at the start of the branch name),
#   else "claude · <branch>", else "claude". With a ticket, the tab is named "ABC-123 title"
#   too, unless you named the tab yourself.
# - SessionEnd: the pane goes back to "shell" if it still has the label set here.
[ -n "${REX_BLOCK:-}" ] && [ -n "${REX_SESSION:-}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)

# shellcheck source=lib/interactive-claude.sh
. "$(dirname "$(readlink -f "$0")")/lib/interactive-claude.sh"
! headless_claude || exit 0

rex_bin=$(command -v rex || true)
mac_rex="$HOME/Library/Application Support/com.superlogical.rex/RexServer/Versions/Current/Rex Server.app/Contents/MacOS/rex"
[ -n "$rex_bin" ] || [ ! -x "$mac_rex" ] || rex_bin=$mac_rex
[ -n "$rex_bin" ] || exit 0

label_now() {
    "$rex_bin" block ls -s "$REX_SESSION" --json 2>/dev/null \
        | jq -r --arg b "$REX_BLOCK" '.blocks[] | select(.block_id == $b) | .label // empty'
}

case "$(jq -r '.hook_event_name // empty' <<<"$input")" in
    SessionStart)
        dir=$(jq -r '.cwd // empty' <<<"$input")
        dir=${dir:-$PWD}
        label=claude
        branch=$(git -C "$dir" symbolic-ref --short -q HEAD 2>/dev/null || true)
        if [ -n "$branch" ]; then
            id=$(git -C "$dir" config --get "branch.$branch.linear-id" 2>/dev/null || true)
            title=$(git -C "$dir" config --get "branch.$branch.linear-title" 2>/dev/null || true)
            if [ -z "$id" ] && [[ "${branch##*/}" =~ ^([A-Za-z][A-Za-z0-9]*)-([0-9]+)(-|$) ]]; then
                id="$(printf '%s' "${BASH_REMATCH[1]}" | tr '[:lower:]' '[:upper:]')-${BASH_REMATCH[2]}"
            fi
            base=$(git -C "$dir" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
            # No saved title: the branch's slug after the id, as rex-task names sessions.
            if [ -n "$id" ] && [ -z "$title" ]; then
                rest=${branch##*/}
                rest=${rest:${#id}}
                rest=${rest#-}
                title=${rest//-/ }
            fi
            if [ -n "$id" ]; then
                label="claude · $id${title:+ $title}"
            elif [ "$branch" != "${base:-main}" ]; then
                label="claude · $branch"
            fi
        fi
        "$rex_bin" block rename -s "$REX_SESSION" "$REX_BLOCK" "${label:0:128}" >/dev/null 2>&1
        # The tab bar shows the ticket without hovering. Only a tab still on Rex's default name
        # ("Window 1a2b3c4d") or on a ticket name from here is renamed, never one you named.
        if [ -n "${id:-}" ]; then
            window=$("$rex_bin" block ls -s "$REX_SESSION" --json 2>/dev/null \
                | jq -r --arg b "$REX_BLOCK" '.blocks[] | select(.block_id == $b) | .window_id // empty')
            tab=$("$rex_bin" window ls -s "$REX_SESSION" --json 2>/dev/null \
                | jq -r --arg w "$window" '.windows[] | select(.window_id == $w) | .label // empty')
            if [ -n "$window" ] && [[ "$tab" =~ ^Window\ [0-9a-f]{8}$ || "$tab" =~ ^[A-Z][A-Z0-9]*-[0-9]+(\ |$) ]]; then
                tab_label="$id${title:+ $title}"
                "$rex_bin" window rename -s "$REX_SESSION" "$window" "${tab_label:0:128}" >/dev/null 2>&1
            fi
        fi
        ;;
    SessionEnd)
        case "$(label_now)" in
            claude|"claude · "*) "$rex_bin" block rename -s "$REX_SESSION" "$REX_BLOCK" shell >/dev/null 2>&1 ;;
        esac
        ;;
esac
exit 0
