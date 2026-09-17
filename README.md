# mcpscope

Observability proxy for Model Context Protocol (MCP).

## Install

```bash
npm install -g mcpscope
```

For local development from a checkout:

```bash
pnpm install
pnpm build
```

The build embeds the SQLite schema and includes the dashboard assets, so no
manual copying step is required.

## Usage

```bash
mcpscope wrap -- npx -y @modelcontextprotocol/server-everything stdio
mcpscope wrap-http http://localhost:3000/mcp --port 8989
```

Open `http://localhost:7878` for the dashboard when using `wrap`, or
`http://localhost:8989` when using `wrap-http`. Data is stored in
`~/.mcpscope/scope.db` by default.

To run the locally built CLI:

```bash
node dist/cli.js wrap -- npx -y @modelcontextprotocol/server-everything stdio
```

See [GETTING_STARTED.md](./GETTING_STARTED.md) for Mac setup, MCP client
configuration, SQLite inspection, payload capture, and OTLP export.

## License

MIT
