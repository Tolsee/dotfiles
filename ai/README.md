# AI tooling

This directory is the single source of truth for AI-agent configuration.

- `agents/` — shared rules for Codex, Claude Code, and Antigravity/Gemini
- `claude/` — Claude Code global instructions and RTK guidance
- `codex/` - Codex-specific instructions, including MCP login recovery
- `mcps/` — shared global MCP server definitions and installer
- `skills/` — reusable Agent Skills and their installer

Run `./setup` from the repository root to install agent rules, MCPs, and skills.
From this directory, run `./skills/install` to install only the skills into the
selected agents, or `./skills/update` to update the CLI-managed upstream skills
from the shared allowlist.

Run `./ai/agents/install codex` from the repository root to install only Codex
rule pointers. With no arguments, the installer continues to configure all
agents; it also accepts the same `AGENTS` selection as the MCP installer.
Codex's MCP recovery rule starts the matching OAuth or documented CLI login
after an explicit authentication failure; you complete the browser flow.
Servers using API keys or client-managed authentication receive the appropriate
credential-manager or client UI instructions. Start a new Codex session after
installing the rule.
