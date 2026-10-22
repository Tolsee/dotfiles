# dotfiles

Configs for my machine.

## AI tooling

All agent-related configuration lives under [`ai/`](ai/README.md): shared
agent rules, Claude defaults, MCP definitions, and reusable skills. Run
`./setup` to install the shared rules, MCP configuration, and skills. Run
`./ai/skills/install` when you only need to refresh the skills.

## Tests

`./test` runs every check: shellcheck, config parsing, the herdr keymap check, the
`herdr-task` / `herdr-status` tests (fake herdr, no server), the vim-mode fzf defaults, and
the aws and mcps tests. `./test herdr fzf` runs some. Checks whose tool is missing are
skipped locally; CI (`.github/workflows/test.yml`) installs everything and runs with
`TEST_STRICT=1`, so nothing is skipped there.

## Inspiration

- NVIM: https://github.com/ThePrimeagen/.dotfiles
