import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerRoutes } from "./routes.js";
import { registerSSE } from "./sse.js";
import { registerStatic } from "./static.js";

export function createServer() {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:3000"],
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  registerRoutes(app);
  registerSSE(app);
  registerStatic(app);

  return app;
}
