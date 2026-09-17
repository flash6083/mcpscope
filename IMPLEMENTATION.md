# mcpscope — Implementation Plan & Reference

> A local-first OpenTelemetry traffic inspector for MCP servers.
> Target: shippable to npm in 7 days from a Mac Air M4.

**Last updated:** June 20, 2026
**Maintainer:** Flash
**Status:** pre-implementation reference

---

## Table of contents

0. [Project recap](#0-project-recap)
1. [Mac Air M4 setup notes](#1-mac-air-m4-setup-notes)
2. [Pinned versions](#2-pinned-versions)
3. [Repo structure (LOCKED)](#3-repo-structure-locked)
4. [Bootstrap (Day 0)](#4-bootstrap-day-0)
5. [Day-by-day implementation plan](#5-day-by-day-implementation-plan)
6. [Key code patterns](#6-key-code-patterns)
7. [Common pitfalls](#7-common-pitfalls)
8. [Testing approach](#8-testing-approach)
9. [Distribution checklist](#9-distribution-checklist)
10. [Beyond week 1](#10-beyond-week-1)

---

## 0. Project recap

`mcpscope` wraps an MCP server process, passes JSON-RPC traffic through transparently, and emits OpenTelemetry spans for every request, response, and notification — following the official MCP semantic conventions. Spans can be sent to any OTLP-compatible backend (Jaeger, Tempo, Datadog), stored locally in SQLite, and viewed in a small built-in web dashboard.

**Core value:** Chrome DevTools' Network tab, but for MCP. Zero SaaS, zero account, zero code changes to the server.

**Differentiation:** Unlike MCP Inspector (which forces a separate test client), unlike mcp-recorder (CI replay only), unlike Sentry/Datadog (SaaS-bound), unlike Bifrost/Portkey (enterprise gateways with auth overhead) — `mcpscope` is a local-first observer that works with your actual client (Claude Desktop, Cursor, Claude Code).

---

## 1. Mac Air M4 setup notes

Apple Silicon (`darwin-arm64`) considerations relevant to this project:

- **`better-sqlite3` 12.x** ships prebuilt `darwin-arm64` binaries. No compilation needed. If the install ever falls back to building from source, you'll need Xcode CLT (`xcode-select --install`) and Python 3 — but you shouldn't hit that path.
- **Docker Desktop for Apple Silicon** uses ARM64 images natively. The Jaeger image `cr.jaegertracing.io/jaegertracing/jaeger:2.11.0` is multi-arch — pulls ARM64 automatically.
- **otel-desktop-viewer** has darwin-arm64 builds via Homebrew (`brew install --cask otel-desktop-viewer`). No Rosetta needed.
- **Node 24** has native arm64 builds. Avoid Rosetta-translated Node — it'll silently degrade performance.
- **fnm** (recommended Node manager) has native arm64 builds and is faster than nvm.

You will not need: Rosetta, Xcode (Xcode CLT is enough), Homebrew gcc/g++.

---

## 2. Pinned versions

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | **24.x LTS** | Use fnm to install. Active LTS through Oct 2026. |
| Package mgr | pnpm | 10.30+ | Via `corepack`. |
| Language | TypeScript | 5.7.x | Stable line. Avoid 7-rc. |
| MCP SDK | `@modelcontextprotocol/sdk` | 1.29.0 | Peer dep on zod. |
| Validation | `zod` | 4.4.x | SDK imports from `zod/v4`. |
| OTel API | `@opentelemetry/api` | 1.9.x | |
| OTel SDK | `@opentelemetry/sdk-node` | 0.219.0 | Experimental train. |
| OTel trace base | `@opentelemetry/sdk-trace-base` | 2.7.x | Stable. |
| OTel semconv | `@opentelemetry/semantic-conventions` | 1.40.0 | MCP attrs under `/incubating`. |
| OTLP exporter | `@opentelemetry/exporter-trace-otlp-http` | 0.219.0 | Primary exporter. |
| SQLite | `better-sqlite3` | 12.11.x | Prebuilt for darwin-arm64. |
| HTTP server | `fastify` | 5.8.x | |
| CLI | `commander` | 15.0.x | |
| Logger | `pino` | 10.3.x | Ships own types. |
| Bundler | `tsup` | 8.5.x | esbuild-based. |
| Test runner | `vitest` | 4.1.x | |
| Lint + format | `@biomejs/biome` | 2.x | Single tool. |
| Frontend bundler | `vite` | 7.x | |
| UI | `react` + `react-dom` | 19.x | |
| CSS | `tailwindcss` + `@tailwindcss/vite` | 4.x | v4 uses Vite plugin, no PostCSS. |
| Components | shadcn/ui (CLI) | latest | Tailwind v4 + React 19 supported. |
| External backend | Jaeger Docker image | `cr.jaegertracing.io/jaegertracing/jaeger:2.11.0` | OTLP HTTP 4318, gRPC 4317, UI 16686. |

---

## 3. Repo structure (LOCKED)

This layout is the contract. Adding files inside these directories is fine. Moving things around mid-week is not.

```
mcpscope/
├── package.json                        # workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json                  # shared TS config
├── biome.json                          # lint + format config
├── .gitignore
├── .editorconfig
├── .nvmrc                              # pins Node 24
├── README.md                           # the public-facing doc
├── LICENSE                             # MIT
├── CHANGELOG.md
│
├── .github/
│   └── workflows/
│       └── ci.yml                      # lint + test on push
│
└── packages/
    ├── proxy/                          # → published to npm as `mcpscope`
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── tsup.config.ts
    │   ├── README.md                   # symlinked/copied to repo root README at publish
    │   │
    │   ├── src/
    │   │   ├── cli.ts                  # commander entry, dispatches subcommands
    │   │   ├── log.ts                  # pino, configured to stderr only
    │   │   ├── config.ts               # env var parsing, defaults, paths
    │   │   │
    │   │   ├── jsonrpc/
    │   │   │   ├── schema.ts           # zod schemas for request/response/notification
    │   │   │   ├── parser.ts           # newline-delimited JSON frame parser
    │   │   │   └── types.ts            # TS types inferred from zod
    │   │   │
    │   │   ├── mcp/
    │   │   │   ├── methods.ts          # the enum of well-known MCP methods
    │   │   │   ├── semconv.ts          # local copy of mcp.* attribute names
    │   │   │   └── error-mapping.ts    # isError + JSON-RPC error → span status
    │   │   │
    │   │   ├── proxy/
    │   │   │   ├── stdio.ts            # stdio transport: spawn child, pipe streams
    │   │   │   ├── http.ts             # Streamable HTTP transport
    │   │   │   └── interceptor.ts      # shared frame-tapping logic, emits to span builder
    │   │   │
    │   │   ├── otel/
    │   │   │   ├── tracer.ts           # tracerProvider setup
    │   │   │   ├── span-builder.ts     # build spans from JSON-RPC frames
    │   │   │   ├── context.ts          # W3C trace context injection / extraction
    │   │   │   └── exporters/
    │   │   │       ├── sqlite.ts       # custom SpanExporter that writes to SQLite
    │   │   │       └── otlp.ts         # wraps the official OTLP HTTP exporter
    │   │   │
    │   │   ├── store/
    │   │   │   ├── db.ts               # better-sqlite3 wrapper + migrations
    │   │   │   ├── schema.sql          # initial schema
    │   │   │   └── queries.ts          # prepared statements
    │   │   │
    │   │   ├── server/
    │   │   │   ├── app.ts              # Fastify app factory
    │   │   │   ├── routes.ts           # /api/spans, /api/sessions, /api/tools
    │   │   │   ├── sse.ts              # /api/events live stream
    │   │   │   └── static.ts           # serves bundled dashboard from dist/assets
    │   │   │
    │   │   └── commands/
    │   │       ├── wrap.ts             # `mcpscope wrap -- <cmd>` (stdio)
    │   │       ├── wrap-http.ts        # `mcpscope wrap-http <url>` (HTTP)
    │   │       └── dashboard.ts        # `mcpscope dashboard` (open the UI)
    │   │
    │   └── tests/
    │       ├── jsonrpc.test.ts
    │       ├── span-builder.test.ts
    │       ├── error-mapping.test.ts
    │       └── fixtures/
    │           └── frames.json
    │
    └── dashboard/                      # NOT published separately; bundled into proxy
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.node.json
        ├── vite.config.ts
        ├── index.html
        ├── components.json             # shadcn config
        │
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── index.css               # @import "tailwindcss"
            │
            ├── lib/
            │   ├── api.ts              # fetch wrappers for /api/*
            │   ├── sse.ts              # SSE subscription hook
            │   └── utils.ts            # cn() and friends
            │
            ├── components/
            │   ├── ui/                 # shadcn-generated: button, table, sheet, badge, tabs
            │   ├── TimelineTable.tsx
            │   ├── SpanDetailSheet.tsx
            │   ├── FilterBar.tsx
            │   └── StatusBadge.tsx
            │
            ├── pages/
            │   ├── Timeline.tsx        # default view
            │   ├── Tools.tsx           # tool catalog from cached tools/list
            │   └── Sessions.tsx        # per-session breakdown
            │
            └── hooks/
                ├── useLiveSpans.ts
                └── useSpansQuery.ts
```

### Why these specific boundaries

- **Two-package workspace** (proxy + dashboard) keeps the dashboard's heavy frontend toolchain out of the published npm install. Users `npx mcpscope` and get a single bundled file with pre-built assets — they don't pull `react-dom`, `vite`, or shadcn into their machine.
- **`src/mcp/` is separate from `src/jsonrpc/`** because JSON-RPC is the transport, MCP is the protocol on top. The parser knows nothing about tools; the MCP layer knows nothing about framing.
- **`src/otel/exporters/sqlite.ts`** is a real `SpanExporter` implementation (not just a callback). This means the SQLite store gets spans via the same OTel pipeline as Jaeger does — no separate "tap" path to maintain.
- **`src/commands/`** isolates each CLI subcommand into its own file. Adding `mcpscope export-har` later is one file, not a refactor.
- **`tests/`** lives inside the proxy package, not at the repo root, so `pnpm --filter mcpscope test` works cleanly.

---

## 4. Bootstrap (Day 0)

Run this entire block before Day 1. Should take 10–15 minutes including waits.

### 4.1 System prerequisites

```bash
# Node 24 via fnm (skip if already installed)
curl -fsSL https://fnm.vercel.app/install | bash
exec $SHELL                                 # reload shell
fnm install 24
fnm default 24
fnm use 24
node --version                              # → v24.x

# pnpm via corepack
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version                              # → 10.x

# Docker Desktop — install from docker.com if not present
docker --version
docker run --rm hello-world

# Warm caches for the MCP test server (one-time, ~30s)
npx -y @modelcontextprotocol/server-everything --help >/dev/null 2>&1
npx -y @modelcontextprotocol/inspector --help >/dev/null 2>&1
```

### 4.2 Optional but useful

```bash
# otel-desktop-viewer (for the zero-Docker demo path)
brew tap ctrlspice/otel-desktop-viewer
brew install --cask otel-desktop-viewer

# Pre-pull the Jaeger image
docker pull cr.jaegertracing.io/jaegertracing/jaeger:2.11.0
```

### 4.3 Repo init

```bash
mkdir mcpscope && cd mcpscope
git init -b main

# Lock files
cat > .nvmrc <<'EOF'
24
EOF

cat > .gitignore <<'EOF'
node_modules/
dist/
.mcpscope/
*.tsbuildinfo
.DS_Store
.env
.vscode/
coverage/
EOF

cat > .editorconfig <<'EOF'
root = true
[*]
end_of_line = lf
indent_style = space
indent_size = 2
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "packages/*"
EOF
```

### 4.4 Root package.json + base configs

```bash
cat > package.json <<'EOF'
{
  "name": "mcpscope-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "typescript": "^5.7.0"
  },
  "engines": { "node": ">=22.0.0" },
  "packageManager": "pnpm@10.30.2"
}
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  }
}
EOF
```

### 4.5 Create both packages with minimal placeholders

```bash
mkdir -p packages/proxy/src packages/dashboard/src

# proxy package.json
cat > packages/proxy/package.json <<'EOF'
{
  "name": "mcpscope",
  "version": "0.1.0",
  "description": "Local-first observability for MCP servers",
  "type": "module",
  "bin": { "mcpscope": "dist/cli.js" },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-node": "^0.219.0",
    "@opentelemetry/sdk-trace-base": "^2.7.0",
    "@opentelemetry/resources": "^2.7.0",
    "@opentelemetry/semantic-conventions": "^1.40.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.219.0",
    "better-sqlite3": "^12.11.1",
    "commander": "^15.0.0",
    "fastify": "^5.8.0",
    "pino": "^10.3.0",
    "zod": "^4.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^24.0.0",
    "tsup": "^8.5.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.0"
  },
  "engines": { "node": ">=22.0.0" },
  "keywords": ["mcp", "model-context-protocol", "opentelemetry", "observability", "tracing"],
  "license": "MIT"
}
EOF

# proxy tsconfig
cat > packages/proxy/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
EOF

# proxy tsup config
cat > packages/proxy/tsup.config.ts <<'EOF'
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  shims: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
  external: ["better-sqlite3"]
});
EOF

# placeholder entry so `pnpm install` succeeds
echo 'console.log("mcpscope: stub");' > packages/proxy/src/cli.ts
```

### 4.6 Install everything

```bash
pnpm install
pnpm dlx @biomejs/biome init
git add . && git commit -m "chore: bootstrap workspace"
```

### 4.7 Dashboard bootstrap

```bash
cd packages/dashboard
# Create Vite project structure manually (we already have package.json controlled)
cat > package.json <<'EOF'
{
  "name": "@mcpscope/dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-table": "^8.20.0",
    "lucide-react": "^0.460.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.7.0"
  }
}
EOF

cd ../..
pnpm install

# Initialize shadcn inside the dashboard
cd packages/dashboard
pnpm dlx shadcn@latest init       # answer: TypeScript yes, base color: Neutral, CSS file: src/index.css
pnpm dlx shadcn@latest add button table sheet badge tabs scroll-area input
cd ../..

git add . && git commit -m "chore: dashboard scaffold + shadcn primitives"
```

### 4.8 Sanity gate

All six must pass before Day 1:

```bash
node --version                                            # v24.x
pnpm --version                                            # 10.x
docker run --rm hello-world                               # success
npx -y @modelcontextprotocol/server-everything --help     # help text
pnpm install                                              # exits 0
pnpm -r exec tsc --noEmit                                 # no errors
```

---

## 5. Day-by-day implementation plan

Each day has the same shape: goal → files → key decisions → Claude Code prompt → sanity check.

### Day 1 — JSON-RPC parser + stdio proxy + SQLite store

**Goal:** wrap an MCP server and persist every frame to SQLite.

**Files to create:**
- `src/jsonrpc/schema.ts` — zod schemas for `JSONRPCRequest`, `JSONRPCResponse`, `JSONRPCNotification`
- `src/jsonrpc/parser.ts` — line-delimited JSON frame parser (transform stream)
- `src/jsonrpc/types.ts` — TS types inferred from zod
- `src/mcp/methods.ts` — enum of well-known methods
- `src/log.ts` — pino instance writing to stderr only
- `src/store/schema.sql` — initial schema (see §6.4)
- `src/store/db.ts` — better-sqlite3 wrapper with migration on open
- `src/proxy/stdio.ts` — spawn child, pipe stdin/stdout via the parser, log frames
- `src/commands/wrap.ts` — implements `mcpscope wrap -- <cmd>`
- `src/cli.ts` — commander setup with the `wrap` subcommand

**Key decisions locked today:**
- Storage path: `~/.mcpscope/scope.db` (override via `MCPSCOPE_DB`)
- Log destination: stderr, never stdout (stdout is the MCP wire — see pitfall §7.1)
- Frame parser: streaming line-buffer; never blocks the pipe

**Claude Code prompt** (paste at repo root):

> Implement Day 1 of mcpscope per the plan in IMPLEMENTATION.md. Create the JSON-RPC schemas in `packages/proxy/src/jsonrpc/`, the SQLite store in `packages/proxy/src/store/`, and the stdio proxy in `packages/proxy/src/proxy/stdio.ts`. The proxy must transparently pipe child stdin/stdout while tapping every frame to the store. All logs go to stderr via pino. The `wrap` command in `packages/proxy/src/commands/wrap.ts` should spawn the upstream process specified after `--`. Run vitest on the parser. Do not implement OTel yet.

**Sanity check:**

```bash
pnpm --filter mcpscope build
node packages/proxy/dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
# In another terminal:
sqlite3 ~/.mcpscope/scope.db "SELECT method, COUNT(*) FROM raw_frames GROUP BY method;"
# You should see initialize, tools/list, etc. after running the inspector against the wrapped server
```

---

### Day 2 — OTel tracer + MCP semantic conventions + SQLite exporter

**Goal:** every JSON-RPC request becomes a properly-shaped OTel span persisted to SQLite via a real `SpanExporter`.

**Files to create:**
- `src/mcp/semconv.ts` — local constants for `mcp.method.name`, `mcp.protocol.version`, `mcp.session.id`, `mcp.resource.uri` (see §6.2)
- `src/mcp/error-mapping.ts` — classify outcomes: OK / `jsonrpc_error` / `tool_error` (the isError case)
- `src/otel/tracer.ts` — `BasicTracerProvider` setup with our custom exporter
- `src/otel/span-builder.ts` — given a request+response pair, build a span with correct attributes and kind
- `src/otel/exporters/sqlite.ts` — implements `SpanExporter`; writes to `spans` table

**Files to update:**
- `src/proxy/interceptor.ts` — pull common frame-pairing logic out of stdio.ts; emit to span builder
- `src/store/schema.sql` — add `spans` table (see §6.4)

**Key decisions locked today:**
- Span naming: `{mcp.method.name} {target}` (target = tool name for `tools/call`, uri for `resources/read`, empty otherwise)
- Span kind: `CLIENT` for outgoing requests (we are calling the upstream server)
- Session span: one `INTERNAL` span per proxy invocation, parents all method spans
- `isError: true` inside a successful response → `Status = ERROR`, `error.type = tool_error`

**Claude Code prompt:**

> Implement Day 2: add OpenTelemetry tracing. Create `src/mcp/semconv.ts` with the four MCP attribute constants. Create `src/otel/span-builder.ts` that takes a paired request+response and builds an OTel Span with: name = `${method} ${target}`, kind = CLIENT, attributes including all four mcp.* values, `gen_ai.operation.name=execute_tool` and `gen_ai.tool.name` for tools/call, `mcp.resource.uri` for resources/*, and correct error mapping (JSON-RPC error vs result.isError). Implement `src/otel/exporters/sqlite.ts` as a real OpenTelemetry SpanExporter. Wire the tracer in the interceptor. Add vitest cases covering: a normal tools/call, a tools/call with isError, a JSON-RPC error response, and a notification.

**Sanity check:**

```bash
pnpm --filter mcpscope build && pnpm --filter mcpscope test
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
# Trigger calls via Inspector, then:
sqlite3 ~/.mcpscope/scope.db <<'EOF'
SELECT name, kind, status, json_extract(attributes, '$.mcp.method.name') AS method
FROM spans ORDER BY start_time DESC LIMIT 10;
EOF
```

---

### Day 3 — Local HTTP API + SSE live stream

**Goal:** Fastify serves spans over HTTP, with an SSE endpoint for live tail.

**Files to create:**
- `src/server/app.ts` — Fastify factory, CORS for `localhost:5173` (dashboard dev)
- `src/server/routes.ts` — `GET /api/spans` (with query filters), `/api/sessions`, `/api/tools`
- `src/server/sse.ts` — `GET /api/events` SSE handler subscribing to an in-process event bus
- `src/store/queries.ts` — prepared statements for the API queries
- `src/commands/dashboard.ts` — starts the server and prints the URL (port 7878)

**Files to update:**
- `src/otel/exporters/sqlite.ts` — emit an `EventEmitter` event on each export, for SSE to forward
- `src/cli.ts` — add `dashboard` subcommand; the `wrap` command also auto-starts the server in-process on port 7878

**Key decisions locked today:**
- API base URL: `http://localhost:7878` (port chosen to be memorable, unlikely to clash)
- SSE message shape: `data: {"type":"span","span":{...}}\n\n`
- Query filters: `?method=tools/call&status=error&since=1719000000` etc.

**Claude Code prompt:**

> Implement Day 3: stand up the local Fastify server. Routes: GET /api/spans (filterable by method, status, session_id, since), GET /api/sessions, GET /api/tools (derived from the most recent tools/list response per session), and GET /api/events as SSE. The server runs in-process inside the wrap command, on port 7878 by default. The SQLite SpanExporter from Day 2 emits an event after each export; the SSE handler forwards those events to subscribed clients. Add CORS for http://localhost:5173. No auth, this is localhost-only.

**Sanity check:**

```bash
# Terminal 1
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio

# Terminal 2 (trigger some traffic via Inspector first)
curl http://localhost:7878/api/spans | jq '. | length'
curl -N http://localhost:7878/api/events    # should hang; new spans appear as events
```

---

### Day 4 — Dashboard: live timeline + detail view + filters

**Goal:** open `http://localhost:5173`, see live spans flowing, click one to see full JSON.

**Files to create in `packages/dashboard/src/`:**
- `lib/api.ts` — fetch helpers
- `lib/sse.ts` — `useEventSource` hook
- `hooks/useLiveSpans.ts` — merges initial fetch + SSE stream into one sorted list
- `hooks/useSpansQuery.ts` — for filtered, paginated history (not live)
- `components/TimelineTable.tsx` — TanStack Table-based live list
- `components/SpanDetailSheet.tsx` — shadcn Sheet showing the full span (request, response, attributes, error)
- `components/FilterBar.tsx` — method dropdown, status dropdown, search
- `components/StatusBadge.tsx` — OK / ERROR / running pill
- `pages/Timeline.tsx` — the default view
- `App.tsx`, `main.tsx`, `index.css` — wiring; `@import "tailwindcss"` in CSS

**Key decisions locked today:**
- Layout: single page, no router needed yet (router is Day 6 work)
- Theme: shadcn "new-york" + neutral base + dark mode toggle
- Live mode by default; click "Pause" to freeze for inspection

**Claude Code prompt:**

> Implement Day 4: build the dashboard in `packages/dashboard`. The default page Timeline.tsx shows a live-updating table of spans (newest at top) using TanStack Table. Each row shows: timestamp, method, target (tool name or resource URI), latency, status badge. Clicking a row opens a shadcn Sheet on the right with the full span JSON pretty-printed, plus request and response payloads if captured. FilterBar at the top supports method + status + free-text search across attributes. Use the SSE endpoint for live updates and the /api/spans endpoint for the initial backfill of 200 spans. Tailwind v4 via @tailwindcss/vite, no PostCSS config.

**Sanity check:**

```bash
# Terminal 1
node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio
# Terminal 2
pnpm --filter @mcpscope/dashboard dev
# Open http://localhost:5173, trigger calls via Inspector, see them appear live
```

---

### Day 5 — OTLP export + Jaeger + W3C Trace Context

**Goal:** spans simultaneously flow to SQLite (for the dashboard) and to Jaeger (or any OTLP backend). Trace context propagates through MCP.

**Files to create:**
- `src/otel/exporters/otlp.ts` — wraps `OTLPTraceExporter` from `@opentelemetry/exporter-trace-otlp-http`, gated on `OTEL_EXPORTER_OTLP_ENDPOINT` env var
- `src/otel/context.ts` — inject/extract W3C trace context from JSON-RPC `_meta.traceparent` (stdio) and HTTP headers (HTTP transport)

**Files to update:**
- `src/otel/tracer.ts` — register both exporters when env var is set
- `src/proxy/interceptor.ts` — call `context.inject` before forwarding requests upstream; `context.extract` from upstream responses

**Key decisions locked today:**
- OTLP enabled only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (otherwise we never call out)
- Resource attributes: `service.name=mcpscope`, `service.version=<package version>`, `mcpscope.upstream.command=<wrapped cmd>`
- For stdio, the convention is `_meta.traceparent` inside JSON-RPC params (see MCP semconv discussion #269)

**Claude Code prompt:**

> Implement Day 5: add OTLP HTTP export, gated on OTEL_EXPORTER_OTLP_ENDPOINT being set. Wire it alongside the existing SQLite exporter via a CompositeSpanProcessor or by registering two BatchSpanProcessors. Resource attributes: service.name=mcpscope, service.version from package.json. Implement W3C Trace Context propagation: for outgoing requests we inject the current span context into `params._meta.traceparent` (creating params._meta if absent); for incoming responses we don't extract anything (the response is paired by jsonrpc.request.id). Document the convention in code comments referencing MCP discussion #269.

**Sanity check:**

```bash
# Terminal 1
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 \
  cr.jaegertracing.io/jaegertracing/jaeger:2.11.0

# Terminal 2
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  node dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio

# Trigger traffic, then open http://localhost:16686
# Select service "mcpscope", click "Find Traces", you should see spans with mcp.* attributes
```

---

### Day 6 — Streamable HTTP transport + replay + tool catalog + polish

**Goal:** support remote MCP servers, let users replay tool calls with edited params, surface a tool catalog.

**Files to create:**
- `src/proxy/http.ts` — Streamable HTTP transport: starts a local HTTP server that forwards to upstream URL, intercepting in both directions
- `src/commands/wrap-http.ts` — `mcpscope wrap-http <url> [--port 8989]`
- `dashboard/src/pages/Tools.tsx` — tool catalog page, derived from most recent `tools/list` response per session, with per-tool latency histogram (basic bar chart)

**Files to update:**
- `src/server/routes.ts` — add `POST /api/replay/:span_id` that re-sends the original `tools/call` (with optional `body` overriding params) to the upstream
- `src/cli.ts` — register the new command
- `dashboard/src/components/SpanDetailSheet.tsx` — "Replay" button for tools/call spans, opens an editor for params
- `dashboard/src/App.tsx` — add Tabs for Timeline / Tools / Sessions

**Key decisions locked today:**
- HTTP transport listens on `localhost:8989` by default
- For HTTP, trace context goes in the `traceparent` HTTP header (W3C standard, not in `_meta`)
- Replay: spawns a fresh request, gets a fresh span, gets correlated to the parent via a `mcpscope.replay_of` attribute

**Claude Code prompt:**

> Implement Day 6: (1) add Streamable HTTP transport in src/proxy/http.ts and command src/commands/wrap-http.ts that forwards requests to the upstream URL and intercepts both directions. Trace context goes in the traceparent HTTP header. (2) Add POST /api/replay/:span_id that re-executes the original request, optionally with overridden params from the request body. New span gets attribute mcpscope.replay_of = original span_id. (3) Add Tools page to the dashboard listing tools from the latest tools/list response with mean and p95 latency per tool. (4) Add a "Replay" button to the span detail sheet for tools/call spans.

**Sanity check:**

```bash
# Test HTTP transport against the streamable-http example
node dist/cli.js wrap-http http://localhost:3000/mcp --port 8989 &
# Connect Inspector to http://localhost:8989/mcp, verify spans flow

# Test replay
curl -X POST http://localhost:7878/api/replay/<some-span-id> \
  -H 'content-type: application/json' \
  -d '{"params":{"name":"echo","arguments":{"text":"replayed!"}}}'
```

---

### Day 7 — Tests, README, demo, npm publish

**Goal:** ship.

**Files to create:**
- `tests/jsonrpc.test.ts` — parser handles partial chunks, multi-line, malformed (gracefully)
- `tests/span-builder.test.ts` — span name, kind, attributes correct per method type
- `tests/error-mapping.test.ts` — isError, JSON-RPC error, success classifications
- `tests/fixtures/frames.json` — golden frames for tests
- `README.md` at repo root — copied to `packages/proxy/README.md` for npm
- `.github/workflows/ci.yml` — lint + test on push
- `assets/` — demo GIF, Jaeger screenshot for README

**Files to update:**
- `package.json` (proxy) — set final version, polish description and keywords
- `CHANGELOG.md` — initial 0.1.0 entry

**README structure (write it in this order):**

1. One-sentence pitch + screenshot of the live dashboard
2. 30-second quickstart: `npx mcpscope wrap -- <your server cmd>`
3. Config snippet for `claude_desktop_config.json` wrapping a real server
4. Architecture diagram (ASCII from the learning reference is fine)
5. Features list
6. "How it compares" table vs MCP Inspector / Sentry / Bifrost / FastMCP
7. Privacy: payload capture is opt-in, env var `MCPSCOPE_CAPTURE_PAYLOADS`
8. OTel export: `OTEL_EXPORTER_OTLP_ENDPOINT=...` to ship to Jaeger/Tempo/Datadog with a Jaeger screenshot
9. Development: clone + pnpm install + how to add features
10. License

**Claude Code prompt:**

> Day 7: write Vitest tests for the JSON-RPC parser (partial chunks, multi-line, malformed), span builder (correct attributes per method), and error mapping (isError vs JSON-RPC error vs OK). Add fixtures in tests/fixtures/frames.json. Then write a thorough README following the 10-section structure in IMPLEMENTATION.md §5 Day 7. Configure GitHub Actions CI for lint + test on push. Set version to 0.1.0 and prepare for npm publish.

**Ship checklist:**

```bash
pnpm -r test                                            # all green
pnpm --filter mcpscope build
pnpm --filter @mcpscope/dashboard build                 # outputs into proxy/dist/assets
node packages/proxy/dist/cli.js --help                  # looks clean
node packages/proxy/dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio  # works end-to-end
cd packages/proxy
npm publish --dry-run                                   # inspect what would ship
npm publish                                             # ship
```

---

## 6. Key code patterns

The non-obvious ones. Everything else, Claude Code will produce idiomatically.

### 6.1 Stdio passthrough that taps frames without breaking the pipe

```ts
// src/proxy/stdio.ts (sketch)
import { spawn } from "node:child_process";
import { parseFrames } from "../jsonrpc/parser.js";
import { onFrame } from "./interceptor.js";

export function runStdioProxy(cmd: string, args: string[]) {
  const child = spawn(cmd, args, {
    stdio: ["pipe", "pipe", "inherit"],  // child stderr → our stderr
  });

  // Downstream client → upstream server, tapped
  process.stdin.pipe(parseFrames(f => onFrame("client→server", f))).pipe(child.stdin!);

  // Upstream server → downstream client, tapped
  child.stdout!.pipe(parseFrames(f => onFrame("server→client", f))).pipe(process.stdout);

  child.on("exit", code => process.exit(code ?? 0));
}
```

`parseFrames` is a `Transform` stream that buffers until a newline, parses with zod, calls the callback for telemetry, and passes the original buffer through unchanged. **Critical:** we forward the raw bytes, not a re-serialized version — preserving the upstream's whitespace and key ordering avoids breaking edge cases.

### 6.2 MCP semconv constants (local copy)

```ts
// src/mcp/semconv.ts
// Mirrored from OTel GenAI semconv repo (status: Development).
// We import these from a local file rather than @opentelemetry/semantic-conventions/incubating
// because the /incubating entry-point may break in minor versions.

export const MCP_METHOD_NAME = "mcp.method.name" as const;
export const MCP_PROTOCOL_VERSION = "mcp.protocol.version" as const;
export const MCP_SESSION_ID = "mcp.session.id" as const;
export const MCP_RESOURCE_URI = "mcp.resource.uri" as const;

export const GEN_AI_OPERATION_NAME = "gen_ai.operation.name" as const;
export const GEN_AI_TOOL_NAME = "gen_ai.tool.name" as const;
export const GEN_AI_TOOL_CALL_ARGUMENTS = "gen_ai.tool.call.arguments" as const;
export const GEN_AI_TOOL_CALL_RESULT = "gen_ai.tool.call.result" as const;

export const JSONRPC_REQUEST_ID = "jsonrpc.request.id" as const;
export const JSONRPC_VERSION = "jsonrpc.version" as const;
```

### 6.3 Trace context injection (stdio)

```ts
// src/otel/context.ts
import { trace, context } from "@opentelemetry/api";

export function injectIntoParams(params: Record<string, unknown> | undefined) {
  const span = trace.getActiveSpan();
  if (!span) return params;
  const sc = span.spanContext();
  const traceparent = `00-${sc.traceId}-${sc.spanId}-0${sc.traceFlags.toString(16)}`;
  return {
    ...(params ?? {}),
    _meta: { ...(params?._meta as object ?? {}), traceparent },
  };
}
```

### 6.4 SQLite schema

```sql
-- src/store/schema.sql
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  upstream_cmd TEXT NOT NULL,
  protocol_version TEXT
);

CREATE TABLE IF NOT EXISTS spans (
  span_id      TEXT PRIMARY KEY,
  trace_id     TEXT NOT NULL,
  parent_span_id TEXT,
  session_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,
  start_time   INTEGER NOT NULL,
  end_time     INTEGER NOT NULL,
  status       TEXT NOT NULL,        -- OK | ERROR
  status_message TEXT,
  attributes   TEXT NOT NULL,        -- JSON
  events       TEXT NOT NULL,        -- JSON array
  request_body TEXT,                 -- gated by MCPSCOPE_CAPTURE_PAYLOADS
  response_body TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_spans_session ON spans(session_id);
CREATE INDEX IF NOT EXISTS idx_spans_start ON spans(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_spans_method ON spans(json_extract(attributes, '$."mcp.method.name"'));

CREATE TABLE IF NOT EXISTS raw_frames (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  direction    TEXT NOT NULL,        -- 'c2s' | 's2c'
  ts           INTEGER NOT NULL,
  method       TEXT,
  jsonrpc_id   TEXT,
  body         TEXT NOT NULL         -- the raw frame bytes
);

CREATE INDEX IF NOT EXISTS idx_raw_session ON raw_frames(session_id);
```

### 6.5 isError handling

```ts
// src/mcp/error-mapping.ts
import { SpanStatusCode } from "@opentelemetry/api";

export function classifyOutcome(response: JsonRpcResponse) {
  if (response.error) {
    return {
      code: SpanStatusCode.ERROR,
      errorType: "jsonrpc_error",
      message: response.error.message ?? "JSON-RPC error",
    };
  }
  const result = response.result as { isError?: boolean; content?: unknown };
  if (result?.isError === true) {
    return {
      code: SpanStatusCode.ERROR,
      errorType: "tool_error",
      message: "Tool returned isError",
    };
  }
  return { code: SpanStatusCode.OK };
}
```

### 6.6 Privacy gating

```ts
// src/config.ts
export type CaptureLevel = "none" | "truncated" | "full";

export const captureLevel: CaptureLevel =
  (process.env.MCPSCOPE_CAPTURE_PAYLOADS as CaptureLevel) ?? "none";

export function maybeCapture(payload: unknown): string | undefined {
  if (captureLevel === "none") return undefined;
  const s = JSON.stringify(payload);
  if (captureLevel === "truncated") return s.slice(0, 1024);
  return s;
}
```

---

## 7. Common pitfalls

### 7.1 Writing to stdout breaks MCP

The proxy's stdout is the MCP wire. Anything we write — `console.log`, an unsuppressed pino default, a stray `print` — corrupts the protocol stream and the client disconnects with a cryptic parse error.

**Rule:** all our own output goes to **stderr only**. pino is configured with `destination: 2` (stderr file descriptor). No `console.log` anywhere in the proxy.

### 7.2 Span flush on process exit

If the proxy exits before the BatchSpanProcessor flushes, the last few spans are lost. Always:

```ts
process.on("SIGINT", async () => {
  await tracerProvider.shutdown();
  process.exit(0);
});
```

### 7.3 Node 24 + ESM import extensions

With `"module": "NodeNext"`, imports of relative TypeScript files **must use the `.js` extension** in the import path, not `.ts`:

```ts
import { parseFrames } from "../jsonrpc/parser.js";   // ✅ correct
import { parseFrames } from "../jsonrpc/parser";      // ❌ runtime error
import { parseFrames } from "../jsonrpc/parser.ts";   // ❌ compile error
```

This trips up everyone migrating from CJS. Get it right early.

### 7.4 React 19 peer deps with pnpm

If shadcn ever errors on peer deps, run `pnpm install --shamefully-hoist` once. pnpm 10 generally handles React 19 fine, but some older `@radix-ui` versions still declare React 18 peers.

### 7.5 Tailwind v4 has no postcss.config.js

If you reflexively create a `postcss.config.js`, delete it. Tailwind v4 uses the Vite plugin: in `vite.config.ts`,

```ts
import tailwindcss from "@tailwindcss/vite";
plugins: [react(), tailwindcss()]
```

and in `src/index.css`:

```css
@import "tailwindcss";
```

That's it.

### 7.6 better-sqlite3 transactions

For the SpanExporter we'll insert spans in batches. Wrap inserts in a transaction or you'll see ~100× slowdowns:

```ts
const insertMany = db.transaction((spans: ReadyToInsertSpan[]) => {
  for (const s of spans) insertOne.run(s);
});
```

### 7.7 Forgetting to clean up the OTel BatchSpanProcessor in tests

Vitest holds the process open if there's a live span processor. In test setup, either use an `InMemorySpanExporter` or call `provider.shutdown()` in `afterAll`.

### 7.8 OTLP endpoint path

`@opentelemetry/exporter-trace-otlp-http` appends `/v1/traces` to the base URL. Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` — *not* `http://localhost:4318/v1/traces` — or you'll get `404`s.

### 7.9 Claude Desktop config path on macOS

The config file is at `~/Library/Application Support/Claude/claude_desktop_config.json`. After editing it, **fully quit Claude Desktop and relaunch** — reloading isn't enough.

---

## 8. Testing approach

### Unit (vitest, fast)

- `jsonrpc/parser.test.ts` — partial buffers, multi-frame chunks, malformed JSON, very large frames
- `mcp/error-mapping.test.ts` — OK, JSON-RPC error, isError=true, missing result, missing error
- `otel/span-builder.test.ts` — span name, kind, attributes for each method type. Use OTel's `InMemorySpanExporter` to inspect what was emitted.

### Integration (vitest, slower)

- `tests/integration/wrap-everything.test.ts` — spawns `server-everything`, sends a scripted set of requests via stdin, asserts that the SQLite spans table contains the expected rows. Use a temp dir for the DB. ~5 seconds per run.

### Manual smoke (every day)

End each day with: wrap `server-everything`, drive it via MCP Inspector, open the dashboard, see what you built that day work end-to-end.

---

## 9. Distribution checklist

Before `npm publish`:

- [ ] `npm whoami` returns your npm username (`npm login` if not)
- [ ] `package.json` has correct `name`, `version`, `description`, `keywords`, `repository`, `bugs`, `homepage`, `license`
- [ ] `files` field includes only `dist`, `README.md`, `LICENSE` (no `src/`, no `tests/`)
- [ ] `bin` field points to `dist/cli.js` with shebang
- [ ] `npm publish --dry-run` shows reasonable package contents and size (< 5MB)
- [ ] README is identical between repo root and `packages/proxy/` (copy at build time)
- [ ] CHANGELOG.md has an entry for 0.1.0
- [ ] Tag the release: `git tag v0.1.0 && git push --tags`
- [ ] After publish, verify: `npx mcpscope@latest --help` works from a fresh shell

---

## 10. Beyond week 1

Ranked by impact, lowest-effort first:

1. **`MCPSCOPE_CAPTURE_PAYLOADS=truncated` as default for `tools/list` only** — these are huge and rarely sensitive.
2. **Anomaly flags in the dashboard** — highlight tool calls slower than 3× their mean.
3. **OTel auto-instrumentation hook** — for users who want to drop spans into existing instrumentation (advanced).
4. **VSCode extension** surfacing the timeline in a panel.
5. **Multi-server view** — wrap several servers, see them on one dashboard. Requires socket aggregation.
6. **`mcp-recorder`-style export** — emit a cassette file for replay testing.
7. **Web dashboard hosted on `localhost` with cross-session history navigation**.
8. **Token cost estimation** when `tools/call` results contain LLM-attributable usage.

---

## Appendix A — Useful commands cheat sheet

```bash
# Run dev loop on the proxy
pnpm --filter mcpscope dev

# Run the dashboard dev server
pnpm --filter @mcpscope/dashboard dev

# Run only one test file
pnpm --filter mcpscope test span-builder

# Run with OTLP export to Jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  node packages/proxy/dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio

# Run with full payload capture (debug only)
MCPSCOPE_CAPTURE_PAYLOADS=full \
  node packages/proxy/dist/cli.js wrap -- npx @modelcontextprotocol/server-everything stdio

# Inspect what's in the local DB
sqlite3 ~/.mcpscope/scope.db ".schema"
sqlite3 ~/.mcpscope/scope.db "SELECT COUNT(*) FROM spans;"

# Start Jaeger
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 \
  cr.jaegertracing.io/jaegertracing/jaeger:2.11.0

# Stop Jaeger
docker rm -f jaeger
```

---

## Appendix B — claude_desktop_config.json snippet

For testing mcpscope against Claude Desktop:

```json
{
  "mcpServers": {
    "github-via-scope": {
      "command": "npx",
      "args": [
        "mcpscope",
        "wrap",
        "--",
        "npx",
        "@modelcontextprotocol/server-everything",
        "stdio"
      ]
    }
  }
}
```

Replace the `server-everything` line with whatever real MCP server you want to observe. Restart Claude Desktop fully after editing.

---

*End of plan. The next message in your workflow should be the Day 1 implementation, driven from this doc.*
