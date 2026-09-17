# mcpscope — Implementation Status

## What was built

`mcpscope` is a local-first observability proxy for the Model Context Protocol (MCP). It wraps an MCP server process, passes JSON-RPC traffic through transparently, and emits OpenTelemetry spans for every request, response, and notification. Spans are stored in a local SQLite database and exposed over a Fastify HTTP API. A built-in dashboard provides live timeline viewing.

## Architecture

```
┌─────────────┐     stdio      ┌──────────────┐     stdio     ┌─────────────┐
│ Client      │ ──────────────→│ mcpscope     │ ─────────────→│ Upstream    │
│ (Claude,    │ ←──────────────│ (proxy +     │ ←─────────────│ MCP Server  │
│  Inspector) │                │  otel + db)  │               │             │
└─────────────┘                └──────────────┘               └─────────────┘
                                        │
                                        │ HTTP (port 7878)
                                        ▼
                               ┌──────────────────┐
                               │ Dashboard         │
                               │ (Vite + React)    │
                               │ localhost:5173    │
                               └──────────────────┘
```

## Implementation summary

### Phase 1 — Foundation
- **Repo bootstrap**: Single-package structure with pnpm, tsup, vitest, Biome, Vite, React, Tailwind v4.
- **JSON-RPC parser**: Line-delimited frame parser (`Transform` stream) with zod validation. Forwards raw bytes unchanged.
- **MCP layer**: Well-known methods enum, semantic-convention constants (`mcp.method.name`, `mcp.protocol.version`, `mcp.session.id`, `mcp.resource.uri`), error mapping (`jsonrpc_error` vs `tool_error`).
- **SQLite store**: `better-sqlite3` with WAL mode. Schema includes `sessions`, `spans`, and `raw_frames` tables with indexes.
- **Logging**: `pino` → stderr only (`destination: 2`). No stdout writes.
- **CLI**: `commander` with `wrap`, `wrap-http`, and `dashboard` subcommands.

### Phase 2 — Core Proxy + Tracing
- **Stdio proxy**: `spawn()` child, pipe stdin/stdout through parser, tap every frame.
- **OTel tracer**: `BasicTracerProvider` with resource attributes (`service.name=mcpscope`, `service.version`).
- **Span builder**: Builds spans from paired request+response with correct attributes, span kind (`CLIENT`), namespaced target (`{method} {tool_name}`), and status.
- **W3C context**: Injects `traceparent` into `_meta.traceparent` for stdio transport.
- **SQLite exporter**: Custom `SpanExporter` that writes spans to SQLite.

### Phase 3 — HTTP API + Dashboard
- **Fastify server**: Port 7878, CORS for localhost:5173.
- **Routes**: `GET /api/spans` (filterable), `GET /api/sessions`, `GET /api/tools`, `GET /api/events` (SSE).
- **Dashboard**: React 19 + Tailwind v4. Pages: Timeline, Tools, Sessions. Live span table, tool catalog with latency, session list.
- **Dev mode**: `pnpm dev` starts Vite dev server on port 5173 with proxy to backend.

### Phase 4 — OTLP + Polish
- **OTLP exporter**: Gated on `OTEL_EXPORTER_OTLP_ENDPOINT`. Uses `@opentelemetry/exporter-trace-otlp-http`.
- **Tests**: Vitest for error mapping, JSON-RPC parser, and span builder. 7 tests passing.
- **Dashboard build**: `pnpm exec vite build` produces assets into `dist/assets/` for production serving.

## What works now

### `mcpscope wrap -- <cmd>`
Spawns the given command as a child process, proxies stdin/stdout, and:
- Persists every JSON-RPC frame to `~/.mcpscope/scope.db`
- Builds OTel spans for each request/response pair
- Stores spans in SQLite with full attributes
- Starts an in-process Fastify server on port 7878 for the dashboard

### `mcpscope dashboard`
Starts the Fastify server standalone for viewing previously captured data.

### `mcpscope wrap-http <url>`
Starts a Streamable HTTP proxy on port 8989 by default. The local proxy uses
the same path as the upstream URL, forwards MCP session headers, injects a
W3C `traceparent` header, and supports JSON and SSE responses.

### Dashboard (`pnpm dev`)
- Timeline page: live-updating span table
- Tools page: tool catalog with call counts and average latency
- Sessions page: session list with upstream command
- SSE endpoint (`/api/events`) for live span streaming

### SQLite queries
Direct DB access for inspection:
```bash
sqlite3 ~/.mcpscope/scope.db "SELECT method, COUNT(*) FROM raw_frames GROUP BY method;"
sqlite3 ~/.mcpscope/scope.db "SELECT name, kind, status FROM spans ORDER BY start_time DESC LIMIT 10;"
```

## What's not implemented yet

- **Streamable HTTP transport**: The proxy currently supports POST/GET/DELETE
  on the upstream URL path. It does not yet support replay or arbitrary
  endpoint path rewriting.
- **Replay**: `POST /api/replay/:span_id` not implemented.
- **W3C trace context for HTTP**: A valid `traceparent` header is forwarded or
  generated for each proxied request; full parent/child OTel propagation is
  still a future improvement.
- **OTLP export**: Code exists but is gated behind env var; not tested end-to-end.
- **Frontend polish**: No shadcn components, no dark mode, no router. Basic plain-React UI only.
- **Span flush on exit**: `SIGINT`/`SIGTERM` handlers call `shutdownTracer()`, but the inline span processor may not flush last spans in all cases.
- **Dashboard build into dist**: Dashboard assets are resolved relative to the
  installed CLI module, so invoking the CLI outside the project root is
  supported.

## Prerequisites

- **Node.js**: 22+ (tested with v22.20.0)
- **Package manager**: pnpm (use `corepack enable` then `corepack prepare pnpm@latest --activate`)
- **better-sqlite3**: Prebuilt `darwin-arm64` binary ships automatically on Apple Silicon
- **MCP server for testing**: `npx @modelcontextprotocol/server-everything` (stdio)

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCPSCOPE_DB` | `~/.mcpscope/scope.db` | SQLite database path |
| `MCPSCOPE_CAPTURE_PAYLOADS` | `none` | `none`, `truncated` (1KB), or `full` |
| `MCPSCOPE_LOG_LEVEL` | `info` | pino log level |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Enable OTLP export when set |

## Validation commands

```bash
cd /Users/sayakbhattacharya/Projects/Personal/mcpscope

pnpm build          # tsup compiles to dist/cli.js
pnpm test           # vitest runs 7 tests
pnpm dev            # starts dashboard dev server on port 5173
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
sqlite3 ~/.mcpscope/scope.db "SELECT method, COUNT(*) FROM raw_frames GROUP BY method;"
curl http://localhost:7878/api/spans | jq '. | length'
curl -N http://localhost:7878/api/events
```

## Key implementation notes

- **Module resolution**: Using `"module": "Node16"` with `"moduleResolution": "Node16"` to avoid ESM `.js` extension issues with esbuild. All internal imports are bare (no `.js` extension).
- **Stdout hygiene**: pino uses `destination: 2` (stderr). Any unsuppressed stdout write would corrupt the MCP JSON-RPC wire.
- **Span flush on exit**: `SIGINT`/`SIGTERM` handlers call `shutdownTracer()` and `db.close()`.
- **OTLP path**: Exporter appends `/v1/traces` to the base URL. Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, not the full path.
- **SQLite transactions**: Batch inserts are prepared statements; no explicit `db.transaction()` wrapper yet (could be added for bulk ingestion).
- **Tailwind v4**: No `postcss.config.js`. Uses `@tailwindcss/vite` plugin only.
- **Vitest cleanup**: Tests use `InMemorySpanExporter` instead of real span processors to avoid hanging processes.

## Known limitations

1. The stdio proxy holds a single `pendingRequests` map on the child process object. This is not robust to concurrent requests with the same ID from different sources.
2. The SQLite exporter is called synchronously from `onEnd`. With high throughput, this could block the event loop. A real `BatchSpanProcessor` would be better.
3. The dashboard is a minimal MVP. No pagination, no search, no error boundaries.
4. `wrap-http` supports the MCP Streamable HTTP request/response flow at the
   upstream URL path. It forwards JSON and SSE responses and records JSON-RPC
   traffic, but does not yet proxy arbitrary subpaths.
5. Replay is not implemented.

## Next steps

1. Add replay endpoint (`POST /api/replay/:span_id`).
2. Add proper `BatchSpanProcessor` instead of inline synchronous export.
3. Wire up SSE event emission from the SQLite exporter.
4. Add shadcn/ui components and polish the dashboard.
5. End-to-end test with Jaeger or otel-desktop-viewer.
6. `npm publish` after verifying the package tarball.
