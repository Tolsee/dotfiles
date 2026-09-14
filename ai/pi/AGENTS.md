# Pi trial

At session start, read and follow `~/dev/dotfiles/ai/agents/AGENTS.md`.
Shared skills come from `~/.agents/skills` and repository `.agents/skills`.
Use `/skill:name` when explicitly invoking a skill.

Use Pi for scoped local coding. Use `/claude-task` for an explicit bounded
handoff to the installed Claude Code CLI; pass its context and scope in the task. Before opening a PR or pushing an update,
run native Codex review using the `/codex-review` prompt, inspect its findings,
and address confirmed defects. Review-only requests return findings without edits.

Use installed CLI tools (`gh`, `ltd`, `rtk`, `codegraph`) for their workflows.
Prefix shell commands with `rtk`. When `.codegraph/` exists, use CodeGraph for
code discovery; synchronize it after edits with `codegraph sync`.

For production investigations, preserve read-only scope. Ask the human before
executing any database query. This trial has no MCP adapter or execution sandbox;
use the existing Claude/Codex session when its integrations or enforced permissions
are needed. Shared instructions are behavioral rules, not a sandbox.

When a skill needs unavailable subagents, monitors, or native agent tools,
report the missing capability and use the established Claude/Codex workflow.
Keep persistent PR watching in that workflow until Pi's lifecycle is validated.
Herdr owns notifications. Use its installed Pi integration for session state.
