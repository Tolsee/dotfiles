# Skills

Hand-rolled agent skills, installed into multiple agents via the
[vercel-labs `skills`](https://github.com/vercel-labs/skills) CLI.

## Install

```bash
./install                      # default agents: claude-code codex
./install cursor amp zed       # override agents
AGENTS="claude-code" ./install # or via env
```

Skills install globally (symlinked into each agent's skill dir, e.g.
`~/.claude/skills/`). Re-run any time to add agents or pick up edits.

## Skills

- `babysit-pr` — shepherd a PR to merge-ready (CI, comments, rebase)
- `humanizer` — remove AI-writing tells from text
- `writing-release-posts` — write Slack release posts / changelogs

Add a skill: drop a `<name>/SKILL.md` folder here and re-run `./install`.
