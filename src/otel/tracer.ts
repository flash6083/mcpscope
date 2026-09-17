import type { EventEmitter } from "node:events";
import { trace } from "@opentelemetry/api";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import type Database from "better-sqlite3";
import packageJson from "../../package.json";
import { logger } from "../log.js";
import { openDatabase } from "../store/db.js";
import { createSession } from "../store/queries.js";
import { createOTLPExporter } from "./exporters/otlp.js";
import { SQLiteSpanExporter } from "./exporters/sqlite.js";

let db: Database.Database | null = null;
let tracerProvider: BasicTracerProvider | null = null;

export function getTracer() {
  if (!tracerProvider) {
    throw new Error("Tracer not initialized. Call initTracer() first.");
  }
  return trace.getTracer("mcpscope");
}

function createSpanProcessor(exporter: SpanExporter): SpanProcessor {
  return {
    onStart: (_span: Span) => {},
    onEnd: (span: ReadableSpan) => {
      exporter.export([span], () => {});
    },
    shutdown: async () => {},
    forceFlush: async () => {},
  };
}

export function initTracer(sessionId: string, upstreamCmd: string, eventBus?: EventEmitter) {
  if (tracerProvider) {
    return;
  }

  db = openDatabase();
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: "mcpscope",
      [SemanticResourceAttributes.SERVICE_VERSION]: packageJson.version,
    }),
  );

  const sqliteExporter = new SQLiteSpanExporter(db, sessionId, eventBus);
  const otlpExporter = createOTLPExporter();

  const processors = [createSpanProcessor(sqliteExporter)];
  if (otlpExporter) {
    processors.push(createSpanProcessor(otlpExporter));
  }

  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: processors,
  });

  trace.setGlobalTracerProvider(tracerProvider);

  createSession(db, {
    id: sessionId,
    started_at: Date.now(),
    ended_at: null,
    upstream_cmd: upstreamCmd,
    protocol_version: null,
  });

  logger.info({ sessionId, upstreamCmd, otlp: !!otlpExporter }, "tracer initialized");
}

export function shutdownTracer() {
  if (tracerProvider) {
    tracerProvider.shutdown();
    tracerProvider = null;
  }
  if (db) {
    db.close();
    db = null;
  }
}
