# Skills

Agent skills installed into multiple agents. Two sources, two mechanisms:

- **Local skills** (maintained in this repo) install into every agent via the
  [vercel-labs `skills`](https://github.com/vercel-labs/skills) CLI.
- **Upstream skills** (all of
  [`mattpocock/skills`](https://github.com/mattpocock/skills)) install into
  Claude Code via the official `mattpocock-skills` plugin (managed,
  auto-updating), and into every other agent via the `skills` CLI with
  `--skill '*'`.

## Install

```bash
./ai/skills/install                      # default agents: claude-code codex antigravity
./ai/skills/install cursor amp zed       # override agents
AGENTS="claude-code" ./ai/skills/install # or via env
```

Skills install globally into each agent's skill directory (for example,
`~/.codex/skills/`). Re-run the installer to add agents, pick up local edits,
or refresh the CLI-managed upstream skills.

After installing, run `/setup-matt-pocock-skills` once per repo where you use
the engineering skills (configures issue tracker, triage labels, and doc
layout).

## Update upstream skills

```bash
./ai/skills/update            # update all CLI-managed upstream skills
./ai/skills/update wayfinder  # update one skill
```

This only touches skills installed via the `skills` CLI (codex, antigravity).
Claude Code's copy is the `mattpocock-skills` plugin, which updates
automatically through the official marketplace. Local skills are not
registry-managed: edit them in this repository and re-run
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

## Upstream skills

Everything published by
[`mattpocock/skills`](https://github.com/mattpocock/skills) is installed, with
no per-skill list to maintain: new upstream skills arrive on the next
`./ai/skills/install` (or `./ai/skills/update` for CLI-managed agents; Claude
Code picks them up automatically via the plugin).

Don't also install mattpocock/skills into Claude Code via the `skills` CLI —
the plugin and CLI copies would show every skill twice. Skills from another
upstream repository need their own `npx skills add <owner>/<repo>` block in
`./ai/skills/install`.
