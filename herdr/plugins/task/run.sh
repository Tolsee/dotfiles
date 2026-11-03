#!/bin/sh
# Entry point for every dotfiles.task action and hook. Herdr runs plugin commands from the
# plugin directory with its own environment, so add the usual bin directories and load the
# private shell config (HERDR_TASK_PROJECT_ROOTS) the way the herdr-task popups do, then hand
# over to ~/bin/herdr-task. Output: `herdr plugin log list --plugin dotfiles.task`.
export PATH="$HOME/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cmd=${1:?command}
shift
case $cmd in
    review | ship) set -- "$cmd" "$@" ;;
    open-file) set -- open-file "${HERDR_PLUGIN_CLICKED_URL:?no clicked link}" ;;
    open-ticket) set -- open-ticket "${HERDR_PLUGIN_CLICKED_URL:?no clicked link}" ;;
    retag)
        if [ "${HERDR_PLUGIN_EVENT:-startup}" = startup ]; then
            set -- retag --startup
        else
            # Events name their workspace, or a pane whose id starts with it (w1:p2).
            ws=$(printf '%s' "${HERDR_PLUGIN_EVENT_JSON:-}" | jq -r '
                (.data // .) | .workspace.workspace_id // .workspace_id
                // ((.pane_id // .pane.pane_id // "") | split(":")[0] | select(. != ""))
                // empty' 2>/dev/null)
            [ -n "$ws" ] || exit 0
            set -- retag --workspace "$ws"
        fi
        ;;
    *) printf 'dotfiles.task: unknown command %s\n' "$cmd" >&2; exit 2 ;;
esac
exec zsh -c 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"' herdr-task "$@"
