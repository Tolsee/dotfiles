# Skills

Agent skills installed into multiple agents via the
[vercel-labs `skills`](https://github.com/vercel-labs/skills) CLI. The installer
manages both skills maintained in this repository and selected skills fetched
from upstream repositories.

## Install

```bash
./ai/skills/install                      # default agents: claude-code codex antigravity
./ai/skills/install cursor amp zed       # override agents
AGENTS="claude-code" ./ai/skills/install # or via env
```

Skills install globally into each agent's skill directory (for example,
`~/.claude/skills/`). Re-run the installer to add agents, pick up local edits,
or refresh the selected upstream skills.

## Update upstream skills

```bash
./ai/skills/update            # update every selected upstream skill
./ai/skills/update wayfinder  # update one selected upstream skill
```

The update wrapper only accepts skills listed in `ai/skills/upstream-skills`.
Local skills are not registry-managed: edit them in this repository and re-run
`./ai/skills/install` to refresh their agent links.

## Local skills

These skills are maintained under `ai/skills/` in this repository:

- `babysit-pr` — shepherd a PR to merge-ready (CI, comments, rebase)
- `writing-release-posts` — write Slack release posts / changelogs
- `project-checkin` — weekly project check-in in Linear (**manual only**)

`project-checkin` is gated to explicit invocation: its description tells the
agent not to auto-trigger, so it only runs when you call `/project-checkin` by
name. Note there's no hard "installed but hidden" flag in the base skill spec —
the entry still appears in the skill list; suppression is via the
do-not-auto-trigger description and depends on the agent honoring it.

To add a local skill, create `ai/skills/<name>/SKILL.md` and re-run
`./ai/skills/install`. The local `--skill '*'` install picks it up
automatically.

## Upstream-managed skills

These skills are installed directly from
[`mattpocock/skills`](https://github.com/mattpocock/skills):

- `grill-me`
- `grilling`
- `wayfinder`
- `domain-modeling`
- `research`
- `prototype`
- `setup-matt-pocock-skills`

To add another skill from `mattpocock/skills`, add its name to
`ai/skills/upstream-skills`, then re-run the installer. This shared list also
makes it available to `./ai/skills/update`. Skills from another upstream
repository need their own `npx skills add <owner>/<repo>` block.
