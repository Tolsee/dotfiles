#!/bin/bash
# Spaceship-like Claude Code status line.
# Reads session JSON from stdin: dir (cyan), git branch (magenta), PR hyperlinks
# (current branch's PR plus other open PRs this worktree pushed), the Linear
# ticket of the Herdr task workspace (Linear purple), model + context usage (dim).
# Degrades silently outside a git repo, with no PR, or without gh/herdr — never
# prints to stderr, never stalls the prompt.

input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
# total_input_tokens is cumulative across the session, so derive the current
# context size from the window size and the used percentage instead.
tokens=$(echo "$input" | jq -r '
  (.context_window.context_window_size // empty) as $size
  | (.context_window.used_percentage // empty) as $pct
  | ($size * $pct / 100 | floor)' 2>/dev/null)

dir_name=$(basename "${cwd:-$PWD}")

# gh is refreshed at most once a minute per key: fast enough that a PR opened
# by the session shows up promptly, rare enough not to hammer the API. The
# "v2-" prefix keeps old single-line caches from being read as timestamps.
cache_dir="$HOME/.claude/cache"
cache_prefix="v2-"
cache_ttl=60
now=$(date +%s)
mkdir -p "$cache_dir" 2>/dev/null

# with_deadline <seconds> <command...>: macOS has no timeout(1); perl's alarm
# gives the same deadline. Each render makes at most three calls, so 2s each
# bounds a fully stalled render at 6s.
with_deadline() {
  local secs=$1
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  else
    perl -e 'alarm shift; exec @ARGV' "$secs" "$@"
  fi
}

# cached <key> <dir> <command...>: print cached stdout if fresh, else run the
# command from <dir> under the deadline and cache its output.
cached() {
  local key=$1 dir=$2 file ts
  shift 2
  file="$cache_dir/$cache_prefix$key"
  if [ -f "$file" ]; then
    ts=$(sed -n '1p' "$file" 2>/dev/null)
    case "$ts" in
      ''|*[!0-9]*) ts="" ;;
    esac
    if [ -n "$ts" ] && [ $((now - ts)) -lt "$cache_ttl" ]; then
      sed '1d' "$file"
      return
    fi
  fi
  local out
  out=$(cd "$dir" 2>/dev/null && with_deadline 2 "$@" 2>/dev/null)
  { printf '%s\n' "$now"; printf '%s' "$out"; } 2>/dev/null > "$file"
  printf '%s' "$out"
}


branch=""
pr_links=()

if [ -n "$cwd" ]; then
  # --show-current (not rev-parse --abbrev-ref HEAD) so a detached HEAD
  # renders as an empty branch segment rather than the literal "HEAD".
  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null)
fi

if [ -n "$branch" ] && command -v gh >/dev/null 2>&1; then
  repo_root=$(git -C "$cwd" --no-optional-locks rev-parse --show-toplevel 2>/dev/null)
  repo_key=$(printf '%s' "$repo_root" | shasum 2>/dev/null | cut -c1-16)
  branch_key=$(printf '%s|%s' "$repo_root" "$branch" | shasum 2>/dev/null | cut -c1-16)

  # cd into the repo root (not -R, which needs OWNER/REPO not a path) so gh
  # resolves the correct remote even when cwd is a worktree.
  current_pr=$(cached "pr-$branch_key" "$repo_root" gh pr view "$branch" --json url,number)
  current_number=$(printf '%s' "$current_pr" | jq -r '.number // empty' 2>/dev/null)
  current_url=$(printf '%s' "$current_pr" | jq -r '.url // empty' 2>/dev/null)
  if [ -n "$current_url" ]; then
    pr_links+=("$current_number $current_url")
  fi

  # One session can push several branches from the same worktree. The reflog
  # remembers every branch checked out here in the last 12 hours; show the
  # open PRs of those branches too.
  recent_branches=$(git -C "$cwd" --no-optional-locks reflog show --date=unix --format='%gd %gs' HEAD -n 60 2>/dev/null \
    | awk -v since=$((now - 43200)) '
        match($1, /@\{[0-9]+\}/) { ts = substr($1, RSTART + 2, RLENGTH - 3) }
        ts >= since && /checkout: moving from / { print $(NF - 2); print $NF }' \
    | sort -u)
  if [ -n "$recent_branches" ]; then
    open_prs=$(cached "open-prs-$repo_key" "$repo_root" gh pr list --author @me --state open --limit 50 --json number,url,headRefName)
    while IFS=' ' read -r number url; do
      [ -n "$url" ] && [ "$number" != "$current_number" ] && pr_links+=("$number $url")
    done < <(printf '%s' "$open_prs" | jq -r --arg branches "$recent_branches" '
      ($branches | split("\n")) as $b
      | .[] | select(.headRefName as $h | $b | index($h)) | "\(.number) \(.url)"' 2>/dev/null | head -n 3)
  fi
fi

# Mirror the PR numbers onto the Herdr pane (once per change) so the sidebar's
# agent row shows them next to the ticket.
if [ -n "$HERDR_PANE_ID" ] && command -v herdr >/dev/null 2>&1; then
  pr_label=""
  for entry in "${pr_links[@]}"; do
    pr_label="${pr_label:+$pr_label }#${entry%% *}"
  done
  pr_state_file="$cache_dir/${cache_prefix}pane-pr-$HERDR_PANE_ID"
  if [ "$(cat "$pr_state_file" 2>/dev/null)" != "$pr_label" ]; then
    printf '%s' "$pr_label" 2>/dev/null > "$pr_state_file"
    if [ -n "$pr_label" ]; then
      with_deadline 2 herdr pane report-metadata "$HERDR_PANE_ID" --source statusline --token "pr=$pr_label" >/dev/null 2>&1
    else
      with_deadline 2 herdr pane report-metadata "$HERDR_PANE_ID" --source statusline --clear-token pr >/dev/null 2>&1
    fi
  fi
fi

# Linear ticket of the Herdr task workspace, reported by ~/bin/herdr-task.
linear_id=""
linear_url=""
if [ -n "$HERDR_WORKSPACE_ID" ] && command -v herdr >/dev/null 2>&1; then
  ws=$(cached "herdr-ws-$HERDR_WORKSPACE_ID" . herdr workspace get "$HERDR_WORKSPACE_ID")
  linear_id=$(printf '%s' "$ws" | jq -r '.result.workspace.tokens.linear_id // empty' 2>/dev/null)
  linear_url=$(printf '%s' "$ws" | jq -r '.result.workspace.tokens.linear_url // empty' 2>/dev/null)
fi

ctx=""
if [ -n "$tokens" ] && [ "$tokens" -eq "$tokens" ] 2>/dev/null; then
  ctx="$((tokens / 1000))k"
fi
if [ -n "$used_pct" ]; then
  pct_str=$(printf '%.0f%%' "$used_pct")
  if [ -n "$ctx" ]; then
    ctx="$ctx ($pct_str)"
  else
    ctx="$pct_str"
  fi
fi

CYAN='\033[36m'
MAGENTA='\033[35m'
LINK='\033[34m'
LINEAR='\033[38;2;94;106;210m'
DIM='\033[2m'
RESET='\033[0m'

# OSC 8 hyperlink: ESC ]8;;URL ESC \ TEXT ESC ]8;; ESC \
# Built as one contiguous sequence (no color codes inside it); the color wraps
# it from the outside only, so the hyperlink escapes are never split.
hyperlink() { printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$1" "$2"; }

out=$(printf "${CYAN}%s${RESET}" "$dir_name")

if [ -n "$branch" ]; then
  out="${out} $(printf "${MAGENTA}%s${RESET}" "$branch")"
fi

for entry in "${pr_links[@]}"; do
  number=${entry%% *}
  url=${entry#* }
  out="${out} $(printf "${LINK}%s${RESET}" "$(hyperlink "$url" "#$number")")"
done

if [ -n "$linear_id" ] && [ -n "$linear_url" ]; then
  out="${out} $(printf "${LINEAR}%s${RESET}" "$(hyperlink "$linear_url" "$linear_id")")"
fi

meta=""
if [ -n "$model" ]; then
  meta="$model"
fi
if [ -n "$ctx" ]; then
  if [ -n "$meta" ]; then
    meta="$meta | $ctx"
  else
    meta="$ctx"
  fi
fi

if [ -n "$meta" ]; then
  out="${out} $(printf "${DIM}%s${RESET}" "$meta")"
fi

printf "%s" "$out"
