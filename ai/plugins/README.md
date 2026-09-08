# Plugins

Install [Spotify Portal](https://github.com/spotify/portal-ai-plugins):

```bash
./ai/plugins/install
./ai/plugins/install claude-code codex devin cursor antigravity
AGENTS="codex devin" ./ai/plugins/install
```

The default targets match the skills installer (Claude Code, Codex,
Antigravity), plus Devin and Cursor when their CLIs are installed. Root
`./setup` runs this installer too. Arguments or `AGENTS` override the targets.
Requires `jq`, Node.js/npm, and the selected native agent CLIs.

| Agent | Installation |
| --- | --- |
| Claude Code | Native `portal@portal` plugin, user scope |
| Codex | Native `portal@portal` plugin |
| Devin for Terminal | Native plugin, this machine only |
| Cursor | Portal skills via the skills CLI; native plugin also available through Cursor's team marketplace |
| Antigravity | Portal skills via the skills CLI |

Claude Code and Codex use the skills fallback if their CLI is absent.
The fallback installs only `setup`, `doctor`, `search`, `service`, `actions`,
and `feedback`, preserving upstream sources rather than vendoring files.
The skills CLI stores these skills in `~/.agents/skills`. The installer also
links them into each fallback agent's global skill directory, because the
CLI currently skips some of those paths. Before installing, it checks the
skills CLI lockfile for Portal ownership of existing shared skills and refuses
conflicting destination paths. Re-run the installer to refresh fallback skills.

Portal provides authentication setup, readiness diagnostics, software catalog
and documentation search, service briefings, action discovery/execution, and
feedback. After installation, start a new session and ask to set up Spotify
Portal (Claude Code: `/portal:setup`). You need access to a Portal instance;
installation does not authenticate or run Portal actions.

The separate **Shunt** plugin supports Claude Code only. It routes large file
reads and boilerplate generation through Portal's AiKA modes and requires
authenticated Portal access with AiKA enabled. It is not installed by default.
