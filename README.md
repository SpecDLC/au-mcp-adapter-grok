---
type: au.engine.readme::au-engine
tldr: The Grok adapter for the au-mcp kernel. It bridges tools, lifecycle hooks, transcripts, and generated skills and rules.
---

# Repo Overview

## General Context

`arsumbris` is a framework for agentic knowledge work.

- `au-engine` serves the graph of typed workspace files.
- `au-host` is the framework's UI.
- `au-mcp` is the agent layer's kernel daemon.
- `au-mcp-sdk` defines the contract between the kernel, plugins, and adapters.
- `au-mcp-core` supplies the baseline tools and governance.

## What this is

`au-mcp-adapter-grok` is the **Grok** adapter for the `au-mcp` kernel.
It declares Grok's native tools and translates between Grok and the daemon.
Tool policy lives in the daemon and its plugins.

### What it binds

- **The MCP server** (`src/mcp-server.ts`) exposes the daemon's tools under `au`. Grok catalogs them as `au__<tool>` and the model calls them through `use_tool`.
- **The hook bridge** (`src/bridge.ts`, `hooks/`) connects lifecycle events and mediation. Hook stdin is camelCase. `PreToolUse` can deny or ask. `SessionStart` stdout is not model context.
- **The transcript lifter** (`src/lift.ts`) reads `updates.jsonl` and replays it on resume.
- **The launch surface** (`bin/launch.ts`) generates skills and rules, registers this repo on `[plugins].paths`, and prints one JSON launch for interactive `grok --trust`.

The adapter declares its discoverable `mcp.adapter.grok` node and launcher entries in `type/`.
Governed actions remain blocked when daemon communication or startup initialization fails.

## How to use this

Requires Node 24, the `grok` binary, and sibling `au-mcp`, `au-mcp-sdk`, and `au-engine-sdk` checkouts. Install with `pnpm install`. The arsumbris release itself is tested on macOS.

A launcher assembles the Grok invocation.

- The workspace's engine and MCP daemons must be running.
- `bin/launch.ts` takes `--workspace`, an absolute `--binary` path, and optional `--profile`, `--skills`, `--inject`, and `--resume`.
- It merges absolute plugin roots into `<workspace>/.grok/config.toml` `[plugins].paths`, writes `<workspace>/.grok/rules/au-inject-*.md`, and prints one JSON launch.
- The caller runs `command` in a terminal whose cwd is the workspace, or spawns `binary` with `argv` and `env`.
- `grok --trust` persists folder trust, which is what lets a project `[plugins].paths` entry load.

Grok keeps conversations and credentials in `GROK_HOME` (default `~/.grok`). This adapter does not relocate that directory and does not set `GROK_CONFIG`. `--plugin-dir` is not used: interactive `grok` does not accept it, and `grok agent` ignores it in leader mode.

Generated skill trees live under `~/.arsumbris/au-mcp/gen/`. The paths this launch owns are recorded in `<workspace>/.grok/au-mcp-adapter-grok.json` so the next launch can drop stale ones. A `.grok/config.toml` that cannot be parsed is left unchanged.

### Limits

- Skills and injects are workspace-scoped. The latest launch in that checkout wins.
- `SessionEnd` does not delete `au-inject-*` rules. The next launch replaces them.
- Rewriting `.grok/config.toml` drops comments in that file.
- A `PreToolUse` note reaches the model after the tool call. Deny and ask still apply before it.
- Computed session-start hook text stays on the daemon. Grok does not deliver `SessionStart` stdout to the model. Prepaid `mcp.inject` bodies travel as project rules instead.
- `allowed-tools` on a generated skill records the `au__` catalog key. Whether Grok treats that as a preapproval of `use_tool` is not verified here.

Gitignore the launch artifacts if you do not want them committed:

```
.grok/rules/au-inject-*.md
.grok/au-mcp-adapter-grok.json
```

The `[plugins].paths` entries are the opt-in and can stay in `.grok/config.toml`.

Resume through the same launcher with `--resume <session-id>` and the original workspace. The session id is the Grok UUID (`grok -r`).

Consumed as **TypeScript source**, with no build step.
Use `pnpm typecheck` and `pnpm test` for development checks.
Set `GROK_TEST_BINARY` to an absolute `grok` path to enable the optional runtime test.

## How to extend this

Keep Grok-specific translation in this adapter. Author reusable tools, hooks, skills,
and instructions against `au-mcp-sdk` and include their repositories in the workspace.
