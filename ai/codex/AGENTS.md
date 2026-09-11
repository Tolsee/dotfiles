# Codex Rules

## Datadog authentication recovery

When Datadog MCP reports missing or expired authentication (including an OAuth
refresh failure), run `codex mcp login datadog-mcp` yourself. Tell the user you
are opening the browser for Datadog login, then wait for them to complete the
browser flow. This recovery is already authorized; only ask for permission if
the execution environment requires it.

After login succeeds, retry the failed read once. If Datadog tools remain
unavailable, ask the user to reconnect the MCP server or restart Codex. If login
fails or is cancelled, report the error and stop retrying. Handle permission
denials, rate limits, and network errors separately from authentication expiry.
