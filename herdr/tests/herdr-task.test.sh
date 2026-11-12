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
    "workspace list")
        if [[ -n "${FAKE_WORKSPACES:-}" ]]; then echo "$FAKE_WORKSPACES"
        else echo '{"result":{"workspaces":[{"workspace_id":"w1","focused":true}]}}'; fi ;;
    "workspace get") echo '{"result":{"workspace":{"tokens":{"linear_id":"ABC-1","linear_url":"https://linear.app/x/issue/ABC-1/fix"}}}}' ;;
    "pane get")
        [[ "$3" == w1:p9 ]] && exit 1
        echo "{\"result\":{\"pane\":{\"pane_id\":\"$3\",\"workspace_id\":\"w1\",\"cwd\":\"$FAKE_REPO\"}}}" ;;
    "pane list")
        if [[ -z "${FAKE_PANES:-}" ]]; then
            echo '{"result":{"panes":[{"pane_id":"w1:p1","focused":true,"agent_status":"blocked"},{"pane_id":"w1:p2"}]}}'
        elif [[ "${3:-}" == --workspace ]]; then
            jq -c --arg w "$4:" '.result.panes |= map(select(.pane_id | startswith($w)))' <<<"$FAKE_PANES"
        else
            echo "$FAKE_PANES"
        fi ;;
    "worktree list") echo '{"result":{"worktrees":[]}}' ;;
    "worktree create" | "worktree open")
        echo "{\"result\":{\"workspace\":{\"workspace_id\":\"w8\"},\"worktree\":{\"path\":\"$FAKE_WT\"},\"root_pane\":{\"pane_id\":\"w8:p1\"},\"already_open\":${FAKE_ALREADY_OPEN:-false}}}" ;;
    "agent list")
        if [[ -n "${FAKE_AGENTS:-}" ]]; then echo "$FAKE_AGENTS"; else echo '{"result":{"agents":[]}}'; fi ;;
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
# picks the first line matching $FAKE_FZF_PICK. Like fzf, a start:reload-sync(cmd) replaces
# the input (first offered rows: $FAKE_FZF_IN.first).
cat > "$tmp/bin/fzf" <<'EOF'
#!/bin/sh
reload=""
for a in "$@"; do
    case $a in "start:reload-sync("*) reload=${a#start:reload-sync(}; reload=${reload%)} ;; esac
done
printf '%s\n' "${FAKE_FZF_KEY:-}"
if [ -n "$reload" ]; then
    cat > "$FAKE_FZF_IN.first"
    sh -c "$reload" | tee "$FAKE_FZF_IN" | grep -m1 -e "$FAKE_FZF_PICK"
else
    tee "$FAKE_FZF_IN" | grep -m1 -e "$FAKE_FZF_PICK"
fi
EOF
chmod +x "$tmp/bin/record-open" "$tmp/bin/fzf"
export FAKE_OPENED="$tmp/opened" FAKE_FZF_IN="$tmp/fzf-in" PATH="$tmp/bin:$PATH"

# --- parsing (sourced) ---
# shellcheck disable=SC1090
HERDR_TASK_SOURCE_ONLY=1 source "$task"
set +e
parse_ticket "https://linear.app/acme/issue/ABC-12/fix-login?x=1"
check "linear link" "ABC-12 abc-12-fix-login" "$ticket_id $branch"
check "cut_text counts characters, not bytes" "Fix é" "$(LC_ALL=C cut_text 5 "Fix éclair")"
parse_ticket "fix flaky test"
check "parse_ticket: free text is a task" "task fix-flaky-test" "$ref_kind $branch"
parse_ticket feat/x
check "parse_ticket: a branch name is a branch" "branch" "$ref_kind"

touch "$tmp/my file.ts"
parse_file_url "file://$tmp/my%20file.ts#L12"
check "file url #L" "$tmp/my file.ts 12" "$path $line"
parse_file_url "file://localhost$tmp/my%20file.ts:40:3"
check "file url host and :line:col" "$tmp/my file.ts 40" "$path $line"
parse_file_url "file://$tmp/my%20file.ts#L5-L9"
check "file url range" "5" "$line"
parse_file_url "file://$tmp/repo"
check "file url dir" "$tmp/repo " "$path $line"

# Ticket saved on the branch (survives a Herdr restart), else read from the branch name.
git -C "$tmp/repo" worktree add -q -b abc-2-login "$tmp/wt" main 2>/dev/null
save_ticket "$tmp/repo" abc-2-login ABC-2 https://linear.app/acme/issue/ABC-2/login "Fix login"
branch_ticket "$tmp/wt" abc-2-login
check "branch ticket from git config" "ABC-2|https://linear.app/acme/issue/ABC-2/login|Fix login" \
    "$ticket_id|$ticket_url|$ticket_title"
branch_ticket "$tmp/repo" abc-3-other
check "branch name of an unknown team is no ticket" "|" "$ticket_id|$ticket_url"
remember_team_repo ABC "$tmp/repo"
remember_linear_org https://linear.app/acme/issue/ABC-2/login
branch_ticket "$tmp/repo" me/abc-3-other
check "branch name of a known team, linked" "ABC-3|https://linear.app/acme/issue/ABC-3" "$ticket_id|$ticket_url"
branch_ticket "$tmp/repo" utf-8
check "a team never started is no ticket" "" "$ticket_id"
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
printf '#!/bin/sh\necho %s\n' "'{\"number\":7,\"url\":\"https://github.com/o/r/pull/7\",\"state\":\"OPEN\",\"isDraft\":true,\"reviewDecision\":\"APPROVED\",\"statusCheckRollup\":[{\"conclusion\":\"FAILURE\"}]}'" > "$tmp/home/gh"
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
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/herdr-task/prs" # the status line above cached its PR
: > "$tmp/opened"
FAKE_FZF_PICK="failing: build" HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open w1:p1 >/dev/null 2>&1
check "open: failing check opens its own page" "https://ci.example/build/1" "$(cat "$tmp/opened")"
check "open: opens before gh, on what git knows (nothing cached yet)" \
    "https://linear.app/x/issue/ABC-1/fix https://github.com/o/r/compare/main...abc-1-fix https://github.com/o/r/tree/abc-1-fix " \
    "$(cut -f2 "$tmp/fzf-in.first" | tr '\n' ' ')"
check "open: gh's answer replaces the rows, in the app's order, deduped" \
    "https://linear.app/x/issue/ABC-1/fix https://github.com/o/r/pull/7 https://ci.example/build/1 https://github.com/o/r/pull/7/checks https://github.com/o/r/pull/7/files https://github.com/o/r/tree/abc-1-fix " \
    "$(cut -f2 "$tmp/fzf-in" | tr '\n' ' ')"
: > "$tmp/opened"
FAKE_FZF_PICK="failing: build" HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open w1:p1 >/dev/null 2>&1
check "open: the next picker opens on the cached PR" \
    "https://github.com/o/r/pull/7" "$(cut -f2 "$tmp/fzf-in.first" | sed -n 2p)"
printf '#!/bin/sh\necho "no pull requests found for branch" >&2\nexit 1\n' > "$tmp/bin/gh"
: > "$tmp/opened"
FAKE_FZF_PICK=compare HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open w1:p1 >/dev/null 2>&1
check "open: compare view before a PR" "https://github.com/o/r/compare/main...abc-1-fix" "$(cat "$tmp/opened")"
git -C "$tmp/repo" remote set-url origin "$tmp/origin.git"

# --- links and pr: the shared core behind both UIs' prefix+o, the app's status bar and the
# Claude status line ---
lr="$tmp/lrepo"
git init -q -b main "$lr" && git -C "$lr" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$lr" remote add origin git@github.com:o/r.git
git -C "$lr" update-ref refs/remotes/origin/main HEAD
git -C "$lr" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
git -C "$lr" checkout -q -b abc-1-fix
git -C "$lr" config branch.abc-1-fix.linear-id ABC-1
git -C "$lr" config branch.abc-1-fix.linear-url https://linear.app/x/issue/ABC-1
git -C "$lr" config branch.abc-1-fix.linear-title "Fix login"
echo x > "$lr/a" && echo y > "$lr/b"
cat > "$tmp/bin/gh" <<'EOF'
#!/bin/sh
echo gh >> "$FAKE_GH_LOG"
cat "$FAKE_GH_OUT"
EOF
chmod +x "$tmp/bin/gh"
export FAKE_GH_LOG="$tmp/gh.log" FAKE_GH_OUT="$tmp/gh.out"
printf '%s\n' '{"number":7,"url":"https://github.com/o/r/pull/7","title":"Fix login","state":"OPEN","isDraft":true,"reviewDecision":"APPROVED","statusCheckRollup":[{"name":"lint","conclusion":"SUCCESS"},{"name":"unit","conclusion":"FAILURE","detailsUrl":"https://ci/unit"}]}' > "$FAKE_GH_OUT"
: > "$FAKE_GH_LOG"
out=$(bash "$task" links --cwd "$lr")
check "links: no PR cached, so no gh and a compare view" "ticket compare diff branch|0" \
    "$(jq -r '[.links[].kind] | join(" ")' <<<"$out")|$(grep -c . "$FAKE_GH_LOG")"
out=$(bash "$task" links --cwd "$lr" --fresh)
check "links: ticket, PR, failing first, checks, files, diff, branch" \
    "ticket:ABC-1:https://linear.app/x/issue/ABC-1 pr:#7:https://github.com/o/r/pull/7 failing:unit:https://ci/unit checks:Checks:https://github.com/o/r/pull/7/checks files:Changed files:https://github.com/o/r/pull/7/files diff:Uncommitted changes:null branch:abc-1-fix:https://github.com/o/r/tree/abc-1-fix" \
    "$(jq -r '[.links[] | "\(.kind):\(.label):\(.url)"] | join(" ")' <<<"$out")"
check "links: CI state and dirty count" "fail|1/2 passed|2 files" \
    "$(jq -r '[(.links[] | select(.kind == "checks") | .ci, .detail), (.links[] | select(.kind == "diff") | .detail)] | join("|")' <<<"$out")"
: > "$FAKE_GH_LOG"
check "links: the next read is the cached PR, without gh" "#7|0" \
    "$(bash "$task" links --cwd "$lr" | jq -r '.links[1].label')|$(grep -c . "$FAKE_GH_LOG")"
check "pr: younger than --max-age, from the cache" "7|0" \
    "$(bash "$task" pr --cwd "$lr" --max-age 60 | jq -r .number)|$(grep -c . "$FAKE_GH_LOG")"
check "pr: --max-age 0 asks gh" "7|1" "$(bash "$task" pr --cwd "$lr" --max-age 0 | jq -r .number)|$(grep -c . "$FAKE_GH_LOG")"
# --stale-ok: a stale answer at once, gh in the background (the Claude status line).
touch -t 202001010000 "$(pr_cache_file "$(git -C "$lr" rev-parse --show-toplevel)" abc-1-fix)"
sed 's/"number":7/"number":8/' "$FAKE_GH_OUT" > "$FAKE_GH_OUT.8" && mv "$FAKE_GH_OUT" "$FAKE_GH_OUT.7" && mv "$FAKE_GH_OUT.8" "$FAKE_GH_OUT"
: > "$FAKE_GH_LOG"
check "pr: --stale-ok answers from a stale cache at once" "7" "$(bash "$task" pr --cwd "$lr" --max-age 60 --stale-ok | jq -r .number)"
for _ in $(seq 1 30); do
    [[ "$(bash "$task" pr --cwd "$lr" --max-age -1 | jq -r .number)" == 8 ]] && break
    sleep 0.2
done
check "pr: ...and refreshes it in the background, once" "8|1" "$(bash "$task" pr --cwd "$lr" --max-age -1 | jq -r .number)|$(grep -c . "$FAKE_GH_LOG")"
mv "$FAKE_GH_OUT.7" "$FAKE_GH_OUT"
sleep 0.3
bash "$task" pr --cwd "$lr" --max-age 0 >/dev/null
printf '#!/bin/sh\necho "HTTP 502" >&2\nexit 1\n' > "$tmp/bin/gh"
check "pr: a failed gh keeps the cached PR" "7" "$(bash "$task" pr --cwd "$lr" --max-age 0 | jq -r .number)"
printf '#!/bin/sh\necho "no pull requests found for branch" >&2\nexit 1\n' > "$tmp/bin/gh"
check "pr: no PR any more clears the cache" "" "$(bash "$task" pr --cwd "$lr" --max-age 0)"
check "links: after that, a compare view again" "compare" "$(bash "$task" links --cwd "$lr" --no-status | jq -r '.links[1].kind')"
git -C "$lr" checkout -q main
check "links: on the base branch, no branch, ticket or PR" "null|null|0" \
    "$(bash "$task" links --cwd "$lr" --no-status | jq -r '"\(.branch)|\(.ticket)|\(.links | length)"')"
check "links: outside a checkout, nothing" "null|0" "$(bash "$task" links --cwd "$tmp" | jq -r '"\(.top)|\(.links | length)"')"
check "links and pr need no herdr" "0" "$(HERDR_BIN_PATH='' PATH="$tmp/bin:/usr/bin:/bin" bash "$task" links --cwd "$lr" >/dev/null 2>&1; echo $?)"

# --- retag: put task tags back after a Herdr restart ---
git -C "$tmp/repo" worktree add -q -b abc-3-other "$tmp/wt3" main 2>/dev/null
git -C "$tmp/repo" worktree add -q -b scratch "$tmp/wt4" main 2>/dev/null
mkdir -p "$HOME/.claude/cache" && touch "$HOME/.claude/cache/v2-pane-pr-w1:p1"
export FAKE_WORKSPACES='{"result":{"workspaces":[
  {"workspace_id":"w1","worktree":{"checkout_path":"'"$tmp/wt"'"}},
  {"workspace_id":"w2","worktree":{"checkout_path":"'"$tmp/repo"'"}},
  {"workspace_id":"w3","worktree":{"checkout_path":"'"$tmp/wt3"'"}},
  {"workspace_id":"w4"}]}}'
export FAKE_PANES='{"result":{"panes":[
  {"pane_id":"w1:p1","agent":"claude"},{"pane_id":"w1:p2","agent":"codex"},{"pane_id":"w1:p3"},
  {"pane_id":"w4:p1","cwd":"'"$tmp/wt4"'"}]}}'
export FAKE_AGENTS='{"result":{"agents":[{"pane_id":"w1:p1","name":"abc-2-w1"},{"pane_id":"w1:p2","name":"rv-codex-1"}]}}'
: > "$FAKE_LOG"
mkdir -p "$XDG_CACHE_HOME/herdr-task/reviews" && echo w1:p3 > "$XDG_CACHE_HOME/herdr-task/reviews/w1"
bash "$task" retag --startup 2>&1
check "retag exit" 0 $?
check "retag --startup forgets reviewer splits" "" "$(ls "$XDG_CACHE_HOME/herdr-task/reviews")"
log=$(cat "$FAKE_LOG")
glyph=$(printf '\356\206\260')
check "retag: saved ticket back on the workspace" 1 "$(grep -cF "workspace report-metadata w1 --source herdr-task --token repo=repo --token linear=$glyph  ABC-2 --token linear_id=ABC-2 --token linear_url=https://linear.app/acme/issue/ABC-2/login --token linear_title=Fix login" <<<"$log")"
check "retag: ticket and glyph label on the task agent" 1 "$(grep -cF "pane report-metadata w1:p1 --source herdr-task --token linear=$glyph  ABC-2 --token linear_id=ABC-2 --token linear_url=https://linear.app/acme/issue/ABC-2/login --token linear_title=Fix login --display-agent $(printf '\356\262\202') claude" <<<"$log")"
check "retag: reviewer keeps its review label" 1 "$(grep -cF -- "--display-agent $(printf '\356\262\201') codex review" <<<"$log")"
check "retag: a plain shell pane gets the ticket, no label" 1 "$(grep -F 'pane report-metadata w1:p3 ' <<<"$log" | grep -vc -- --display-agent)"
check "retag: ticket from a branch name" 1 "$(grep -cF "workspace report-metadata w3 --source herdr-task --token repo=repo --token linear=$glyph  ABC-3 --token linear_id=ABC-3 --token linear_url=https://linear.app/acme/issue/ABC-3 --token linear_title=" <<<"$log")"
check "retag: plain checkouts are left alone" 0 "$(grep -c 'report-metadata w2 ' <<<"$log")"
check "retag: a worktree with no ticket gets its repo only" 1 "$(grep -cxF 'workspace report-metadata w4 --source herdr-task --token repo=repo' <<<"$log")"
check "retag --startup drops the status line's PR markers" "" "$(ls "$HOME/.claude/cache")"
: > "$FAKE_LOG"
bash "$task" retag --workspace w3 >/dev/null 2>&1
check "retag --workspace touches one workspace" "w3" "$(grep -o 'report-metadata w[0-9]' "$FAKE_LOG" | sort -u | cut -d' ' -f2 | tr '\n' ' ' | xargs)"

# The plugin hands events to retag with their workspace (pane ids start with it).
plughome="$tmp/plughome"
mkdir -p "$plughome/bin"
printf '#!/bin/sh\nshift 2\nprintf "%%s " "$@" > "%s"\n' "$tmp/zsh-args" > "$plughome/bin/zsh"
chmod +x "$plughome/bin/zsh"
HOME=$plughome HERDR_PLUGIN_EVENT=pane.agent_detected HERDR_PLUGIN_EVENT_JSON='{"pane_id":"w7:p2","agent":"claude"}' \
    sh "$root/herdr/plugins/task/run.sh" retag
check "plugin: agent event retags its workspace" "herdr-task retag --workspace w7 " "$(cat "$tmp/zsh-args")"
HOME=$plughome HERDR_PLUGIN_EVENT=worktree.opened HERDR_PLUGIN_EVENT_JSON='{"data":{"workspace":{"workspace_id":"w5"}}}' \
    sh "$root/herdr/plugins/task/run.sh" retag
check "plugin: worktree event retags its workspace" "herdr-task retag --workspace w5 " "$(cat "$tmp/zsh-args")"
HOME=$plughome HERDR_PLUGIN_EVENT=startup sh "$root/herdr/plugins/task/run.sh" retag
check "plugin: startup retags everything" "herdr-task retag --startup " "$(cat "$tmp/zsh-args")"
HOME=$plughome HERDR_PLUGIN_CLICKED_URL=https://linear.app/acme/issue/ABC-2/login sh "$root/herdr/plugins/task/run.sh" open-ticket
check "plugin: Linear click goes to open-ticket" "herdr-task open-ticket https://linear.app/acme/issue/ABC-2/login " "$(cat "$tmp/zsh-args")"

# --- start and tag save the ticket on its branch for retag ---
git -C "$tmp/repo" worktree add -q -b abc-5-new-thing "$tmp/wt5" main 2>/dev/null
: > "$FAKE_LOG"
FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start https://linear.app/acme/issue/ABC-5/new-thing \
    --project "$tmp/repo" --title "New thing" -a none >/dev/null 2>&1
check "start saves the ticket on the branch" "ABC-5|https://linear.app/acme/issue/ABC-5/new-thing|New thing" \
    "$(git -C "$tmp/repo" config branch.abc-5-new-thing.linear-id)|$(git -C "$tmp/repo" config branch.abc-5-new-thing.linear-url)|$(git -C "$tmp/repo" config branch.abc-5-new-thing.linear-title)"
git -C "$tmp/repo" worktree add -q -b late-idea "$tmp/wt6" main 2>/dev/null
(cd "$tmp/wt6" && HERDR_WORKSPACE_ID=w6 bash "$task" tag ABC-6 -t "Late idea" >/dev/null 2>&1)
check "tag renames the unpushed branch and saves the ticket there" \
    "abc-6|ABC-6|https://linear.app/acme/issue/ABC-6|Late idea" \
    "$(git -C "$tmp/wt6" branch --show-current)|$(git -C "$tmp/repo" config branch.abc-6.linear-id)|$(git -C "$tmp/repo" config branch.abc-6.linear-url)|$(git -C "$tmp/repo" config branch.abc-6.linear-title)"

# --- start: where a new branch starts; an open workspace gets no second agent ---
: > "$FAKE_LOG"
FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start brand-new --project "$tmp/repo" -a none >/dev/null 2>&1
check "start: a new branch starts from origin's default branch" 1 "$(grep -c -- '^worktree create .*--branch brand-new --base origin/main ' "$FAKE_LOG")"
git -C "$tmp/repo" push -q origin abc-1-fix:pub-only 2>/dev/null
: > "$FAKE_LOG"
FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start pub-only --project "$tmp/repo" -a none >/dev/null 2>&1
check "start: a published branch starts from origin's copy" 1 "$(grep -c -- '--branch pub-only --base origin/pub-only ' "$FAKE_LOG")"
: > "$FAKE_LOG"
FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start abc-1-fix --project "$tmp/repo" -a none >/dev/null 2>&1
check "start: a local branch is checked out as it is" 0 "$(grep -c -- '--base' "$FAKE_LOG")"
: > "$FAKE_LOG"
FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start "2fa login bug" --project "$tmp/repo" --title "2fa login bug" >/dev/null 2>&1
check "start: agent names start with a letter" 1 "$(grep -c '^agent start t2fa-login-bug-8 --kind claude --pane w8:p1' "$FAKE_LOG")"
: > "$FAKE_LOG"
FAKE_ALREADY_OPEN=true FAKE_WT="$tmp/wt5" HERDR_SOCKET_PATH=x bash "$task" start brand-new --project "$tmp/repo" >/dev/null 2>&1
check "start: an already open workspace gets no second agent" "1|0" \
    "$(grep -c '^worktree create' "$FAKE_LOG")|$(grep -c '^agent ' "$FAKE_LOG")"

# --- the Claude SessionStart hook labels the pane, ticket or not ---
claude_glyph=$(printf '\356\262\202')
: > "$FAKE_LOG"
HERDR_ENV=1 HERDR_WORKSPACE_ID='' sh "$root/ai/claude/hooks/herdr-task-pane.sh" </dev/null
check "claude hook: the glyph outside a task" "pane report-metadata w1:p1 --source herdr-task --display-agent $claude_glyph claude" "$(cat "$FAKE_LOG")"
: > "$FAKE_LOG"
HERDR_ENV=1 HERDR_WORKSPACE_ID=w1 sh "$root/ai/claude/hooks/herdr-task-pane.sh" </dev/null
check "claude hook: the workspace's ticket tokens too" \
    "pane report-metadata w1:p1 --source herdr-task --display-agent $claude_glyph claude --token linear_id=ABC-1 --token linear_url=https://linear.app/x/issue/ABC-1/fix" \
    "$(grep '^pane' "$FAKE_LOG")"

# --- open-ticket: Ctrl-click on a Linear link ---
: > "$FAKE_LOG"; : > "$tmp/opened"
HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open-ticket https://linear.app/acme/issue/ABC-3/other >/dev/null 2>&1
check "open-ticket: focuses the task by its branch" "workspace focus w3" "$(grep '^workspace focus' "$FAKE_LOG")"
check "open-ticket: no browser when the task is open" "" "$(cat "$tmp/opened")"
FAKE_WORKSPACES='{"result":{"workspaces":[{"workspace_id":"w9","tokens":{"linear_id":"ABC-3"}},{"workspace_id":"w3","worktree":{"checkout_path":"'"$tmp/wt3"'"}}]}}' \
    HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open-ticket https://linear.app/acme/issue/ABC-3 >/dev/null 2>&1
check "open-ticket: the tagged workspace wins" "workspace focus w9" "$(grep '^workspace focus' "$FAKE_LOG" | tail -n1)"
: > "$FAKE_LOG"
HERDR_TASK_OPEN="$tmp/bin/record-open" bash "$task" open-ticket https://linear.app/acme/issue/ABC-99/nope >/dev/null 2>&1
check "open-ticket: no task opens the browser" "https://linear.app/acme/issue/ABC-99/nope" "$(cat "$tmp/opened")"
check "open-ticket: no task, no focus" 0 "$(grep -c '^workspace focus' "$FAKE_LOG")"
unset FAKE_WORKSPACES FAKE_PANES FAKE_AGENTS

# --- Herdr app: projects, parse, prepare (JSON, no herdr server) ---
# git answers with physical paths (/private/var on macOS).
ptmp=$(cd "$tmp" && pwd -P)
app_env=(env -u HERDR_BIN_PATH HERDR_BIN_PATH= PATH="$tmp/nobin:/usr/bin:/bin:/opt/homebrew/bin" XDG_CACHE_HOME="$tmp/appcache"
    HERDR_TASK_WORKTREES="$ptmp/appwt" HERDR_TASK_PROJECT_ROOTS="$ptmp")
mkdir -p "$tmp/nobin"
git -C "$ptmp/repo" checkout -q main
out=$("${app_env[@]}" bash "$task" parse https://linear.app/acme/issue/ABC-7/fix-login --cwd "$ptmp/repo")
check "parse: ticket link" "ticket ABC-7 abc-7-fix-login" "$(jq -r '"\(.kind) \(.ticket_id) \(.branch)"' <<<"$out")"
check "parse: focused repo first" "$ptmp/repo" "$(jq -r '.projects[0]' <<<"$out")"
check "parse: free text is a task" "task fix-flaky-test|fix flaky test" \
    "$("${app_env[@]}" bash "$task" parse "fix flaky test" | jq -r '"\(.kind) \(.branch)|\(.title)"')"
check "parse: a branch name" "branch" "$("${app_env[@]}" bash "$task" parse feat/x | jq -r .kind)"

out=$("${app_env[@]}" bash "$task" prepare https://linear.app/acme/issue/ABC-7/fix-login --project "$ptmp/repo" 2>/dev/null)
check "prepare: new worktree" "$ptmp/appwt/repo/abc-7-fix-login false abc-7-fix-login" "$(jq -r '"\(.path) \(.existing) \(.branch)"' <<<"$out")"
check "prepare: worktree exists" "abc-7-fix-login" "$(git -C "$ptmp/appwt/repo/abc-7-fix-login" symbolic-ref --short HEAD 2>/dev/null)"
check "prepare: label has the id" "ABC-7 fix login" "$(jq -r .label <<<"$out")"
check "prepare: ticket saved on the branch" "ABC-7" "$(git -C "$ptmp/repo" config --get branch.abc-7-fix-login.linear-id)"
check "prepare: prompt asks to rename the space" 1 "$(jq -r .prompt <<<"$out" | grep -c 'herdr-app do space.rename')"
out=$("${app_env[@]}" bash "$task" prepare ABC-7 --project "$ptmp/appwt/repo/abc-7-fix-login" 2>/dev/null)
check "prepare: a bare id reopens the slug worktree" "true $ptmp/appwt/repo/abc-7-fix-login" "$(jq -r '"\(.existing) \(.path)"' <<<"$out")"
check "prepare: keeps the saved link" "https://linear.app/acme/issue/ABC-7/fix-login" "$(jq -r .ticket_url <<<"$out")"
check "parse: team repo remembered" "$ptmp/repo" "$("${app_env[@]}" bash "$task" parse ABC-8 | jq -r '.projects[0]')"
out=$("${app_env[@]}" bash "$task" prepare "fix flaky test" --project "$ptmp/repo" --agent none 2>/dev/null)
check "prepare: task title, no agent" "fix flaky test|null|" "$(jq -r '"\(.label)|\(.agent)|\(.prompt)"' <<<"$out")"
git -C "$ptmp/repo" push -q origin abc-1-fix:remote-only 2>/dev/null
"${app_env[@]}" bash "$task" prepare remote-only --project "$ptmp/repo" --agent none >/dev/null 2>&1
check "prepare: a branch only on origin keeps its commits" "$(git -C "$ptmp/repo" rev-parse abc-1-fix)" \
    "$(git -C "$ptmp/appwt/repo/remote-only" rev-parse HEAD 2>/dev/null)"
check "projects: from the worktree, its repo first" "$ptmp/repo" \
    "$("${app_env[@]}" bash "$task" projects --cwd "$ptmp/appwt/repo/abc-7-fix-login" | jq -r '.projects[0]')"

# prepare --branch: a PR's head as it is, even one an older prepare took for team PR.
git -C "$ptmp/repo" branch pr-5 main
printf 'PR\t%s\n' "$ptmp/repo" >> "$tmp/appcache/herdr-task/team-repos"
out=$("${app_env[@]}" bash "$task" prepare --branch pr-5 --project "$ptmp/repo" --agent none 2>/dev/null)
check "prepare --branch: the branch as it is, no ticket" "pr-5||pr-5" "$(jq -r '"\(.branch)|\(.ticket_id)|\(.label)"' <<<"$out")"
check "prepare --branch: no ticket saved on it" "" "$(git -C "$ptmp/repo" config --get branch.pr-5.linear-id)"
check "links: pr-<n> is never a guessed ticket" "null" \
    "$("${app_env[@]}" bash "$task" links --cwd "$ptmp/appwt/repo/pr-5" --no-status | jq -r .ticket)"

# --- prune: a branch only created is not done; one merged at its tip is ---
git -C "$tmp/repo" worktree add -q -b fresh-task "$tmp/wt7" origin/main 2>/dev/null
repo_root=$tmp/repo default_branch=main merged_heads="" open_heads=""
prune_verdict "$tmp/wt7" fresh-task false
check "prune: a branch never committed to is kept" "keep: no commits yet" "$verdict"
merged_heads="fresh-task	$(git -C "$tmp/repo" rev-parse fresh-task)"
prune_verdict "$tmp/wt7" fresh-task false
check "prune: a PR merged at its tip removes it" "remove: merged into main" "$verdict"

# --- tidy_caches: old PR answers and leftovers go, fresh ones stay ---
mkdir -p "$pr_cache_dir" "$review_state_dir"
touch "$pr_cache_dir/fresh.json"
touch -t 202001010000 "$pr_cache_dir/old.json" "$pr_cache_dir/x.json.1.err" "$review_state_dir/w9"
seq 1 1200 > "$XDG_CACHE_HOME/herdr-task/detach.log"
tidy_caches
left=""
for f in old.json fresh.json x.json.1.err; do [[ -e "$pr_cache_dir/$f" ]] && left+="$f "; done
check "tidy_caches: keeps fresh, drops old" "fresh.json " "$left"
check "tidy_caches: reviewer records and the detach log" "|500" \
    "$(ls "$review_state_dir")|$(wc -l < "$XDG_CACHE_HOME/herdr-task/detach.log" | tr -d ' ')"

printf '\n%d failure(s)\n' "$failures"
[[ $failures -eq 0 ]]
