import type { FastifyInstance } from "fastify";
import { openDatabase } from "../store/db.js";
import { getSessions, getSpans, getSpansBySession } from "../store/queries.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/spans", async (request) => {
    const db = openDatabase();
    const {
      session_id,
      method,
      status,
      since,
      limit = "100",
    } = request.query as Record<string, string>;
    let rows = session_id ? getSpansBySession(db, session_id) : getSpans(db);
    if (method) {
      rows = rows.filter((r) => JSON.parse(r.attributes)["mcp.method.name"] === method);
    }
    if (status) {
      rows = rows.filter((r) => r.status === status);
    }
    if (since) {
      rows = rows.filter((r) => r.start_time >= Number(since));
    }
    const limited = rows.slice(0, Number(limit));
    db.close();
    return { spans: limited };
  });

  app.get("/api/sessions", async () => {
    const db = openDatabase();
    const rows = getSessions(db);
    db.close();
    return { sessions: rows };
  });

  app.get("/api/tools", async () => {
    const db = openDatabase();
    const sessions = getSessions(db);
    const tools = new Map<string, { name: string; count: number; avgLatency: number }>();
    for (const session of sessions) {
      const spans = getSpansBySession(db, session.id);
      for (const span of spans) {
        const attrs = JSON.parse(span.attributes);
        if (attrs["mcp.method.name"] === "tools/call") {
          const name = attrs["gen_ai.tool.name"] ?? "unknown";
          const existing = tools.get(name) ?? { name, count: 0, avgLatency: 0 };
          existing.count++;
          existing.avgLatency =
            (existing.avgLatency * (existing.count - 1) + span.end_time - span.start_time) /
            existing.count;
          tools.set(name, existing);
        }
      }
    }
    db.close();
    return { tools: Array.from(tools.values()) };
  });
}
