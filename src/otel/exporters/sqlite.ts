import type { EventEmitter } from "node:events";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type Database from "better-sqlite3";

export class SQLiteSpanExporter implements SpanExporter {
  constructor(
    private db: Database.Database,
    private sessionId: string,
    private events?: EventEmitter,
  ) {}

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void) {
    try {
      for (const span of spans) {
        const attributes: Record<string, unknown> = {};
        Object.entries(span.attributes).forEach(([k, v]) => {
          attributes[k] = v;
        });

        const stmt = this.db.prepare(
          `INSERT OR REPLACE INTO spans 
           (span_id, trace_id, parent_span_id, session_id, name, kind, start_time, end_time, status, status_message, attributes, events, request_body, response_body) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        const status = span.status.code === 1 ? "OK" : "ERROR";

        stmt.run(
          span.spanContext().spanId,
          span.spanContext().traceId,
          span.parentSpanContext?.spanId ?? null,
          this.sessionId,
          span.name,
          "CLIENT",
          Math.floor(span.startTime[0] * 1000),
          Math.floor(span.endTime[0] * 1000),
          status,
          span.status.message ?? null,
          JSON.stringify(attributes),
          JSON.stringify(
            span.events.map((e) => ({
              name: e.name,
              time: Math.floor(e.time[0] * 1000),
              attributes: e.attributes as Record<string, unknown>,
            })),
          ),
          null,
          null,
        );

        this.events?.emit("span", {
          span_id: span.spanContext().spanId,
          trace_id: span.spanContext().traceId,
          name: span.name,
          status,
          start_time: Math.floor(span.startTime[0] * 1000),
          end_time: Math.floor(span.endTime[0] * 1000),
          attributes,
        });
      }
      resultCallback({ code: 0 });
    } catch (err) {
      console.error("SQLite export failed:", err);
      resultCallback({ code: 1 });
    }
  }

  async shutdown() {
    // no-op for sqlite
  }

  async forceFlush() {
    // no-op for sqlite
  }
}
