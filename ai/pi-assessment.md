**Pi assessment for your Claude, Codex, and herdr workflow**

> Historical assessment written before the trial was installed on 2026-09-14.
> Pi and Herdr setup has since landed in PRs #15 and #16. Statements below about
> missing installation and proposed changes describe that earlier snapshot.
> See [the current Pi setup](pi/README.md) and [Herdr setup](../herdr/README.md)
> for supported commands and configuration.

Assessed 2026-09-14 from the installed configuration, your dotfiles working tree, and primary documentation. This is a compatibility assessment, not a performance benchmark. Pi is not currently on PATH; only an existing Pi skills directory was found. No Pi installation, authentication, model run, or migration was performed.

My recommendation is a bounded Pi trial alongside Claude Code and native Codex. Your shared skills make entry inexpensive. Your review automation, MCP connections, delegation, and memory make complete replacement a substantially larger project. Expected fit: good for local coding and CLI-driven work; conditional for production investigation and unattended PR workflows until the integrations are exercised.

| Your current workflow, verified locally | What moving to Pi means |
| --- | --- |
| 34 shared skills in `~/.agents/skills`, plus three monolith skills in `.agents/skills` | Pi discovers both locations. Project resources require project trust. Reuse these sources; avoid copying the skill collection. Discovery does not prove that harness-specific instructions work. |
| Shared instructions in `ai/agents/AGENTS.md`; Claude and Codex entrypoints installed by `ai/agents/install` | Add a Pi global entrypoint pointing to the shared rules and a small Pi-specific capability mapping. The current rules installer rejects Pi as a target; the MCP installer has no Pi target. |
| Opus main session, Sonnet feature implementer, Haiku mechanical editor, manual `/delegate` | Preserve these roles if useful, but translate Claude agent frontmatter/tool restrictions into Pi subagent configuration. Loading the Markdown alone does not recreate Claude's Agent tool. |
| Claude `PreToolUse` RTK rewrite; CodeGraph prompt and stop hooks | Port the behaviors through Pi extension events. The `rtk` and `codegraph` CLIs themselves remain usable. Preserve the conditional CodeGraph sync and avoid introducing duplicate sync hooks. |
| Nine Codex MCP entries, including Buildkite, AWS, Notion, Datadog, CodeGraph, Grafana, Linear, Postme, and the knowledge base | An MCP adapter is needed. Test transport, OAuth renewal, tool naming, and one representative read per needed service. A config import is not a credential migration. |
| Claude plugins for LSPs, LTD, knowledge base, Superpowers, frontend design, code simplification, Codex, Datadog, and Slack | Their prompts may be reusable; their runtime tools, hooks, LSP clients, and plugin registration do not move simply by adding skill directories. App-supplied tools in Codex also need a separate access path. |
| Native `/codex:review` via the installed Codex companion | Retain native Codex review initially. The installed companion uses Codex app-server and Claude-specific background/status plumbing. A generic review prompt in Pi does not exercise that same review path. |
| `babysit-pr`, `review-comments`, Wayfinder/research delegation, and `project-checkin` | Review criteria and CLI commands carry over. Monitor/ScheduleWakeup, background agents, the Skill tool, AskUserQuestion, and hardcoded MCP tool names need deliberate mappings. |
| Codex native memories enabled; Claude memory instructions | Pi's session history is separate from Codex memory generation and retrieval. Start with shared durable instructions and a deliberate read-only reference strategy. Do not import every historical conversation or assume automatic memory parity. |
| Herdr 0.9.0, Claude/Codex integrations, session restore, terminal popups and sound | Add herdr's Pi integration during a trial. Keep notifications owned by herdr. Its Pi integration is currently not installed. |

Local evidence: [shared tooling](README.md), [rules installer](agents/install), [skill installer](skills/install), [Claude routing policy](claude/skills/delegate/SKILL.md), [feature implementer](claude/agents/feature-implementer.md), [mechanical editor](claude/agents/mechanical-editor.md), [PR workflow](skills/babysit-pr/SKILL.md), and [herdr config](../herdr/.config/herdr/config.toml). Machine-specific observations came from selected non-secret fields in `~/.claude/settings.json`, `~/.codex/config.toml`, installed plugin metadata, and `herdr integration status`. Configuration establishes availability and intended behavior, not frequency of actual use.

Pi's [skills documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md) confirms shared-directory discovery, explicit `/skill:name` invocation, collision handling, and support for `disable-model-invocation`. Audit manual-only skills instead of assuming all frontmatter fields have the same meaning. Your existing `~/.pi/agent/skills` also contains AWS copies and some shared links, so check for duplicate or stale definitions before enabling a trial.

Pi's [core design](https://github.com/earendil-works/pi/tree/main/packages/coding-agent#philosophy) leaves MCP, subagents, and permission popups to extensions or external infrastructure. Your current Claude allow/deny rules and Codex approval settings therefore do not transfer as enforcement. This matters directly to your read-only production investigations and explicit database-execution approval rule. A Git worktree isolates changes; it does not restrict credentials or network access.

The [extension API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) supplies lifecycle events, mutable tool-call inputs, blocking, and persistent extension state. These are useful building blocks for your RTK/CodeGraph hooks and CI watchers, but their existence is not proof that a specific port is reliable.

Nate's repository at commit `18e515a0549132a44bc93fba9ffcd0b4e162e4ce` reinforces the coexistence approach. His [Pi settings](https://github.com/nateberkopec/dotfiles/blob/18e515a0549132a44bc93fba9ffcd0b4e162e4ce/files/home/.pi/agent/settings.json) use `openai-codex` directly, default to Astra at low thinking, and assign different models/efforts to worker, scout, and reviewer roles. Seven pinned packages provide MCP, subagents, web access, side questions, fast mode, guidance, and sound. His [tool installation](https://github.com/nateberkopec/dotfiles/blob/18e515a0549132a44bc93fba9ffcd0b4e162e4ce/files/home/.config/mise/config.toml) retains Claude and Codex alongside Pi and shares instruction/skill sources. Borrow that ownership and pinning pattern. Your existing `ai/` layout is already a suitable source of truth.

His custom [conversation title extension](https://github.com/nateberkopec/dotfiles/blob/18e515a0549132a44bc93fba9ffcd0b4e162e4ce/files/home/.pi/agent/extensions/conversation_title.ts) adds active-tool/progress information; his [generation statistics extension](https://github.com/nateberkopec/dotfiles/blob/18e515a0549132a44bc93fba9ffcd0b4e162e4ce/files/home/.pi/agent/extensions/toksec/index.ts) makes model performance visible. Those illustrate useful customization. They do not demonstrate faster completion or better reviews on your workload. Keep such extensions optional until they solve a concrete inconvenience. His [guidance package](https://github.com/nateberkopec/pi-openai-guidance/blob/b9e9507ece945fc1dd71d1e838a75fe794576d83/README.md) documents an audit against Pi 0.84.4 while the dotfiles pin 0.85.1; do not infer tested compatibility from installation pins alone.

The adapter he pins, [pi-mcp-adapter 2.32.1](https://github.com/nicobailon/pi-mcp-adapter/blob/v2.32.1/README.md), supports stdio and HTTP and an explicit `/mcp setup` import with source selection and preview. Host-specific automatic discovery is disabled by default. Its [OAuth implementation](https://github.com/nicobailon/pi-mcp-adapter/blob/v2.32.1/OAUTH.md) supplies PKCE, refresh, and OS credential storage. That is a plausible migration path for your service mix; none of your accounts was tested through it.

His pinned subagent package supports [external CLI profiles](https://github.com/nicobailon/pi-subagents/blob/v0.64.0/docs/tool-reference.md#external-cli-agent-profiles). They are asynchronous one-shot processes with output/status and cancellation, but lack the native runner's model/skill/context inheritance and steering/resume behavior unless implemented separately. This can launch Codex, but the inspected Nate configuration does not use it as a Codex CLI controller. The package also has a [herdr integration](https://github.com/nicobailon/pi-subagents/blob/v0.64.0/docs/extension-api.md#herdr-integration) for asynchronous activity and blocked state, which is useful for your setup without adding another notifier.

There are two distinct meanings of using Pi with Codex:

| Route | What runs | Practical consequence |
| --- | --- | --- |
| Pi with the `openai-codex` provider | Pi's tools, context, session handling, and agent loop call the OpenAI provider | One configurable workspace and model switching. Codex CLI settings, memories, review mode, hooks, and app integrations are not inherited. |
| Pi delegates a task to native Codex | Pi starts a Codex process or connects to Codex app-server | Retains the native Codex execution path, subject to launch configuration. Requires explicit task/status/cancellation/result handling and keeps two separate contexts. |

[Pi provider documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md) describes ChatGPT subscription login for its OpenAI Codex provider. [OpenAI's non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode) documents `codex exec --json`, including structured lifecycle events. [Codex app-server](https://learn.chatgpt.com/docs/app-server) provides a richer protocol for threads, turns, approvals, and tools. For a first integration, a bounded native review is enough; build an app-server bridge only if interactive steering and approval handling are actually needed. Do not have the outer model automatically approve a child request that was intended for the human.

For your workflow, use Pi directly for selected local tasks, keep native Codex as an independent reviewer, and keep Claude Code available for its integrated plugins and established delegated work. Add a persistent controller only after the simple trial demonstrates a benefit. Nesting an agent merely to forward every task adds another context and another failure boundary.

Billing also needs a real check. Pi documents Claude subscription login as drawing from extra usage. Anthropic's [authentication guidance](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account) allows third-party usage to be charged against usage credits. Its separate [Agent SDK notice](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) says the June SDK billing change was paused. Direct Pi-provider usage and delegating to native Claude Code are different paths; do not budget them as interchangeable or assume your Opus/Sonnet/Haiku usage remains covered in the same way. Your account's actual billing behavior was not tested.

A trial should answer whether Pi reduces your effort on work you already do. It should not begin by recreating every installed plugin.

1. Keep the configuration in `dotfiles/ai/`, retain the existing shared skill sources, add only Pi's entrypoint/settings and herdr integration, and pin extensions. Select the same available model and comparable effort when evaluating harness differences.
2. Run a scoped PHP change using the Makefile commands, a findings-only review against a known commit, and a Portal/CLI task. Record manual corrections, missing context, elapsed time, and actual usage. Use comparable clean checkouts so the second run does not inherit the first run's edits.
3. Connect the minimum MCP set for one read-only investigation. Exercise at least one remote OAuth service and one stdio service. Confirm expired-auth recovery without changing identities or endpoints.
4. Reproduce one tiered delegation and one PR-watching cycle. Verify the actual diff, exact reviewed SHA, cancellation, restart behavior, and return of background results. Keep the existing native path available where Pi lacks parity.
5. Decide after several real tasks. Promote Pi if it completes them with no missing required checks and less manual coordination. Stop expanding the setup if extension maintenance and repeated context handoffs outweigh the interface benefits. No credible speed, quality, or cost percentage is established by the current inspection.

The likely benefit for you is control over model routing, context, and tool presentation. The likely cost is owning integrations currently supplied by Claude/Codex. Your CLI-based skills are well suited to a trial; your production and asynchronous workflows deserve separate validation before becoming dependent on it.

For herdr, my recommendation is silent OS banners for background agents finishing or requesting input. Your existing `terminal-notifier` installation supports a click back to the detected hosting terminal. In-app toasts are an alternative if you prefer no desktop banners, but are less useful while working in another app. [Herdr notification configuration](https://herdr.dev/docs/configuration/#notifications) documents delivery modes and active-tab suppression; [the config reference](https://herdr.dev/docs/config-reference/) documents the delay and sound controls.

Proposed configuration, not applied:

```toml
[ui.toast]
delivery = "system"
delay_seconds = 2

[ui.sound]
enabled = false
```

The two-second delay is a preference to filter brief state transitions. macOS notification permissions and terminal focus behavior still need one live visual check. Keep herdr as the notification owner; do not copy Nate's separate Pi notification package into this setup.

Completed separately: removed Claude's custom Notification sound/bell hook, Codex's top-level `notify` entry, and the orphaned `notify-codex` script. Parsed and compared the resulting JSON/TOML to backups to confirm all other settings, including herdr integration hooks, were preserved. Existing agent processes may need restarting to load the change. Herdr sound configuration remains unchanged pending selection of the visual behavior.
