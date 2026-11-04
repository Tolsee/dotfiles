# Hex

[Hex](https://github.com/anomalyco/hex) is local voice dictation: hold the shortcut, speak, let
go, and it pastes into the focused app. That makes it a voice input for every agent prompt:
Claude Code, Codex, the Herdr app and the TUI. Speech never leaves the Mac.

`./setup` runs `ai/hex/install`, which:

- installs it with Homebrew (`brew install --cask anomalyco/tap/hex`) when it is missing;
- links its CLI to `~/.local/bin/hex`, so agents can drive it (`hex status --json`,
  `hex history --since 1d --json`, `hex meetings search ...`);
- teaches it the words dictation gets wrong in agent prompts (`vocabulary.tsv`: herdr, TUI,
  worktree, Buildkite, ...). This needs Hex running, so open it once (it downloads a speech
  model) and rerun `./ai/hex/install`.

For agents, `ai/mcps` registers `hex mcp`, a read-only MCP server over recorded meeting
transcripts, in Claude Code, Codex and Antigravity. `ai/skills` installs Hex's
`hex-personal-commands` skill, used when you ask an agent to add a dictation transformation.

Add a misheard word to `vocabulary.tsv` (term, a tab, then what Hex hears instead) and rerun
the installer.
