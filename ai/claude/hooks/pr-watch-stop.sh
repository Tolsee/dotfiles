#!/bin/sh
# Claude Code Stop hook: a session that opened a PR still open, with nothing watching it, is
# blocked once and asked to babysit it. Reads herdr-task's PR cache (no gh, no model); silent on
# any doubt, and once per session.
input=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ -x "$HOME/bin/herdr-task" ] || exit 0
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = true ] && exit 0
sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$sid" ] && [ -f "$transcript" ] && [ -d "$cwd" ] || exit 0
marker="${TMPDIR:-/tmp}/pr-watch-$sid"
[ -e "$marker" ] && exit 0
grep -q 'gh pr create' "$transcript" || exit 0
grep -qE 'babysit-pr|steward|ship-local|gh pr checks[^"]*--watch|gh event listen|ScheduleWakeup' "$transcript" && exit 0
pr=$("$HOME/bin/herdr-task" pr --cwd "$cwd" --max-age -1 2>/dev/null) || exit 0
[ "$(printf '%s' "$pr" | jq -r '.state // empty' 2>/dev/null)" = OPEN ] || exit 0
num=$(printf '%s' "$pr" | jq -r '.number')
: > "$marker"
printf '{"decision":"block","reason":"PR #%s is open and nothing is watching it. Start /babysit-pr on it (CI, review threads, keep it rebased) before you stop."}\n' "$num"
exit 0
