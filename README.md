# Claude Account Switcher

OpenTUI manager for using multiple Claude Code subscription accounts on one machine while sharing the same Claude Code experience.

The goal is simple:

- `claude-work`, `claude-me`, and `claude-team` behave exactly like `claude`.
- Each profile draws Claude usage from its own logged-in Claude account.
- MCP servers, MCP OAuth, skills, plugins, settings, sessions, resumes, history, and project state are shared.
- Model names and Claude arguments are passed through unchanged.
- Normal alias commands route directly to the real Claude binary. No wrapper or proxy stays in the hot path.

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
claude-work --version       # Direct Claude launch with profile config
cca run-managed work -- mcp list
cca doctor
```

After `cca init`, source the generated shell file from `~/.zshrc`:

```sh
source "$HOME/.config/claude-account-switcher/aliases.zsh"
```

## Sync Model

Generated aliases use two paths:

- Normal commands: `CLAUDE_CONFIG_DIR=<profile> claude "$@"`
- MCP commands: `cca run-managed <profile> -- "$@"`

The managed path exists because MCP config and MCP OAuth need to merge back into shared state. Daily agent runs, resumes, prompts, and model calls do not go through a long-running wrapper.

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
