# Pi trial

At session start, read and follow `~/dev/dotfiles/ai/agents/AGENTS.md`.
Shared skills come from `~/.agents/skills` and repository `.agents/skills`.
Use `/skill:name` when explicitly invoking a skill.

Use Pi for scoped local coding. When an authorized task needs Claude plugins
or native tools, initiate a bounded handoff using the procedure in
`~/dev/dotfiles/ai/pi/prompts/claude-task.md`; pass the context and scope explicitly.
The slash command is a convenience, not a requirement for delegation. Before opening a PR or pushing an update,
run native Codex review using the `/codex-review` prompt, inspect its findings,
and address confirmed defects. Review-only requests return findings without edits.

Use installed CLI tools (`gh`, `ltd`, `rtk`, `codegraph`) for their workflows.
Prefix shell commands with `rtk`. When `.codegraph/` exists, use CodeGraph for
code discovery; synchronize it after edits with `codegraph sync`.

For production investigations, preserve read-only scope. Ask the human before
executing any database query. This trial has no MCP adapter or execution sandbox;
use the existing Claude/Codex session when its integrations or enforced permissions
are needed. Shared instructions are behavioral rules, not a sandbox.

For requested deployment or PR monitoring, use the procedure in
`~/dev/dotfiles/ai/pi/prompts/claude-monitor.md` to start a native Claude background
session. Pass the target, checks, constraints, and stop condition. Report its
session ID and verify the first successful observation before saying monitoring
is active. If launch, authentication, or permissions block it, report the exact
blocker and attach command. A bounded `claude -p` invocation is not a persistent
monitor. Background results remain in Claude unless explicitly retrieved.
Herdr owns notifications. Use its installed Pi integration for session state.
