#!/bin/bash
# Spaceship-like Claude Code status line.
# Reads session JSON from stdin: dir (cyan), git branch (magenta),
# PR hyperlink (own color), model display name + context-window usage (dim).
# Degrades silently outside a git repo, on a branch with no PR (or a detached
# HEAD), or when `gh` is missing/unauthenticated — never prints to stderr,
# never stalls the prompt.

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

branch=""
pr_url=""
pr_number=""

if [ -n "$cwd" ]; then
  # --show-current (not rev-parse --abbrev-ref HEAD) so a detached HEAD
  # renders as an empty branch segment rather than the literal "HEAD".
  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null)
fi

if [ -n "$branch" ]; then
  # Prefer the PR info Claude Code already resolved for the footer badge —
  # this avoids shelling out to `gh` on every render entirely.
  pr_url=$(echo "$input" | jq -r '.pr.url // empty')
  pr_number=$(echo "$input" | jq -r '.pr.number // empty')

  # Fallback for when .pr isn't populated yet (e.g. brand-new branch, PR not
  # found yet): a file cache keyed on repo+branch, refreshed at most every
  # 5 minutes, so a branch with no PR (the common case on a fresh branch)
  # doesn't trigger a network call on every render.
  if [ -z "$pr_url" ] && command -v gh >/dev/null 2>&1; then
    repo_root=$(git -C "$cwd" --no-optional-locks rev-parse --show-toplevel 2>/dev/null)
    cache_dir="$HOME/.claude/cache"
    mkdir -p "$cache_dir" 2>/dev/null
    key=$(printf '%s' "${repo_root}|${branch}" | shasum 2>/dev/null | cut -c1-16)

    if [ -n "$key" ]; then
      cache_file="$cache_dir/pr-$key"
      now=$(date +%s)
      use_cache=false

      if [ -f "$cache_file" ]; then
        cached_url=$(sed -n '1p' "$cache_file" 2>/dev/null)
        cached_number=$(sed -n '2p' "$cache_file" 2>/dev/null)
        cached_ts=$(sed -n '3p' "$cache_file" 2>/dev/null)
        cached_branch=$(sed -n '4p' "$cache_file" 2>/dev/null)
        if [ "$cached_branch" = "$branch" ] && [ -n "$cached_ts" ] \
          && [ $((now - cached_ts)) -lt 300 ] 2>/dev/null; then
          use_cache=true
          pr_url="$cached_url"
          pr_number="$cached_number"
        fi
      fi

      if [ "$use_cache" != true ]; then
        # macOS has no timeout(1); perl's alarm gives the same 3s deadline.
        gh_timeout="perl -e alarm(3);exec(@ARGV)"
        command -v timeout >/dev/null 2>&1 && gh_timeout="timeout 3"
        # cd into the repo root (not -R, which needs OWNER/REPO not a path)
        # so gh resolves the correct remote even when cwd is a worktree.
        gh_json=$(cd "$repo_root" 2>/dev/null && $gh_timeout gh pr view "$branch" --json url,number 2>/dev/null)
        pr_url=$(printf '%s' "$gh_json" | jq -r '.url // empty' 2>/dev/null)
        pr_number=$(printf '%s' "$gh_json" | jq -r '.number // empty' 2>/dev/null)
        {
          printf '%s\n' "$pr_url"
          printf '%s\n' "$pr_number"
          printf '%s\n' "$now"
          printf '%s\n' "$branch"
        } > "$cache_file" 2>/dev/null
      fi
    fi
  fi

  # number should always accompany url, but fall back to the URL's trailing
  # path segment (the PR number) if a source ever omits it.
  if [ -n "$pr_url" ] && [ -z "$pr_number" ]; then
    pr_number="${pr_url##*/}"
  fi
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
DIM='\033[2m'
RESET='\033[0m'

out=$(printf "${CYAN}%s${RESET}" "$dir_name")

if [ -n "$branch" ]; then
  out="${out} $(printf "${MAGENTA}%s${RESET}" "$branch")"
fi

if [ -n "$pr_url" ] && [ -n "$pr_number" ]; then
  # OSC 8 hyperlink: ESC ]8;;URL ESC \ TEXT ESC ]8;; ESC \
  # Built as one contiguous sequence (no color codes inside it); LINK/RESET
  # wrap it from the outside only, so the hyperlink escapes are never split.
  pr_link=$(printf '\033]8;;%s\033\\#%s\033]8;;\033\\' "$pr_url" "$pr_number")
  out="${out} $(printf "${LINK}%s${RESET}" "$pr_link")"
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
