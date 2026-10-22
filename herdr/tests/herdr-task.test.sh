#!/usr/bin/env bash
# Tests for bin/herdr-task and bin/herdr-status against a fake herdr and gh (no server needed).
# Run: bash herdr/tests/herdr-task.test.sh
# Globals below come from the sourced herdr-task.
# shellcheck disable=SC2154,SC2034
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

check() { # check <name> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
        printf 'ok   %s\n' "$1"
    else
        printf 'FAIL %s\n  expected: %s\n  actual:   %s\n' "$1" "$2" "$3"
        failures=$((failures + 1))
    fi
}

# A task repo with an origin, on a branch with one commit past main.
git init -q --bare -b main "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/repo" 2>/dev/null
git -C "$tmp/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$tmp/repo" push -q origin main 2>/dev/null
git -C "$tmp/repo" remote set-head origin main
git -C "$tmp/repo" checkout -q -b abc-1-fix
git -C "$tmp/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "fix the thing"
echo change > "$tmp/repo/file.txt"
git -C "$tmp/repo" add file.txt
git -C "$tmp/repo" -c user.name=t -c user.email=t@t commit -q -m "add file"

# Fake herdr: logs every call, answers the few shapes herdr-task reads.
mkdir -p "$tmp/bin" "$tmp/home"
cat > "$tmp/bin/herdr" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_LOG"
case "$1 $2" in
    "status server") echo '{"running":true}' ;;
    "workspace list") echo '{"result":{"workspaces":[{"workspace_id":"w1","focused":true}]}}' ;;
    "workspace get") echo '{"result":{"workspace":{"tokens":{"linear_id":"ABC-1","linear_url":"https://linear.app/x/issue/ABC-1/fix"}}}}' ;;
    "pane get")
        [[ "$3" == w1:p9 ]] && exit 1
        echo "{\"result\":{\"pane\":{\"pane_id\":\"$3\",\"workspace_id\":\"w1\",\"cwd\":\"$FAKE_REPO\"}}}" ;;
    "pane list") echo '{"result":{"panes":[{"pane_id":"w1:p1","focused":true,"agent_status":"blocked"},{"pane_id":"w1:p2"}]}}' ;;
    "pane split")
        n=$(( $(cat "$FAKE_COUNTER" 2>/dev/null || echo 2) + 1 )); echo "$n" > "$FAKE_COUNTER"
        echo "{\"result\":{\"pane\":{\"pane_id\":\"w1:p$n\"}}}" ;;
    "agent get") [[ "$3" == "${FAKE_AGENT_PANE:-w1:p1}" ]] || exit 1; echo '{"result":{"agent":{}}}' ;;
    "agent prompt") [[ -n "${FAKE_BLOCKED:-}" ]] && { echo '{"error":{"code":"agent_blocked"}}' >&2; exit 1; }; echo '{}' ;;
    *) echo '{}' ;;
esac
EOF
chmod +x "$tmp/bin/herdr"
export FAKE_LOG="$tmp/herdr.log" FAKE_REPO="$tmp/repo" FAKE_COUNTER="$tmp/counter"
export HERDR_BIN_PATH="$tmp/bin/herdr" XDG_CACHE_HOME="$tmp/cache" HOME="$tmp/home"
export HERDR_PANE_ID=w1:p1 HERDR_WORKSPACE_ID=w1
task="$root/bin/herdr-task"

cat > "$tmp/bin/record-open" <<'EOF'
#!/bin/sh
printf '%s\n' "$1" >> "$FAKE_OPENED"
EOF
# fzf stub: records what it was offered, prints the --expect key line ($FAKE_FZF_KEY) and
# picks the first line matching $FAKE_FZF_PICK.
cat > "$tmp/bin/fzf" <<'EOF'
#!/bin/sh
printf '%s\n' "${FAKE_FZF_KEY:-}"
tee "$FAKE_FZF_IN" | grep -m1 -e "$FAKE_FZF_PICK"
EOF
chmod +x "$tmp/bin/record-open" "$tmp/bin/fzf"
export FAKE_OPENED="$tmp/opened" FAKE_FZF_IN="$tmp/fzf-in" PATH="$tmp/bin:$PATH"

# --- parsing (sourced) ---
# shellcheck disable=SC1090
HERDR_TASK_SOURCE_ONLY=1 source "$task"
set +e
parse_ticket "https://linear.app/acme/issue/ABC-12/fix-login?x=1"
check "linear link" "ABC-12 abc-12-fix-login" "$ticket_id $branch"

touch "$tmp/my file.ts"
parse_file_url "file://$tmp/my%20file.ts#L12"
check "file url #L" "$tmp/my file.ts 12" "$path $line"
parse_file_url "file://localhost$tmp/my%20file.ts:40:3"
check "file url host and :line:col" "$tmp/my file.ts 40" "$path $line"
parse_file_url "file://$tmp/my%20file.ts#L5-L9"
check "file url range" "5" "$line"
parse_file_url "file://$tmp/repo"
check "file url dir" "$tmp/repo " "$path $line"

project_roots=$tmp
git -C "$tmp/repo" remote set-url origin git@github.com:Tolsee/Dotfiles.git
check "repo for slug, case-insensitive" "$tmp/repo" "$(repo_for_slug tolsee/dotfiles)"
git -C "$tmp/repo" remote set-url origin "$tmp/origin.git"
HERDR_TASK_SUGGEST=https://linear.app/x/issue/ABC-9/y
check "suggestion prefers the clicked link" "$HERDR_TASK_SUGGEST" "$(clipboard_ticket)"
unset HERDR_TASK_SUGGEST
set -e
set +e

# --- review ---
: > "$FAKE_LOG"
bash "$task" review >/dev/null 2>&1
check "review exit" 0 $?
log=$(cat "$FAKE_LOG")
check "review splits right of the task pane" 1 "$(grep -c '^pane split w1:p1 --direction right' <<<"$log")"
check "review splits codex below claude" 1 "$(grep -c '^pane split w1:p3 --direction down' <<<"$log")"
check "review starts claude reviewer" 1 "$(grep -c '^agent start rv-claude-1 --kind claude --pane w1:p3' <<<"$log")"
check "review prompt names the ticket" 1 "$(grep -c '^agent prompt rv-claude-1 Review branch abc-1-fix.*linear.app/x/issue/ABC-1' <<<"$log")"
check "codex without codex-review falls back to an agent" 1 "$(grep -c '^agent start rv-codex-1 --kind codex --pane w1:p4' <<<"$log")"

: > "$FAKE_LOG"
out=$(bash "$task" review 2>&1)
check "second review does not stack splits" 0 "$(grep -c '^pane split' "$FAKE_LOG")"
check "second review says why" 1 "$(grep -c 'still open' <<<"$out")"

rm -rf "$XDG_CACHE_HOME/herdr-task/reviews"
mkdir -p "$HOME/.codex-review" && printf '#!/bin/sh\n' > "$HOME/.codex-review/codex-review" && chmod +x "$HOME/.codex-review/codex-review"
: > "$FAKE_LOG"
bash "$task" review --with codex >/dev/null 2>&1
check "codex-review runs in the pane" 1 "$(grep -c '^pane run w1:p5 ~/.codex-review/codex-review --wait --base origin/main --scope branch' "$FAKE_LOG")"

git -C "$tmp/repo" checkout -q main
out=$(bash "$task" review 2>&1)
check "review refuses the base branch" 1 "$(grep -c 'run this from a task branch' <<<"$out")"
git -C "$tmp/repo" checkout -q abc-1-fix

# --- ship ---
: > "$FAKE_LOG"
bash "$task" ship >/dev/null 2>&1
check "ship prompts the task agent" 1 "$(grep -c '^agent prompt w1:p1 Ship this task now' "$FAKE_LOG")"
out=$(FAKE_BLOCKED=1 bash "$task" ship 2>&1)
check "ship on a blocked agent" 1 "$(grep -c 'waiting for you' <<<"$out")"
: > "$FAKE_LOG"
FAKE_AGENT_PANE=w1:p4 bash "$task" ship >/dev/null 2>&1
check "ship skips reviewer agents" 0 "$(grep -c '^agent prompt' "$FAKE_LOG")"

# --- open-file ---
: > "$FAKE_LOG"
bash "$task" open-file "file://$tmp/my%20file.ts#L7" >/dev/null 2>&1
check "open-file splits focused" 1 "$(grep -c "^pane split w1:p1 --direction right --cwd $tmp --focus" "$FAKE_LOG")"
check "open-file runs the editor at the line" 1 "$(grep -c "^pane run .* exec \${EDITOR:-nvim} +7 .*my\\\\ file.ts" "$FAKE_LOG")"
out=$(bash "$task" open-file "file:///nope/missing.ts" 2>&1)
check "open-file on a missing file" 1 "$(grep -c 'no such file' <<<"$out")"

# --- status line ---
printf '#!/bin/sh\necho %s\n' "'{\"number\":7,\"state\":\"OPEN\",\"isDraft\":true,\"reviewDecision\":\"APPROVED\",\"statusCheckRollup\":[{\"conclusion\":\"FAILURE\"}]}'" > "$tmp/home/gh"
mkdir -p "$HOME/bin" && mv "$tmp/home/gh" "$HOME/bin/gh" && chmod +x "$HOME/bin/gh"
expected="$(printf '\357\220\241') 1 blocked · $(printf '\357\223\235') #7 · $(printf '\357\222\236') approved · $(printf '\357\221\247') CI"
check "status line (octicons)" "$expected" "$(bash "$root/bin/herdr-status")"

# --- open: one picker for ticket, PR, files, checks, failing checks, branch ---
cat > "$tmp/bin/gh" <<'EOF'
#!/bin/sh
echo '{"number":7,"url":"https://github.com/o/r/pull/7","title":"Fix login","statusCheckRollup":[{"name":"build","conclusion":"FAILURE","detailsUrl":"https://ci.example/build/1"},{"name":"lint","conclusion":"SUCCESS","detailsUrl":"https://ci.example/lint/1"}]}'
EOF
chmod +x "$tmp/bin/gh"
git -C "$tmp/repo" remote set-url origin git@github.com:o/r.git
: > "$tmp/opened"
FAKE_FZF_PICK="failing: build" HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open w1:p1 >/dev/null 2>&1
check "open: failing check opens its own page" "https://ci.example/build/1" "$(cat "$tmp/opened")"
offered=$(cut -f2 "$tmp/fzf-in" | tr '\n' ' ')
check "open: every link, ticket first, deduped" \
    "https://linear.app/x/issue/ABC-1/fix https://github.com/o/r/pull/7 https://github.com/o/r/pull/7/files https://github.com/o/r/pull/7/checks https://ci.example/build/1 https://github.com/o/r/tree/abc-1-fix " \
    "$offered"
printf '#!/bin/sh\nexit 1\n' > "$tmp/bin/gh"
: > "$tmp/opened"
FAKE_FZF_PICK=compare HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open w1:p1 >/dev/null 2>&1
check "open: compare view before a PR" "https://github.com/o/r/compare/main...abc-1-fix" "$(cat "$tmp/opened")"
git -C "$tmp/repo" remote set-url origin "$tmp/origin.git"

printf '\n%d failure(s)\n' "$failures"
[[ $failures -eq 0 ]]
