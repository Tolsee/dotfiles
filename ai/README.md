# AI tooling

This directory is the single source of truth for AI-agent configuration.

- `agents/` — shared rules for Codex, Claude Code, and Antigravity/Gemini
- `aws/` — AWS account profiles, MCP access, and selected Agent Toolkit skills
- `claude/` — Claude Code global instructions, RTK guidance, settings defaults,
  model-tiered subagents (`agents/`) and the jev-model-router mod that sets each
  spawn's model (see [Model routing](#model-routing))
- `codex/` - Codex-specific instructions, including MCP login recovery, and the
  review-only Codex config agents use for local reviews
- `mcps/` — shared global MCP server definitions and installer
- `skills/` — reusable Agent Skills and their installer

Run `./setup` from the repository root to install agent rules, MCPs, and skills.
From this directory, run `./skills/install` to install only the skills into the
selected agents, or `./skills/update` to update the CLI-managed upstream skills
from the shared allowlist.

Follow [AWS setup](aws/README.md) for account-specific aws-vault agent profiles,
reduced-permission MCP access, and selected skills across detected agents.

Run `./ai/agents/install codex` from the repository root to install only Codex
rule pointers. With no arguments, the installer continues to configure all
agents; it also accepts the same `AGENTS` selection as the MCP installer.
Codex's MCP recovery rule starts the matching OAuth or documented CLI login
after an explicit authentication failure; you complete the browser flow.
Servers using API keys or client-managed authentication receive the appropriate
credential-manager or client UI instructions. Start a new Codex session after
installing the rule.

The `claude-code` and `codex` targets also set up `~/.codex-review`: a Codex
home with a cheaper config (medium effort, standard tier) that shares the main
login. Agents run local reviews with `~/.codex-review/codex-review`, which wraps
the Codex Claude Code plugin's native review; interactive Codex is unchanged.

Pi is an opt-in coding trial: run `./ai/pi/install`. It reuses the shared skills
and adds `/codex-review` for native Codex reviews. See [pi/README.md](pi/README.md).

## Model routing

The Claude Code main session stays on Opus; subagents run on haiku or sonnet
without anyone remembering `/delegate`. Four layers, each covering the one
before it failing:

1. **CLAUDE.md, Model routing**: the always-loaded table that tells the main
   session which agent takes which work.
2. **`claude/agents/*.md`**: every agent pins `model: haiku` or `sonnet`
   (`Explore` overrides the built-in, which otherwise inherits Opus) and is
   barred from spawning agents. `./test claude` fails on an agent without one.
3. **jev-model-router** (`claude/skills/jev-model-router`): an `agent.spawn` mod.
   Pinned types keep their model, an explicit opus ask is capped to it;
   `general-purpose`, `claude` and `Plan` start at sonnet and Jev may move them
   to haiku (or to opus for a risky task). A description starting with `[opus]`
   is the explicit way up. No `TYPESAFE_API_KEY` means agent-type routing only.
   Each decision is one `[jev-model-router]` line in the transcript.
4. **settings.defaults.json `env`**: `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` for any
   spawn nothing else priced (also with the mod off, e.g. `--safe-mode`),
   `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` so subagents cannot spawn (no
   delegation loops), and `Agent(fork)` denied because a fork always runs on
   the main model.

`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` turns off the Opus advisor: on an Opus main
session it was a second Opus re-reading the whole transcript, uncached, at every
checkpoint. The settings merge only adds keys, so to undo any of these delete the
entry from `~/.claude/settings.json` itself, not only from the defaults.

Check it worked with `/usage` after a day: the token bulk of delegated work
should sit under Haiku and Sonnet.
