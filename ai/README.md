# AI tooling

This directory is the single source of truth for AI-agent configuration.

- `agents/` — shared rules for Codex, Claude Code, and Antigravity/Gemini
- `claude/` — Claude Code global instructions and RTK guidance
- `mcps/` — shared global MCP server definitions and installer
- `skills/` — reusable Agent Skills and their installer

Run `./setup` from the repository root to install agent rules, MCPs, and skills.
From this directory, run `./skills/install` to install only the skills into the
selected agents, or `./skills/update` to update the CLI-managed upstream skills
(Claude Code's upstream skills auto-update via the mattpocock-skills plugin).
