import type { FastifyInstance } from "fastify";
import { spanEvents } from "./event-bus.js";

export async function registerSSE(app: FastifyInstance) {
  app.get("/api/events", async (request, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: "connected" });

    const onSpan = (span: unknown) => {
      send({ type: "span", span });
    };

    spanEvents.on("span", onSpan);

    request.raw.on("close", () => {
      spanEvents.off("span", onSpan);
    });

    return new Promise(() => {});
  });
}
