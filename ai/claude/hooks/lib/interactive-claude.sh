# shellcheck shell=bash
# Sourced by the Rex hooks. headless_claude: true when the Claude that runs this hook is a
# headless `claude -p` (a helper, or one run by another agent in the pane), which inherits the
# pane's REX_BLOCK but must leave the pane's state alone. Walks up to the claude process and
# reads its arguments.
headless_claude() {
    local pid=$PPID _
    for _ in 1 2 3 4 5 6; do
        [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null || return 1
        if [ "$(ps -o comm= -p "$pid" 2>/dev/null | sed 's#.*/##')" = claude ]; then
            case " $(ps -o args= -p "$pid" 2>/dev/null) " in
                *" -p "*|*" --print "*|*" --print="*) return 0 ;;
            esac
            return 1
        fi
        pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    done
    return 1
}
