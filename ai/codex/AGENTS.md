# Codex Rules

## MCP authentication recovery

When any installed MCP server reports missing or expired authentication
(including an OAuth refresh failure), identify its exact configured server name
and authentication method. Inspect only names, transports, authentication status,
and credential variable names; filter configuration output to keep credential
values out of context. Missing tools alone are not evidence of expired login.

- For a server using OAuth supported by Codex, run
  `codex mcp login <configured-server-name>` yourself. For example, Datadog's
  configured name is `datadog-mcp`. Tell the user which service's browser login
  you are starting, then wait for them to complete it.
- For servers using a separate CLI or SDK login, follow their installed skill
  or documented recovery flow with the configured account/profile. Ask for
  missing account/profile context when it cannot be determined.
- For API keys, environment tokens, or client-managed plugin authentication,
  explain the required credential-manager or client UI step. Keep secrets in
  the credential manager; never request that the user paste them into chat.

Starting a supported login flow for the configured identity is already
authorized; only ask for permission if the execution environment requires it.
Keep the configured authentication method and account unchanged.

After login succeeds, retry the failed read once. If tools remain unavailable,
ask the user to reconnect the MCP server or restart Codex. If login fails or is
cancelled, report the error and stop retrying. Handle permission denials,
insufficient scopes, rate limits, and network errors separately from login
expiry. Verify the outcome of a failed write before considering a retry.
