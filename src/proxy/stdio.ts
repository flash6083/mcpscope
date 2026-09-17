import { spawn } from "node:child_process";
import type { EventEmitter } from "node:events";
import { createFrameParser } from "../jsonrpc/parser.js";
import type { JsonRpcRequest, JsonRpcResponse } from "../jsonrpc/schema.js";
import { injectIntoParams } from "../otel/context.js";
import { buildSpan } from "../otel/span-builder.js";
import { initTracer, shutdownTracer } from "../otel/tracer.js";
import { openDatabase } from "../store/db.js";
import { insertRawFrame } from "../store/queries.js";

interface PendingRequest {
  startTime: number;
  request: JsonRpcRequest;
}

export function runStdioProxy(cmd: string, args: string[], eventBus?: EventEmitter) {
  const sessionId = crypto.randomUUID();
  initTracer(sessionId, `${cmd} ${args.join(" ")}`, eventBus);
  const db = openDatabase();

  const child = spawn(cmd, args, {
    stdio: ["pipe", "pipe", "inherit"],
  });

  const pendingRequests = new Map<string | number, PendingRequest>();

  function onFrame(direction: string, frame: unknown) {
    const body = JSON.stringify(frame);
    insertRawFrame(db, {
      session_id: sessionId,
      direction: direction === "client→server" ? "c2s" : "s2c",
      ts: Date.now(),
      method:
        typeof frame === "object" && frame !== null && "method" in frame
          ? String((frame as { method: unknown }).method)
          : null,
      jsonrpc_id:
        typeof frame === "object" && frame !== null && "id" in frame
          ? String((frame as { id: unknown }).id)
          : null,
      body,
    });

    if (
      direction === "client→server" &&
      typeof frame === "object" &&
      frame !== null &&
      "method" in frame
    ) {
      const reqFrame = frame as JsonRpcRequest;
      const params = injectIntoParams(reqFrame.params as Record<string, unknown> | undefined);
      const request: JsonRpcRequest = { ...reqFrame, params };
      const startTime = Date.now();
      if (typeof request.id !== "undefined") {
        pendingRequests.set(request.id, { startTime, request });
      }
    }

    if (
      direction === "server→client" &&
      typeof frame === "object" &&
      frame !== null &&
      "id" in frame
    ) {
      const respFrame = frame as JsonRpcResponse;
      const pendingData = pendingRequests.get(respFrame.id);
      if (pendingData) {
        pendingRequests.delete(respFrame.id);
        buildSpan(sessionId, pendingData.request, respFrame, pendingData.startTime, Date.now());
      }
    }
  }

  if (!child.stdin) {
    throw new Error("Child process has no stdin (stdio mode)");
  }
  process.stdin.pipe(createFrameParser((f) => onFrame("client→server", f))).pipe(child.stdin);
  child.stdout?.pipe(createFrameParser((f) => onFrame("server→client", f))).pipe(process.stdout);

  child.on("exit", (code) => {
    shutdownTracer();
    db.close();
    process.exit(code ?? 0);
  });

  process.on("SIGINT", async () => {
    shutdownTracer();
    db.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    shutdownTracer();
    db.close();
    process.exit(0);
  });
}
