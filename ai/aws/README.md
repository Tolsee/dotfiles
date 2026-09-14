# AWS Agent Toolkit

Reusable AWS MCP and skill setup for local coding agents, authenticated through
aws-vault. Account aliases, SSO details, role names, and workload regions stay in
local configuration outside this repository.

## Local setup

Requires AWS CLI v2 with Agent Toolkit, aws-vault, Python 3.9+, and
[uv](https://docs.astral.sh/uv/getting-started/installation/) (including uvx).
Start with existing SSO source profiles in `~/.aws/config`.

Create `~/.config/aws-agent/settings.json` with the source profile aliases and
permission-set names approved for agent use. The following names are fictional:

```json
{
  "accounts": {
    "example-sandbox": "ExampleReadRole",
    "example-live": "ExampleReadRole"
  }
}
```

Keep this file private and outside git. `AWS_AGENT_SETTINGS` overrides its path;
otherwise it follows `XDG_CONFIG_HOME`. Region and identity details are read from
the existing AWS profiles (`AWS_CONFIG_FILE` is respected).

```bash
./ai/aws/profiles.py
./ai/aws/install example-sandbox
./ai/agents/install devin
```

The profile installer appends `<alias>-agent` SSO profiles for the local mapping.
It backs up the original AWS config and refuses conflicting aliases. The AWS
installer verifies identity, configures MCP, and refreshes the selected skill
allowlist. Its optional account argument selects only the setup/catalog session.
Toolkit APIs use the public service endpoint in `us-east-1`; workloads use their
local profile regions. No IAM resources or permission sets are created or changed.

Generic `./setup` does not register AWS on fresh installations and preserves an
existing AWS entry. To update only that entry, run
`uv run --script ./ai/aws/configure.py`.

## Multiple accounts in one session

Start the agent normally and name the accounts in the request, for example:

> Compare the RDS clusters in example-sandbox and example-live.

The agent uses each corresponding `<alias>-agent` in the `aws_profile` parameter
on separate MCP calls and labels the results by account. Every account-specific
call must include it; asynchronous task polls use their originating profile.
The agent asks only when the target account is ambiguous. No account-specific
launch command or restart between accounts is needed.

The upstream proxy uses the first installed profile to establish its connection.
Its per-call `aws_profile` parameter is optional upstream, so the shared rules
require explicit selection for account-specific operations. This requirement is
enforced by agent instructions. Shell account variables do not select task targets.
For direct CLI use, pass the target explicitly:

```bash
./ai/aws/access.py exec example-sandbox -- aws sts get-caller-identity
```

## Why the Python scripts exist

| Script | Purpose | When it runs |
| --- | --- | --- |
| `access.py` | Connect MCP to aws-vault, verify the issued account/role, and supply SDK credentials | MCP use or an explicit CLI command |
| `profiles.py` | Create agent aliases from private local settings | Setup |
| `configure.py` | Update only AWS MCP across clients, preserving unrelated settings | Setup |
| `link-skills.py` | Make shared AWS skills discoverable across clients | Skill installation/update |
| `test_*.py` | Verify routing, profile preservation, and configuration changes | Development tests |

The AWS SDK cannot directly read aws-vault's Keychain sessions. `access.py`
provides that integration through credential processes in a private temporary
SDK config. Issued credentials travel through pipes and environment variables,
not repository files. The `credentials` and `export` subcommands are SDK plumbing:
their stdout contains credentials and must never be shown in an agent transcript.
Use `exec ... -- aws sts get-caller-identity` for verification instead. The `exec`
helper is for bounded commands; use MCP for long-running sessions.

## Permissions and clients

The helper strips inherited credentials and verifies the issued identity against
the approved local account and role. Missing access never falls back to admin.
A role name alone does not establish read-only access; inspect its actual policies.
Shared instructions require task authorization for writes. An unrestricted shell
can still invoke human profiles, so this setup does not isolate the whole agent.

The targeted MCP installer supports installed Claude Code, Codex, Cursor, Gemini
CLI, Antigravity, Kiro, Windsurf, and Devin CLI, with private backups of existing
configurations. CODEX_HOME, CLAUDE_CONFIG_DIR, and XDG_CONFIG_HOME are respected.
Restart clients after changing the MCP command.

Pi discovers shared skills and uses the CLI helper or native agent handoffs;
Pi core has no MCP client. Hosted agents need their own environment setup.
The skill installer refreshes the selected allowlist and removes only excluded
AWS defaults listed in `skills`, preserving unrelated skills.

This adapts the [AWS setup guide](https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md)
to an existing aws-vault SSO workflow.

## Verification

```bash
uv run --with 'tomlkit>=0.13,<1' python -m unittest discover -s ai/aws -p 'test_*.py'
node --test ai/mcps/install.test.cjs
```
