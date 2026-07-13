# Skills

Hand-rolled agent skills, installed into multiple agents via the
[vercel-labs `skills`](https://github.com/vercel-labs/skills) CLI.

## Install

```bash
./install                      # default agents: claude-code codex antigravity
./install cursor amp zed       # override agents
AGENTS="claude-code" ./install # or via env
```

Skills install globally (symlinked into each agent's skill dir, e.g.
`~/.claude/skills/`). Re-run any time to add agents or pick up edits.

## Skills

- `babysit-pr` — shepherd a PR to merge-ready (CI, comments, rebase)
- `humanizer` — remove AI-writing tells from text
- `writing-release-posts` — write Slack release posts / changelogs
- `project-checkin` — weekly project check-in in Linear (**manual only**)

`project-checkin` is gated to explicit invocation: its description tells the
agent not to auto-trigger, so it only runs when you call `/project-checkin` by
name. Note there's no hard "installed but hidden" flag in the base skill spec —
the entry still appears in the skill list; suppression is via the
do-not-auto-trigger description and depends on the agent honoring it.

Add a skill: drop a `<name>/SKILL.md` folder here and re-run `./install`.
