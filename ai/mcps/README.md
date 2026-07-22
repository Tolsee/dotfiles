# Global MCP Servers Manager

This directory holds your global Model Context Protocol (MCP) server configurations. Running the installer script registers the servers across all supported agents as a single source of truth.

## Supported Agents
- **Claude Code** (`~/.claude.json`)
- **Antigravity** (`~/.gemini/config/mcp_config.json`)
- **Codex** (`~/.codex/config.toml`)

## Installation

Run the installer to update MCP configurations for all three agents:
```bash
./install
```

You can target specific agents by passing them as arguments or using the `AGENTS` environment variable:
```bash
./install antigravity
./install claude-code codex
AGENTS="antigravity" ./install
```

## Adding or Updating MCP Servers

1. Edit [ai/mcps/mcp_config.json](mcp_config.json) to add, modify, or remove MCP servers.
2. Run `./install` to apply the updates.
