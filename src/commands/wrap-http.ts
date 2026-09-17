import { randomUUID } from "node:crypto";
import { logger } from "../log.js";
import { initTracer, shutdownTracer } from "../otel/tracer.js";
import { registerHttpProxy } from "../proxy/http.js";
import { createServer } from "../server/app.js";
import { spanEvents } from "../server/event-bus.js";

export async function wrapHttpCommand(upstreamUrl: string, port: number) {
  const sessionId = randomUUID();
  initTracer(sessionId, upstreamUrl, spanEvents);
  const app = createServer();
  registerHttpProxy(app, upstreamUrl, sessionId);

  try {
    await app.listen({ port, host: "127.0.0.1" });
    logger.info({ upstreamUrl, port }, "HTTP MCP proxy listening");
  } catch (error) {
    shutdownTracer();
    logger.error({ err: error }, "failed to start HTTP proxy");
    process.exitCode = 1;
  }
}
