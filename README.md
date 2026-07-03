# Claude Account Switcher

OpenTUI manager for using multiple Claude Code subscription accounts on one machine while sharing the same Claude Code experience.

The goal is simple:

- `claude-work`, `claude-me`, and `claude-team` behave exactly like `claude`.
- Each profile draws Claude usage from its own logged-in Claude account.
- MCP servers, MCP OAuth, skills, plugins, settings, sessions, resumes, history, and project state are shared.
- Model names and Claude arguments are passed through unchanged.

## Requirements

- macOS
- zsh
- Bun
- Claude Code CLI

## Develop

```sh
bun install
bun run verify
bun run src/index.tsx --help
```

Open the manager:

```sh
bun run start
```

## CLI

```sh
cca                         # Open the OpenTUI manager
cca init                    # Initialize config and shell integration
cca add work --alias claude-work
cca run work -- --version
cca doctor
```

After `cca init`, source the generated shell file from `~/.zshrc`:

```sh
source "$HOME/.config/claude-account-switcher/aliases.zsh"
```

## Sync Model

Profile-specific:

- Claude/Anthropic account OAuth
- first-party account, subscription, and usage metadata

Shared:

- MCP server config
- MCP OAuth
- plugins
- skills
- commands
- agents
- hooks
- settings
- sessions, resumes, history, projects, and tasks

## Verification

```sh
bun run verify
```
