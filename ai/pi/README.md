# Pi coding trial

Run `./ai/pi/install` from dotfiles. This opt-in installer pins Pi's version,
adds shared-rule discovery and a native Codex review prompt, and installs the
Herdr Pi integration when Herdr is present. Node.js 22.19+ and Python 3 are required.
Existing Pi settings win over initial model defaults; authentication is separate.

Start `pi`, run `/login`, and select OpenAI Codex for your ChatGPT subscription.
Use `/model` to inspect available models. New sessions default to
`gpt-5.6-terra` with medium thinking for everyday coding. Use Luna for mechanical
edits and summaries, and switch to Astra with high thinking for difficult
debugging, architectural decisions, or repeated failures. `/thinking` changes
effort. Model escalation is manual; these defaults do not install a model router.
Existing installations retain their selected model: use `/model` and `/thinking`
to select the new default, or update those two fields in Pi settings.

The existing shared `~/.agents/skills` and project `.agents/skills` are discovered
by Pi. Trust the intended project when prompted so its skills load. Keep using
`./ai/skills/install` and `./ai/skills/update` as the shared source workflow.
Additional skill copies in `~/.pi/agent/skills` may create collision warnings;
inspect those before deciding which copy to keep.

| Action | Command |
| --- | --- |
| Start a named coding task | `pi --name "scoped task"` |
| Invoke a shared workflow | `/skill:pr-proof` (in the monolith) |
| Delegate a bounded task to native Claude Code | `/claude-task <task>` |
| Start a persistent Claude monitoring session | `/claude-monitor <target and stop condition>` |
| Review local changes with native Codex | `/codex-review --uncommitted` |
| Review a branch with native Codex | `/codex-review --base origin/main` |
| Switch models | `/model` |
| Branch a conversation | `/tree` or `/fork` |
| Resume a session | `pi -r` |

`/codex-review` is a prompt that asks Pi to run the installed Codex CLI; it uses
Codex's configuration and authentication. It is review-only, not an automatic
background controller. Codex must be installed and signed in independently.

`/claude-task` forwards a bounded task to native Claude Code through `claude -p`.
It uses Claude's existing authentication and configuration, with a separate
conversation. Interactive permission requests may require a separate Claude pane;
the prompt does not bypass them. Pi can initiate this handoff when an authorized task needs Claude capabilities;
the slash command is also available for explicit requests. This uses the native
CLI rather than direct Claude-provider access inside Pi.

`/claude-monitor` uses the installed Claude CLI background-session commands. It
requires a concrete target and stop condition, reports the session ID, and checks
its status and logs. A running session is not proof that its monitoring tools or
authentication work; confirm the first successful observation. Permission prompts
require attaching to that session. Results stay in Claude; Pi does not receive
background completion events automatically.

This initial trial adds no MCP, subagent, notification, or monitoring packages.
Keep Claude/Codex for established integrations and PR watching. Pi's tool execution
is not protected by their sandbox/approval settings; local instruction files do
not provide equivalent enforcement. Herdr supplies state and silent notifications.

Try a scoped PHP change and a current-head review first. Compare manual corrections,
missed checks, elapsed time, and actual usage with the existing workflow. Add an
integration only when a real task requires it. No performance or cost gain is assumed.

Rerun the installer for missing defaults and current prompt paths. Pi retains
settings edits and sessions; remove the managed AGENTS link and prompt-directory
entry to disconnect this trial. Claude/Codex configuration is not rewritten.

Inspired by [Nate's configuration](https://github.com/nateberkopec/dotfiles/blob/18e515a0549132a44bc93fba9ffcd0b4e162e4ce/files/home/.pi/agent/settings.json).
References: [Pi skills](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/skills.md),
[prompt templates](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/prompt-templates.md).
