#!/bin/sh
# Entry point for every dotfiles.task action and pane. Herdr runs plugin commands from the
# plugin directory with its own environment, so add the usual bin directories and load the
# private shell config (HERDR_TASK_PROJECT_ROOTS) the way the herdr-task popups do, then hand
# over to ~/bin/herdr-task. Output: `herdr plugin log list --plugin dotfiles.task`.
export PATH="$HOME/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cmd=${1:?command}
shift
case $cmd in
    review | ship) set -- "$cmd" "$@" ;;
    open-file) set -- open-file "${HERDR_PLUGIN_CLICKED_URL:?no clicked link}" ;;
    start-link)
        # The start popup, prefilled with the link, so the project picker still runs.
        exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-dotfiles.task}" \
            --entrypoint start --placement popup --width 80% --height 80% \
            --env "HERDR_TASK_SUGGEST=${HERDR_PLUGIN_CLICKED_URL:-}"
        ;;
    start) set -- ;;
    *) printf 'dotfiles.task: unknown command %s\n' "$cmd" >&2; exit 2 ;;
esac
exec zsh -c 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"' herdr-task "$@"
