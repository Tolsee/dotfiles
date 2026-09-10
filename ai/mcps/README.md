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

## Claude Code exclusions

Some servers reach Claude Code through an official plugin instead (datadog).
Installing them from here as well would duplicate every tool in Claude's tool
list, so `install` keeps them out of `~/.claude.json` while still writing them
for codex/antigravity, which have no plugin system. That list is
`CLAUDE_PLUGIN_PROVIDED` in [install](install); `RETIRED` next to it names
servers pruned from every agent. Add to those lists rather than deleting from
`mcp_config.json` when a Claude plugin takes a server over.

Servers installed by their own tooling stay out of `mcp_config.json` entirely,
so this repo neither writes nor prunes them.

## Datadog endpoint

The shared Datadog entry uses `https://mcp.datadoghq.com/v1/mcp`, the supported
endpoint on the existing US1 host. Keep endpoint changes in `mcp_config.json`
and apply them with `./install codex antigravity`. Claude Code continues to use
its official Datadog plugin.

Restart the affected clients after updating their configuration. If a client
requests authentication again, complete its Datadog OAuth login flow. See the
[Datadog MCP setup instructions](https://docs.datadoghq.com/bits_ai/mcp_server/setup/).
