import { logger } from "../log.js";
import { createServer } from "../server/app.js";

export async function dashboardCommand() {
  const app = createServer();
  try {
    await app.listen({ port: 7878, host: "0.0.0.0" });
    logger.info("dashboard server listening on http://localhost:7878");
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}
