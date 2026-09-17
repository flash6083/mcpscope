# mcpscope — Architecture & Project Details

## 1. Goal

`mcpscope` is a local-first observability proxy for the Model Context Protocol (MCP). It wraps an MCP server process, passes JSON-RPC traffic through transparently, and emits OpenTelemetry spans for every request, response, and notification — following the official MCP semantic conventions.

**Core value:** Chrome DevTools' Network tab, but for MCP. Zero SaaS, zero account, zero code changes to the server.

## 2. Use Cases

| Use Case | Description |
|----------|-------------|
| **Local debugging** | Inspect MCP traffic between Claude Desktop / Cursor / Claude Code and your MCP server |
| **Performance profiling** | Identify slow tools, resource reads, or prompt fetches with latency histograms |
| **Error tracking** | Classify failures as `jsonrpc_error` or `tool_error` with full payload context |
| **Trace correlation** | Propagate W3C trace context through MCP to correlate with downstream services |
| **OTLP export** | Ship spans to Jaeger, Tempo, Datadog, or any OpenTelemetry backend |
| **Replay & testing** | (Planned) Re-execute tool calls with edited parameters for regression testing |

## 3. Novelty Factor

Unlike existing tools:

- **MCP Inspector** forces a separate test client. `mcpscope` works with your **actual client** (Claude Desktop, Cursor, Claude Code).
- **mcp-recorder** is CI replay only. `mcpscope` is a live proxy with a real-time dashboard.
- **Sentry / Datadog** are SaaS-bound and require code changes. `mcpscope` is local-first, zero-config, and open-source.
- **Bifrost / Portkey** are enterprise gateways with auth overhead. `mcpscope` is a lightweight single-binary CLI.

The key innovation is **transparent stdio interception** combined with **OpenTelemetry semantic conventions** specifically for MCP — no other tool bridges these two worlds.

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Clients                                    │
│  Claude Desktop │ Cursor │ Claude Code │ MCP Inspector │ curl       │
└───────┬─────────────────────────────────────────────────────────────┘
        │ stdio (stdin/stdout) or HTTP
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        mcpscope Proxy                               │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Frame Parser    │───▶│ Interceptor      │───▶│ Span Builder  │  │
│  │ (Transform      │    │ (pair req+resp,  │    │ (OTel span    │  │
│  │  stream)        │    │  inject trace)   │    │  attributes)  │  │
│  └─────────────────┘    └─────────────────┘    └──────┬────────┘  │
│        │                       │                       │           │
│        ▼                       ▼                       ▼           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ Raw Frame Store │    │ Span Processor  │    │ W3C Context   │  │
│  │ (SQLite)        │    │ (SQLite + OTLP) │    │ Inject/Extract│  │
│  └─────────────────┘    └─────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
        │                       │
        │ stdio                 │ HTTP (port 7878)
        ▼                       ▼
┌─────────────────┐    ┌──────────────────────────────────────────┐
│ Upstream MCP    │    │ Dashboard (Fastify + React)               │
│ Server          │    │  ┌────────────────────────────────────┐  │
│                 │    │  │ Timeline │ Tools │ Sessions        │  │
│ server-everything│   │  │ (live SSE, filters, detail view)    │  │
│ filesystem      │    │  └────────────────────────────────────┘  │
└─────────────────┘    └──────────────────────────────────────────┘
                                     │
                              dev: localhost:5173
                              prod: localhost:7878
```

## 5. Low-Level Data Flow

### Stdio Transport

```
Client → mcpscope → Upstream Server
    │          │            │
    │          │            │
    │          │            │
    ▼          ▼            ▼
 stdin    parser      child.stdin
          (Transform
           stream)
          │
          ├─▶ onFrame("client→server", frame)
          │     ├─ inject traceparent into params._meta
          │     ├─ persist raw_frames to SQLite
          │     └─ store pending request (id → startTime)
          │
          ▼
       child.stdout
          │
          └─▶ parser
                │
                ├─▶ onFrame("server→client", frame)
                │     ├─ persist raw_frames to SQLite
                │     └─ pair with pending request by id
                │           └─▶ buildSpan(sessionId, request, response, startTime, endTime)
                │                 ├─ create OTel span with MCP attributes
                │                 ├─ classify outcome (OK / jsonrpc_error / tool_error)
                │                 ├─ write span to SQLite via SpanExporter
                │                 └─ emit event to SSE bus
                │
                ▼
             process.stdout (pass-through)
```

### HTTP Transport

```
Client → mcpscope (localhost:8989) → Upstream Server (http://...)
    │          │                            │
    │          │                            │
    ▼          ▼                            ▼
 HTTP     Fastify proxy              HTTP client
          │
          ├─▶ intercept request
          │     ├─ inject traceparent header (W3C)
          │     └─ forward to upstream
          │
          ├─▶ intercept response
          │     └─ pair with request
          │           └─▶ buildSpan(...)
          │
          ▼
       HTTP response
```

## 6. Component Details

### JSON-RPC Parser (`src/jsonrpc/`)
- **Purpose**: Line-delimited JSON frame parser. Transforms a raw byte stream into structured JSON-RPC messages.
- **Design**: `Transform` stream that buffers until newline, parses with zod, passes raw bytes through unchanged.
- **Key invariant**: Preserves upstream whitespace and key ordering — no re-serialization.

### MCP Layer (`src/mcp/`)
- **methods.ts**: Enum of well-known methods (`initialize`, `tools/list`, `tools/call`, `resources/read`, etc.)
- **semconv.ts**: Constants for MCP semantic conventions (`mcp.method.name`, `gen_ai.operation.name`, etc.)
- **error-mapping.ts**: Classifies responses into `OK`, `jsonrpc_error`, or `tool_error`.

### Proxy (`src/proxy/`)
- **stdio.ts**: Spawns child process, pipes stdin/stdout through parser, manages pending request map, triggers span building.
- **interceptor.ts**: Shared frame-tapping logic. (Currently merged into stdio.ts for simplicity.)

### OpenTelemetry (`src/otel/`)
- **tracer.ts**: Initializes `BasicTracerProvider` with resource attributes (`service.name=mcpscope`, `service.version`). Registers SQLite and optional OTLP span processors.
- **span-builder.ts**: Creates spans with correct attributes:
  - Name: `{method} {target}` (e.g., `tools/call echo`)
  - Kind: `CLIENT`
  - Attributes: `mcp.method.name`, `mcp.protocol.version`, `mcp.session.id`, `gen_ai.operation.name`, etc.
  - Status: derived from error mapping
- **context.ts**: W3C trace context injection into `_meta.traceparent` for stdio transport.
- **exporters/sqlite.ts**: Custom `SpanExporter` that writes spans to SQLite.
- **exporters/otlp.ts**: Wraps `OTLPTraceExporter`, gated on `OTEL_EXPORTER_OTLP_ENDPOINT`.

### Store (`src/store/`)
- **db.ts**: Opens `better-sqlite3` with WAL mode, runs migrations on open.
- **schema.sql**: Creates `sessions`, `spans`, and `raw_frames` tables with indexes.
- **queries.ts**: Prepared statements for inserts and queries.

### Server (`src/server/`)
- **app.ts**: Fastify factory with CORS for localhost:5173.
- **routes.ts**: `/api/spans` (filterable), `/api/sessions`, `/api/tools`.
- **sse.ts**: `/api/events` SSE endpoint for live span streaming.
- **static.ts**: Serves `dist/assets/` for production dashboard.

### Dashboard (`src/dashboard/`)
- **Tech**: Vite + React 19 + Tailwind v4 (`@tailwindcss/vite` plugin)
- **Pages**: Timeline (live span table), Tools (tool catalog), Sessions (session list)
- **State**: Plain React `useState` / `useEffect`. No router yet.
- **Styling**: Tailwind utility classes. No shadcn/ui yet (plain components).

## 7. Tech Stack

| Layer | Technology | Reasoning |
|-------|-----------|-----------|
| **Language** | TypeScript 5.7 | Type safety, excellent OTel SDK support, familiar ecosystem |
| **Runtime** | Node.js 22+ LTS | Latest LTS, native ESM, `child_process` stdio support |
| **Package manager** | pnpm | Efficient disk usage, strict peer dep resolution, React 19 friendly |
| **Bundler** | tsup | esbuild-based, fast, simple config, ESM output |
| **MCP SDK** | `@modelcontextprotocol/sdk` | Official SDK, zod v4 peer dep |
| **Validation** | zod 4.4 | Runtime schema validation, type inference |
| **OTel API** | `@opentelemetry/api` 1.9 | Stable API surface |
| **OTel SDK** | `@opentelemetry/sdk-trace-base` 2.10 | Stable trace pipeline |
| **OTel Semconv** | `@opentelemetry/semantic-conventions` 1.43 | MCP attributes under `/incubating` |
| **OTLP Exporter** | `@opentelemetry/exporter-trace-otlp-http` 0.221 | Primary exporter for Jaeger/Tempo/Datadog |
| **Database** | `better-sqlite3` 13.0 | Prebuilt `darwin-arm64` binary, synchronous API, no server process |
| **HTTP Server** | Fastify 5.12 | High performance, low overhead, good SSE support |
| **CLI** | Commander 15.0 | Familiar, zero-dependency, good subcommand support |
| **Logger** | pino 10.3 | Fast, low overhead, `destination: 2` for stderr |
| **Frontend** | React 19 + Vite 8 | Modern React, fast HMR, simple config |
| **CSS** | Tailwind v4 + `@tailwindcss/vite` | No PostCSS config needed, Vite plugin |
| **Testing** | Vitest 4.1 | Fast, ESM-native, good TypeScript support |
| **Linting** | Biome | Single tool for lint + format, fast |
| **Icons** | lucide-react | Tree-shakable, consistent design |

## 8. Key Design Decisions

### Single-package repo
Simplifies npm publish and local development. The dashboard is built into `dist/assets/` and served statically — no separate `packages/` workspace needed.

### NodeNext vs Node16 module resolution
Initially used `"module": "NodeNext"` with `.js` extensions in imports. This caused esbuild resolution failures with tsup. Switched to `"module": "Node16"` with bare imports (no extensions) for reliable bundling.

### Inline span processor
Instead of `BatchSpanProcessor`, uses a minimal inline processor that calls `exporter.export([span], () => {})` synchronously on `onEnd`. This is simple but not optimal for high throughput. A `BatchSpanProcessor` would buffer and flush asynchronously.

### SQLite WAL mode
`journal_mode = WAL` enables concurrent reads during writes, which is important for the dashboard querying spans while the proxy is writing them.

### pino to stderr
Stdout is the MCP wire. Any write to stdout (including `console.log` or unsuppressed pino output) corrupts the JSON-RPC stream and causes client disconnection.

### Span naming convention
`{mcp.method.name} {target}` where target is the tool name for `tools/call`, URI for `resources/read`, empty otherwise. This makes spans immediately identifiable in Jaeger or the dashboard.

### Privacy by default
`MCPSCOPE_CAPTURE_PAYLOADS=none` means request/response bodies are never stored. Opt-in with `truncated` (1KB) or `full` for debugging.

## 9. Performance Considerations

- **16GB RAM**: Docker is optional. SQLite is lightweight (~10MB for thousands of spans). Use `otel-desktop-viewer` via Homebrew instead of Jaeger if memory is constrained.
- **Streaming**: The frame parser is a `Transform` stream. No full-buffer parsing. Bytes pass through unchanged.
- **SQLite transactions**: Prepared statements are used, but batch inserts could be wrapped in `db.transaction()` for ~100× speedup on bulk ingestion.
- **Span flush**: `SIGINT`/`SIGTERM` handlers call `shutdownTracer()`. In tests, `InMemorySpanExporter` avoids hanging processes.

## 10. Security & Privacy

- **No network by default**: The proxy only listens on `localhost:7878`. No external exposure.
- **Opt-in payload capture**: Bodies are not stored unless `MCPSCOPE_CAPTURE_PAYLOADS` is set.
- **No auth**: Localhost-only. If you need auth, put it behind a reverse proxy.
- **Secrets**: No API keys, tokens, or credentials are logged. If payload capture is enabled, they may appear in the database — treat `~/.mcpscope/` as sensitive.

## 11. Distribution

- **npm package**: `mcpscope` (single binary + bundled dashboard)
- **Install**: `npm install -g mcpscope` or `npx mcpscope@latest`
- **Files shipped**: `dist/cli.js`, `dist/assets/`, `README.md`, `LICENSE`
- **Bin**: `dist/cli.js` with shebang `#!/usr/bin/env node`

## 12. Comparison with Alternatives

| Tool | Approach | Requires code changes | Local-first | OTel support | Live dashboard |
|------|----------|----------------------|-------------|--------------|----------------|
| **mcpscope** | Transparent stdio proxy | No | Yes | Yes | Yes |
| MCP Inspector | Separate test client | No | No | No | Basic |
| mcp-recorder | CI replay | No | No | No | No |
| Sentry/Datadog | SDK instrumentation | Yes | No | Yes | SaaS |
| Bifrost/Portkey | Enterprise gateway | Yes | No | Partial | Yes |

## 13. Roadmap

### Completed
- [x] Phase 1: Foundation (parser, store, CLI)
- [x] Phase 2: Core proxy + OTel tracing
- [x] Phase 3: HTTP API + dashboard
- [x] Phase 4: OTLP exporter + tests

### Next
- [ ] `wrap-http` transport (Streamable HTTP)
- [ ] Replay endpoint (`POST /api/replay/:span_id`)
- [ ] `BatchSpanProcessor` for async export
- [ ] SSE event emission from SQLite exporter
- [ ] shadcn/ui components + dark mode
- [ ] React Router for navigation
- [ ] W3C trace context for HTTP transport
- [ ] End-to-end test with Jaeger
- [ ] `npm publish`

## 14. Contributing

1. Fork and clone
2. `pnpm install`
3. Make changes
4. `pnpm build && pnpm test`
5. Open a PR

## 15. License

MIT
