# mcpscope — Getting Started

## Prerequisites

- **Node.js** 22+ (LTS). Install via fnm (recommended) or nvm:
  ```bash
  curl -fsSL https://fnm.vercel.app/install | bash
  fnm install 22
  fnm default 22
  ```
- **pnpm** via corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
- **better-sqlite3** ships a prebuilt `darwin-arm64` binary on Apple Silicon — no Xcode CLT needed.

## 1. Clone and install

```bash
git clone <your-repo-url>
cd mcpscope
pnpm install
```

## 2. Build

```bash
pnpm build
```

This compiles `src/cli.ts` via tsup into `dist/cli.js`, embeds the SQLite schema,
and builds the dashboard into `dist/assets/`. No manual file copying is required.

## 3. Run tests

```bash
pnpm test
```

7 vitest tests covering error mapping, JSON-RPC frame parsing, and span building.

## 4. Wrap an MCP server (stdio)

```bash
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
```

This:
1. Spawns `server-everything` as a child process.
2. Pipes stdin/stdout through the frame parser.
3. Persists every JSON-RPC frame to SQLite at `~/.mcpscope/scope.db`.
4. Builds OTel spans for each request/response pair.
5. Starts an in-process Fastify server on **port 7878**.

In another terminal, drive traffic with MCP Inspector or a client, then inspect:

```bash
sqlite3 ~/.mcpscope/scope.db "SELECT method, COUNT(*) FROM raw_frames GROUP BY method;"
curl http://localhost:7878/api/spans | jq '. | length'
curl -N http://localhost:7878/api/events
```

## 5. Start the dashboard (dev)

```bash
pnpm dev
```

Opens the Vite dev server at **http://localhost:5173** with a proxy to the backend at `http://localhost:7878`.

The dashboard shows:
- **Timeline**: live-updating table of spans
- **Tools**: tool catalog with call counts and average latency
- **Sessions**: session list with upstream command

The stdio wrapper publishes live span events to the dashboard while it is running.

## 6. Start the dashboard (production)

Build the CLI and dashboard assets:

```bash
pnpm build
```

Then start the server:

```bash
node dist/cli.js dashboard
```

Visit **http://localhost:7878** to see the bundled dashboard.

The dashboard assets are resolved relative to the installed CLI, so this command
also works when launched from outside the project directory.

## 7. Wrap an MCP server over Streamable HTTP

```bash
node dist/cli.js wrap-http http://localhost:3000/mcp --port 8989
```

Point your MCP client at `http://localhost:8989/mcp`. The proxy forwards
JSON-RPC requests, JSON responses, SSE responses, MCP session headers, and
`traceparent`, while recording traffic and spans in the same SQLite database.
The local dashboard/API is available on the proxy port.

## 8. OTLP export (optional)

To ship spans to Jaeger, Tempo, or Datadog:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
```

The OTLP HTTP exporter appends `/v1/traces` to the base URL automatically.

## 9. Payload capture (optional)

By default, request/response bodies are **not** captured. To enable:

```bash
export MCPSCOPE_CAPTURE_PAYLOADS=truncated   # 1KB max
# or
export MCPSCOPE_CAPTURE_PAYLOADS=full        # full payload (memory heavy)
```

## Project structure

```
mcpscope/
├── src/
│   ├── cli.ts                 # commander entry point
│   ├── log.ts                 # pino → stderr only
│   ├── config.ts              # env vars, defaults
│   ├── jsonrpc/
│   │   ├── schema.ts          # zod schemas
│   │   ├── parser.ts          # line-delimited JSON frame parser
│   │   └── types.ts           # TS types
│   ├── mcp/
│   │   ├── methods.ts         # well-known methods enum
│   │   ├── semconv.ts         # MCP attribute constants
│   │   └── error-mapping.ts   # OK / jsonrpc_error / tool_error
│   ├── proxy/
│   │   └── stdio.ts           # spawn child, pipe stdin/stdout, tap frames
│   ├── otel/
│   │   ├── tracer.ts          # BasicTracerProvider + exporters
│   │   ├── span-builder.ts    # build spans from request+response
│   │   ├── context.ts         # W3C trace context inject/extract
│   │   └── exporters/
│   │       ├── sqlite.ts      # SpanExporter → better-sqlite3
│   │       └── otlp.ts        # OTLP HTTP exporter (gated)
│   ├── store/
│   │   ├── db.ts              # better-sqlite3 wrapper + migrations
│   │   ├── schema.sql         # sessions + spans + raw_frames
│   │   └── queries.ts         # prepared statements
│   ├── server/
│   │   ├── app.ts             # Fastify factory, CORS
│   │   ├── routes.ts          # /api/spans, /api/sessions, /api/tools
│   │   ├── sse.ts             # GET /api/events SSE
│   │   └── static.ts          # serves dist/assets
│   ├── commands/
│   │   ├── wrap.ts            # mcpscope wrap -- <cmd>
│   │   ├── wrap-http.ts       # mcpscope wrap-http <url> (Streamable HTTP proxy)
│   │   └── dashboard.ts       # starts server, prints URL
│   └── dashboard/             # frontend — built to dist/assets/
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css
│           ├── lib/api.ts
│           ├── lib/sse.ts
│           ├── components/
│           │   ├── StatusBadge.tsx
│           │   ├── FilterBar.tsx
│           │   ├── TimelineTable.tsx
│           │   └── SpanDetailSheet.tsx
│           ├── pages/
│           │   ├── Timeline.tsx
│           │   ├── Tools.tsx
│           │   └── Sessions.tsx
│           └── hooks/
│               ├── useLiveSpans.ts
│               └── useSpansQuery.ts
├── tests/
│   ├── jsonrpc.test.ts
│   ├── span-builder.test.ts
│   ├── error-mapping.test.ts
│   └── fixtures/
│       └── frames.json
├── dist/                      # build output (gitignored)
├── package.json
├── tsconfig.json
├── tsconfig.base.json
├── vite.config.ts
└── STATUS.md
```

## Troubleshooting

**"Cannot find module 'better-sqlite3'"**
Run `pnpm rebuild better-sqlite3` to rebuild the native binary for your platform.

**Port already in use**
Stop the process currently using the port, or use the `--port` option for
`wrap-http`. The stdio wrapper and standalone dashboard currently use port
7878.

**Dashboard shows "not built"**
Run `pnpm exec vite build --config src/dashboard/vite.config.ts` first.

**No spans appearing in the dashboard**
Make sure the `wrap` command is running and traffic is flowing. Check that pino logs are going to stderr, not stdout.

## License

MIT
