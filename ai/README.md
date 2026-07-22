# AI tooling

This directory is the single source of truth for AI-agent configuration.

- `agents/` — shared rules for Codex, Claude Code, and Antigravity/Gemini
- `claude/` — Claude Code global instructions and RTK guidance
- `mcps/` — shared global MCP server definitions and installer
- `skills/` — reusable Agent Skills and their installer

Run `../setup` from the repository root to install agent rules and MCPs. Run
`./skills/install` from this directory to install skills into the selected
agents.
