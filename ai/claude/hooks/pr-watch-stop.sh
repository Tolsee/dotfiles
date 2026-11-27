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
# A watcher is a tool call that starts one (the babysit skills, a wakeup, a monitor, gh's own
# watch) or the user's typed slash command, never a mention of one. grep narrows the lines first.
if grep -E 'babysit-pr|steward|ship|ScheduleWakeup|Monitor|CronCreate|--watch|gh event listen' "$transcript" 2>/dev/null | jq -s -e '
    def tools: (.message.content? // []) | if type == "array" then . else [] end;
    def text: (.message.content? // "") | if type == "string" then . else "" end;
    any(.[];
        (tools | any(.[]; .type == "tool_use" and (
            (.name | IN("ScheduleWakeup", "Monitor", "CronCreate"))
            or (.name == "Skill" and ((.input.skill // "") | test("babysit-pr|steward|ship")))
            or (.name == "Bash" and ((.input.command // "") | test("gh pr checks.*--watch|gh event listen"))))))
        or (text | test("<command-name>/?(babysit-pr|steward|ship)")))' >/dev/null 2>&1; then
    exit 0
fi
pr=$("$HOME/bin/herdr-task" pr --cwd "$cwd" --max-age -1 2>/dev/null) || exit 0
[ "$(printf '%s' "$pr" | jq -r '.state // empty' 2>/dev/null)" = OPEN ] || exit 0
num=$(printf '%s' "$pr" | jq -r '.number')
: > "$marker"
printf '{"decision":"block","reason":"PR #%s is open and nothing is watching it. Start /babysit-pr on it (CI, review threads, keep it rebased) before you stop."}\n' "$num"
exit 0
