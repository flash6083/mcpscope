import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

export function registerStatic(app: FastifyInstance) {
  // The CLI is commonly invoked from a project other than the one that
  // installed mcpscope. Resolve assets relative to the published CLI first.
  const packageDir = dirname(fileURLToPath(import.meta.url));
  const assetsDir = join(packageDir, "assets");

  app.get("/assets/*", async (request, reply) => {
    const path = (request.params as { "*": string })["*"];
    const filePath = join(assetsDir, path);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }
    const content = readFileSync(filePath);
    const ext = path.split(".").pop();
    const mimeTypes: Record<string, string> = {
      js: "application/javascript",
      css: "text/css",
      html: "text/html",
      json: "application/json",
      png: "image/png",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    };
    reply.type(mimeTypes[ext ?? ""] ?? "application/octet-stream");
    return reply.send(content);
  });

  app.get("*", async (_request, reply) => {
    const indexPath = join(assetsDir, "index.html");
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, "utf-8");
      return reply.type("text/html").send(html);
    }
    return reply.status(404).send({ error: "Dashboard not built. Run pnpm build." });
  });
}
