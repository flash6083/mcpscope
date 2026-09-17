# mcpscope

Local observability for [Model Context Protocol](https://modelcontextprotocol.io/)
traffic. `mcpscope` wraps an MCP server without requiring code changes, records
JSON-RPC frames and OpenTelemetry-style spans in SQLite, and serves a local
dashboard for inspecting latency, tools, sessions, and errors.

## Highlights

- Transparent stdio proxy for local MCP servers
- Streamable HTTP proxy for remote MCP servers
- SQLite persistence with no hosted service or account
- Live Timeline, Tools, and Sessions views
- Optional OTLP trace export
- Payload capture disabled by default
- Works as a standalone npm CLI

## Install

```bash
npm install --global mcpscope
```

The package requires Node.js 22 or newer.

## Quick start: stdio MCP server

Wrap a local or `npx`-started MCP server:

```bash
mcpscope wrap -- npx -y @modelcontextprotocol/server-everything stdio
```

Open the dashboard at [http://localhost:7878](http://localhost:7878).
Configure your MCP client to launch the same `mcpscope wrap -- ...` command
instead of launching the upstream server directly.

## Quick start: Streamable HTTP MCP server

Start a local proxy for an HTTP MCP endpoint:

```bash
mcpscope wrap-http https://example.com/mcp --port 8989
```

Point the MCP client at [http://localhost:8989/mcp](http://localhost:8989/mcp).
The dashboard and API are served from the same local port.

## Local development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Run the locally built CLI:

```bash
node dist/cli.js wrap -- npx -y @modelcontextprotocol/server-everything stdio
```

## Storage and configuration

By default, data is stored in:

```text
~/.mcpscope/scope.db
```

Supported environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCPSCOPE_DB` | `~/.mcpscope/scope.db` | SQLite database path |
| `MCPSCOPE_CAPTURE_PAYLOADS` | `none` | `none`, `truncated`, or `full` |
| `MCPSCOPE_LOG_LEVEL` | `info` | Pino log level |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Optional OTLP/HTTP base endpoint |

Payload capture is opt-in because MCP payloads can contain prompts, files,
credentials, or proprietary data.

## Documentation

- [Getting started](./GETTING_STARTED.md) — setup, MCP client configuration,
  dashboard use, and troubleshooting
- [Architecture](./ARCHITECTURE.md) — runtime components and data flow
- [Changelog](./CHANGELOG.md) — release history

## Project status

The package is currently in early development. The stdio and Streamable HTTP
proxy paths, local dashboard, SQLite storage, and basic OTLP export are
implemented. See [STATUS.md](./STATUS.md) for the current implementation
snapshot and known limitations.

## License

MIT
