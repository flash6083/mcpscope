# mcpscope Production TODOs

This checklist defines the work required to publish `mcpscope` as a complete,
reliable npm package for **local MCP traffic inspection**.

## Product decisions

- [ ] Keep the package local-first and single-user.
- [ ] Do not require authentication for the default local workflow.
- [ ] Bind servers to `127.0.0.1` by default.
- [ ] Require an explicit `--host` opt-in to listen on other interfaces.
- [ ] Treat the dashboard and API as local administration surfaces, not public
      multi-user services.
- [ ] Keep the dashboard bundled inside the npm package.
- [ ] Keep SQLite as the default local store.
- [ ] Support both stdio MCP servers and Streamable HTTP MCP servers.
- [ ] Keep legacy SSE support either explicitly supported or clearly documented
      as unsupported; do not imply support that is not implemented.
- [ ] Keep destructive operations available locally without authentication, but
      require explicit confirmation in the UI and CLI.
- [ ] Do not make cloud hosting, multi-user access, distributed storage, or
      remote authentication part of the initial release.

## 1. Repository and package shape

- [ ] Decide whether this remains a single npm package or becomes a real
      workspace; remove stale documentation that describes a `packages/`
      directory if the single-package structure is retained.
- [ ] Ensure the package name is available on npm.
- [ ] Replace placeholder repository metadata in `package.json`.
- [ ] Set the correct `repository`, `bugs`, and `homepage` URLs.
- [ ] Add or verify `publishConfig.access`.
- [ ] Add `CHANGELOG.md` to the published files.
- [ ] Add `LICENSE` to the published files.
- [ ] Verify the package description and keywords accurately describe local MCP
      observability.
- [ ] Confirm the package version follows SemVer.
- [ ] Decide and document the Node.js support policy.
- [ ] Keep the `bin` entry executable and tested:
      `mcpscope -> ./dist/cli.js`.
- [ ] Ensure the published package contains only intentional runtime files.
- [ ] Ensure source maps are either intentionally published or intentionally
      excluded.
- [ ] Add a package size check so accidental frontend/build artifacts do not
      inflate the tarball.

## 2. Dependency and reproducible-build hygiene

- [ ] Replace `latest` dependency specifiers with tested versions or controlled
      semver ranges.
- [ ] Keep `pnpm-lock.yaml` synchronized with `package.json`.
- [ ] Confirm all runtime dependencies are in `dependencies`, not only
      `devDependencies`.
- [ ] Confirm all build-only dependencies are in `devDependencies`.
- [ ] Verify the `better-sqlite3` version supports the documented Node and
      platform matrix.
- [ ] Verify MCP SDK and OpenTelemetry package compatibility as a tested set.
- [ ] Use a clean install in CI (`pnpm install --frozen-lockfile`).
- [ ] Confirm builds do not depend on files outside the package.
- [ ] Confirm the SQL schema is embedded or shipped reliably in the tarball.
- [ ] Confirm dashboard assets are emitted at the URLs served by Fastify.
- [ ] Add a reproducible release command, for example:
      `pnpm release:check`.

## 3. CLI contract and configuration

- [ ] Add explicit options for common settings:
      `--host`, `--port`, `--db`, `--log-level`, and payload capture level.
- [ ] Use `127.0.0.1` as the default host.
- [ ] Preserve the current convenient defaults for local users.
- [ ] Validate ports as integers in the valid range.
- [ ] Validate database paths and report permission errors clearly.
- [ ] Validate payload capture values and reject unknown values.
- [ ] Decide whether environment variables and CLI flags may both be used;
      document precedence.
- [ ] Add `--help` examples for stdio wrapping, HTTP wrapping, dashboard use,
      database selection, and cleanup.
- [ ] Add a `--version` value sourced from package metadata rather than a
      duplicated hardcoded string.
- [ ] Return non-zero exit codes for startup, configuration, upstream, and
      database failures.
- [ ] Ensure command parsing failures are surfaced instead of silently ignored.
- [ ] Add a consistent shutdown path for every command.
- [ ] Print the local dashboard URL and MCP proxy URL clearly.
- [ ] Consider an optional `--open` flag, but keep browser launching opt-in.

## 4. Local security and privacy defaults

- [ ] Bind to loopback by default for `wrap`, `wrap-http`, and `dashboard`.
- [ ] Warn clearly when `--host` is not loopback.
- [ ] Restrict CORS to the actual local dashboard origins.
- [ ] Do not add authentication to the default local workflow.
- [ ] Document that binding to `0.0.0.0` exposes captured MCP metadata to the
      local network.
- [ ] Do not log authorization headers.
- [ ] Do not log full request or response bodies by default.
- [ ] Keep payload capture disabled by default.
- [ ] Display a warning when truncated or full payload capture is enabled.
- [ ] Add configurable maximum payload size limits.
- [ ] Consider redacting common secrets before storing captured payloads.
- [ ] Document that captured prompts, files, and tool results may contain
      sensitive information.
- [ ] Ensure database files are created with user-only permissions where the
      platform supports it.
- [ ] Add a documented database backup and deletion procedure.

## 5. SQLite storage and migrations

- [ ] Add a schema migration mechanism instead of executing one immutable
      schema on every startup.
- [ ] Add a `schema_migrations` table.
- [ ] Version the initial schema as migration `001`.
- [ ] Add migrations for every future schema change.
- [ ] Enable SQLite foreign-key enforcement with:
      `PRAGMA foreign_keys = ON`.
- [ ] Add `ON DELETE CASCADE` from `sessions` to `spans`.
- [ ] Add `ON DELETE CASCADE` from `sessions` to `raw_frames`.
- [ ] Add transactional store functions for deleting a session.
- [ ] Add transactional store functions for deleting a span.
- [ ] Handle database migration failures explicitly and leave the database
      usable or fail with a clear recovery message.
- [ ] Add indexes for the production query paths.
- [ ] Confirm WAL behavior and cleanup of `-wal` and `-shm` files.
- [ ] Handle a locked database with a clear error.
- [ ] Handle a read-only database with a clear error.
- [ ] Add tests for a fresh database and an upgraded database.
- [ ] Add tests for interrupted or failed migrations.
- [ ] Add tests for foreign-key and cascade behavior.

## 6. Data retention and deletion

- [ ] Add `DELETE /api/spans/:spanId`.
- [ ] Add `DELETE /api/sessions/:sessionId`.
- [ ] Return clear `204`, `404`, and validation responses.
- [ ] Use transactions for all multi-table deletes.
- [ ] Make session deletion remove its spans and raw frames.
- [ ] Define and document whether single-span deletion leaves raw frames.
- [ ] Add a CLI cleanup command, such as:
      `mcpscope cleanup --session <id>`.
- [ ] Add a CLI cleanup option for data older than a duration.
- [ ] Add a CLI command to clear all local data with explicit confirmation.
- [ ] Require typing a confirmation phrase for “delete all” operations.
- [ ] Add dashboard delete controls for individual spans.
- [ ] Add dashboard delete controls for complete sessions.
- [ ] Add a dashboard retention/cleanup action with confirmation.
- [ ] Refresh Timeline, Sessions, Tools, and SSE state after deletion.
- [ ] Show deletion errors in the dashboard.
- [ ] Show an empty state when no data remains.
- [ ] Ensure deletion cannot delete data from a different database path.
- [ ] Document that deletion is local and irreversible unless the user has a
      backup.

## 7. HTTP MCP proxy reliability

- [ ] Define the supported Streamable HTTP behavior in the README.
- [ ] Forward required MCP headers, including session and event headers.
- [ ] Preserve upstream status codes where appropriate.
- [ ] Strip hop-by-hop headers before forwarding responses.
- [ ] Strip `content-encoding` when Node fetch has already decompressed the
      response.
- [ ] Handle JSON responses.
- [ ] Handle SSE responses.
- [ ] Handle empty responses.
- [ ] Handle JSON-RPC notifications without IDs.
- [ ] Handle JSON-RPC errors.
- [ ] Handle HTTP `401`, `403`, `404`, `408`, `429`, and `5xx` responses.
- [ ] Add upstream request timeouts.
- [ ] Add maximum request and response size limits.
- [ ] Handle upstream DNS, TLS, connection, and reset failures.
- [ ] Handle client disconnects and cancel upstream work where possible.
- [ ] Handle concurrent requests safely.
- [ ] Handle duplicate and non-string JSON-RPC IDs correctly.
- [ ] Decide whether JSON-RPC batch messages are supported; implement or reject
      them explicitly.
- [ ] Decide whether redirects are followed; document the behavior.
- [ ] Prevent proxying to unsafe local targets if SSRF protection is desired
      for future non-local use.
- [ ] Ensure the proxy cannot accidentally rewrite the MCP path incorrectly.
- [ ] Add protocol-level integration tests with a local fake upstream.

## 8. Stdio MCP proxy reliability

- [ ] Preserve the upstream command, arguments, exit code, and signal behavior.
- [ ] Handle child-process spawn failures explicitly.
- [ ] Handle child stdin, stdout, and stderr errors.
- [ ] Forward only protocol data on stdout; keep logs on stderr.
- [ ] Forward signals to the child process.
- [ ] Add graceful shutdown with a kill timeout.
- [ ] Force-kill a child that does not exit after the timeout.
- [ ] Close the database exactly once.
- [ ] Shut down OpenTelemetry exactly once.
- [ ] Mark pending requests as failed or cancelled when the child exits.
- [ ] Handle malformed frames without crashing the wrapper unexpectedly.
- [ ] Test commands containing spaces and shell arguments.
- [ ] Test `npx`, Node, Python, and absolute executable commands.
- [ ] Test a server that exits immediately.
- [ ] Test a server that writes stderr output.
- [ ] Test SIGINT and SIGTERM behavior.

## 9. Dashboard correctness and UX

- [ ] Keep production asset paths working from any current working directory.
- [ ] Verify dashboard assets are included in the npm tarball.
- [ ] Add loading states to Timeline, Sessions, and Tools.
- [ ] Add empty states to Timeline, Sessions, and Tools.
- [ ] Add API error states and retry actions.
- [ ] Add visible SSE connection/reconnection state.
- [ ] Avoid `any` in dashboard API and component models.
- [ ] Define shared types for sessions, spans, tools, and API errors.
- [ ] Check `response.ok` in every frontend API call.
- [ ] Prevent duplicate live spans after reconnecting SSE.
- [ ] Handle stale or deleted rows in the detail sheet.
- [ ] Preserve filters while live events arrive.
- [ ] Add pagination or a bounded history window for large databases.
- [ ] Add a configurable Timeline limit.
- [ ] Display session identifiers in a copyable form.
- [ ] Display upstream command/URL safely escaped.
- [ ] Show useful timestamps and durations.
- [ ] Add a dashboard indicator when payload capture is enabled.
- [ ] Verify dashboard behavior in Chrome, Safari, and the VS Code browser.
- [ ] Add a production browser smoke test.

## 10. API design and error handling

- [ ] Define stable response shapes for all API endpoints.
- [ ] Define a consistent JSON error shape.
- [ ] Validate query parameters with a schema.
- [ ] Validate path parameters before querying SQLite.
- [ ] Reject invalid limits and excessively large limits.
- [ ] Avoid opening and closing a new database connection for every request if
      a safe shared lifecycle is preferable.
- [ ] Ensure every database connection closes on request failure.
- [ ] Avoid broad catches that convert failures into success-shaped responses.
- [ ] Add health checks for the HTTP server and database.
- [ ] Add an API endpoint exposing the active database path and capture mode only
      when that information is safe to show locally.
- [ ] Document all API endpoints intended for local integrations.
- [ ] Decide whether API paths are stable public package APIs or internal UI
      implementation details.

## 11. OpenTelemetry and export behavior

- [ ] Confirm SQLite span export is synchronous/safe enough for the intended
      local workload.
- [ ] Handle exporter failures without crashing the MCP proxy.
- [ ] Ensure exporter shutdown is awaited before process exit.
- [ ] Verify OTLP export is optional and disabled without configuration.
- [ ] Avoid logging payloads through OTLP exporter errors.
- [ ] Document the OTLP endpoint and protocol expectations.
- [ ] Test Jaeger/Tempo or another OTLP-compatible backend if export is part of
      the release promise.
- [ ] Verify spans have consistent timestamps, status, method, and session
      attributes across stdio and HTTP modes.
- [ ] Verify error spans are generated for transport and JSON-RPC failures.

## 12. Type safety, linting, and code quality

- [ ] Remove avoidable `any` types from source and dashboard code.
- [ ] Add explicit types for Fastify request query and route parameters.
- [ ] Add runtime validation at external boundaries.
- [ ] Keep `pnpm typecheck` passing.
- [ ] Keep `pnpm lint` passing.
- [ ] Keep formatting stable under Biome.
- [ ] Avoid comments that only restate obvious code.
- [ ] Keep error handling explicit and actionable.
- [ ] Review all `process.exit` calls for cleanup safety.
- [ ] Review all filesystem paths for traversal and portability issues.
- [ ] Review all URL construction for query, path, and header correctness.

## 13. Test coverage

- [ ] Keep the existing parser, error-mapping, and span-builder tests.
- [ ] Add database unit tests.
- [ ] Add migration tests.
- [ ] Add deletion tests.
- [ ] Add API route tests.
- [ ] Add HTTP proxy JSON tests.
- [ ] Add HTTP proxy SSE tests.
- [ ] Add HTTP proxy compressed-response tests.
- [ ] Add HTTP proxy header-forwarding tests.
- [ ] Add HTTP proxy timeout and upstream-error tests.
- [ ] Add stdio lifecycle tests.
- [ ] Add notification and JSON-RPC error tests.
- [ ] Add dashboard API/client error tests where practical.
- [ ] Add a production dashboard browser smoke test.
- [ ] Add a test that verifies all expected package files exist after build.
- [ ] Add a test that runs the built CLI outside the repository root.
- [ ] Add an end-to-end test using a local fake MCP server.

## 14. Platform and runtime support

- [ ] Define supported operating systems and architectures.
- [ ] Test macOS arm64, especially Apple Silicon.
- [ ] Test macOS x64 if supported.
- [ ] Test Linux x64.
- [ ] Test Linux arm64 if supported.
- [ ] Decide whether Windows is supported; document it or explicitly defer it.
- [ ] Test Node.js 22.
- [ ] Test the next supported Node.js LTS before release.
- [ ] Verify `better-sqlite3` installation on every supported platform.
- [ ] Document native-build fallback requirements.
- [ ] Avoid assumptions about `HOME`, path separators, shell behavior, or
      executable lookup.
- [ ] Test paths containing spaces.

## 15. CI and release automation

- [ ] Use `pnpm install --frozen-lockfile` in CI.
- [ ] Run lint, typecheck, tests, and build in CI.
- [ ] Add a platform/version matrix appropriate to the support policy.
- [ ] Add a package dry-run job.
- [ ] Install the generated tarball in a clean temporary directory.
- [ ] Run `npx mcpscope --help` from that clean directory.
- [ ] Start the packaged dashboard outside the repository.
- [ ] Run a packaged HTTP proxy smoke test.
- [ ] Fail CI if required files are missing from the package.
- [ ] Add a release workflow that requires a tagged version.
- [ ] Generate or validate changelog entries.
- [ ] Publish with provenance if the npm/GitHub setup supports it.
- [ ] Never publish from a dirty or unverified working tree.
- [ ] Verify the published package from a fresh npm install.

## 16. Documentation

- [ ] Rewrite the root README as the primary user-facing guide.
- [ ] Document installation with npm:
      `npm install -g mcpscope`.
- [ ] Document local development with pnpm.
- [ ] Document Node.js requirements.
- [ ] Document stdio wrapping with VS Code MCP configuration.
- [ ] Document Streamable HTTP wrapping with VS Code MCP configuration.
- [ ] Document the difference between `wrap` and `wrap-http`.
- [ ] Document dashboard and API ports.
- [ ] Document database location and `MCPSCOPE_DB`.
- [ ] Document host binding and local-network exposure.
- [ ] Document payload capture and privacy implications.
- [ ] Document session/span deletion.
- [ ] Document backup and restore.
- [ ] Document retention cleanup.
- [ ] Document OTLP export as optional.
- [ ] Document known protocol limitations.
- [ ] Document troubleshooting for:
      - missing native SQLite module
      - port already in use
      - dashboard asset failures
      - upstream unavailable
      - VS Code MCP configuration
      - compressed HTTP responses
      - malformed MCP traffic
- [ ] Add a short architecture diagram.
- [ ] Add a supported-client matrix.
- [ ] Add examples for macOS and Linux.
- [ ] Keep implementation planning documents separate from end-user docs.

## 17. Npm package acceptance test

The release candidate is not complete until all of the following pass from a
clean temporary directory:

- [ ] `npm install -g mcpscope` succeeds.
- [ ] `mcpscope --version` prints the package version.
- [ ] `mcpscope --help` lists all supported commands.
- [ ] `mcpscope dashboard` starts on the documented default host and port.
- [ ] The dashboard HTML, JavaScript, and CSS all return `200`.
- [ ] `/api/health` returns a healthy response.
- [ ] A new database is created automatically.
- [ ] `mcpscope wrap -- <local-stdio-server>` forwards MCP traffic.
- [ ] `mcpscope wrap-http <url>` forwards JSON MCP traffic.
- [ ] HTTP SSE responses are handled if SSE is in the support contract.
- [ ] Sessions, spans, and raw frames are stored.
- [ ] The Timeline displays data.
- [ ] Sessions and Tools pages display data.
- [ ] Session deletion removes related data.
- [ ] The package works when launched outside the source directory.
- [ ] No manual schema or dashboard asset copy is required.
- [ ] `npm pack --dry-run` contains all required runtime files.
- [ ] No secrets, local databases, logs, or temporary files are included.

## 18. Release checklist

- [ ] All required TODOs above are complete or explicitly deferred.
- [ ] Deferred items are documented as known limitations.
- [ ] Version is bumped intentionally.
- [ ] Changelog is updated.
- [ ] README examples were tested against the release candidate.
- [ ] CI is green on the supported matrix.
- [ ] The npm tarball was installed and tested cleanly.
- [ ] The working tree contains no accidental build artifacts or databases.
- [ ] Package contents were reviewed with `npm pack --dry-run`.
- [ ] Security/privacy review is complete for local-network exposure.
- [ ] A rollback or unpublish plan is understood.
- [ ] The first release is published as a prerelease if uncertainty remains.
- [ ] The published package was installed from npm and smoke-tested.

## Recommended implementation order

1. Package metadata, dependency pinning, and tarball validation.
2. CLI options and localhost-safe defaults.
3. SQLite migrations, foreign keys, and transactional deletion.
4. Dashboard deletion and error/loading states.
5. HTTP and stdio lifecycle hardening.
6. Payload privacy and retention controls.
7. Integration, package, browser, and platform tests.
8. Documentation and release automation.
9. Prerelease publication and fresh-install verification.

