import { logger } from "../log.js";
import { runStdioProxy } from "../proxy/stdio.js";
import { createServer } from "../server/app.js";
import { spanEvents } from "../server/event-bus.js";

export async function wrapCommand(cmd: string, args: string[]) {
  logger.info({ cmd, args }, "wrapping stdio command");

  const app = createServer();
  try {
    await app.listen({ port: 7878, host: "0.0.0.0" });
    logger.info("dashboard server listening on http://localhost:7878");
  } catch (err) {
    logger.error({ err }, "failed to start server");
  }

  runStdioProxy(cmd, args, spanEvents);
}
