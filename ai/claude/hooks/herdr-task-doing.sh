#!/bin/sh
# Claude Code UserPromptSubmit hook, for task folders in Herdr (TUI or app): asks the agent to
# keep the sidebar's "doing now" line (`herdr-task doing`) current when a prompt changes the
# work. Silent outside Herdr, off a branch, or on the main branch.
cat >/dev/null 2>&1 # hook input is not needed
[ "${HERDR_ENV:-}" = "1" ] || [ -n "${HC_TERMINAL_ID:-}" ] || exit 0
[ -x "$HOME/bin/herdr-task" ] || exit 0
b=$(git symbolic-ref --short -q HEAD 2>/dev/null) || exit 0
case "$b" in main | master) exit 0 ;; esac
now=$(git config --get "branch.$b.herdr-doing" 2>/dev/null)
printf 'Herdr sidebar line for this task: "%s". If this prompt changes what you are working on, update it first with: herdr-task doing "<4 to 6 words>". Otherwise leave it.\n' "${now:-unset}"
exit 0
