# Project status

`mcpscope` is an early-stage, local-first observability proxy for the Model
Context Protocol.

## Implemented

- Stdio MCP proxy with transparent JSON-RPC pass-through
- Streamable HTTP proxy with JSON and SSE response forwarding
- SQLite persistence for sessions, spans, and raw frames
- OpenTelemetry span creation and optional OTLP/HTTP export
- Local Fastify API
- Bundled React dashboard with Timeline, Tools, and Sessions views
- Live span updates over server-sent events
- npm CLI build with embedded SQL schema and bundled dashboard assets
- Runtime support for Node.js 22+

## Known limitations

- Streamable HTTP path rewriting and replay are not implemented.
- Database migrations and dashboard deletion controls are planned.
- The default database is local SQLite; there is no multi-user or hosted mode.
- The current API is intended for local use and is not an authenticated public
  service.
- OTLP export is implemented but should be validated against each target backend
  before production use.

## Validation

The repository currently validates with:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```
