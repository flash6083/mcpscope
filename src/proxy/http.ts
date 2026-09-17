import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JsonRpcRequest, JsonRpcResponse } from "../jsonrpc/schema.js";
import { buildSpan } from "../otel/span-builder.js";
import { openDatabase } from "../store/db.js";
import { insertRawFrame } from "../store/queries.js";

type PendingRequest = {
  request: JsonRpcRequest;
  startTime: number;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "content-encoding",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requestId(id: unknown): string {
  return `${typeof id}:${String(id)}`;
}

function traceparent() {
  return `00-${randomUUID().replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16)}-01`;
}

function asRequests(body: unknown): JsonRpcRequest[] {
  const messages = Array.isArray(body) ? body : [body];
  return messages.filter(
    (message): message is JsonRpcRequest =>
      typeof message === "object" &&
      message !== null &&
      "method" in message &&
      typeof message.method === "string" &&
      "id" in message,
  );
}

function asResponses(body: unknown): JsonRpcResponse[] {
  const messages = Array.isArray(body) ? body : [body];
  return messages.filter(
    (message): message is JsonRpcResponse =>
      typeof message === "object" && message !== null && "id" in message && !("method" in message),
  );
}

function recordFrame(
  db: ReturnType<typeof openDatabase>,
  sessionId: string,
  direction: "c2s" | "s2c",
  body: unknown,
) {
  const method =
    typeof body === "object" && body !== null && "method" in body
      ? String((body as { method: unknown }).method)
      : null;
  const id =
    typeof body === "object" && body !== null && "id" in body
      ? String((body as { id: unknown }).id)
      : null;
  insertRawFrame(db, {
    session_id: sessionId,
    direction,
    ts: Date.now(),
    method,
    jsonrpc_id: id,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function completeResponses(
  responses: JsonRpcResponse[],
  pending: Map<string, PendingRequest>,
  sessionId: string,
) {
  for (const response of responses) {
    const pendingRequest = pending.get(requestId(response.id));
    if (!pendingRequest) continue;
    pending.delete(requestId(response.id));
    buildSpan(sessionId, pendingRequest.request, response, pendingRequest.startTime, Date.now());
  }
}

function copyResponseHeaders(reply: FastifyReply, response: Response) {
  for (const [name, value] of response.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      reply.header(name, value);
    }
  }
}

async function forwardStream(
  response: Response,
  reply: FastifyReply,
  pending: Map<string, PendingRequest>,
  sessionId: string,
  db: ReturnType<typeof openDatabase>,
) {
  if (!response.body) {
    reply.code(response.status).send();
    return;
  }

  reply.hijack();
  reply.raw.writeHead(response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let event = "";

  const consumeEvent = (payload: string) => {
    const data = payload
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    try {
      const parsed: unknown = JSON.parse(data);
      recordFrame(db, sessionId, "s2c", parsed);
      completeResponses(asResponses(parsed), pending, sessionId);
    } catch {
      // Non-JSON SSE events are part of the transport, not MCP messages.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    reply.raw.write(value);
    event += decoder.decode(value, { stream: true });
    let separator = event.search(/\r?\n\r?\n/);
    while (separator !== -1) {
      const match = event.slice(separator).match(/^\r?\n\r?\n/);
      const separatorLength = match?.[0].length ?? 2;
      consumeEvent(event.slice(0, separator));
      event = event.slice(separator + separatorLength);
      separator = event.search(/\r?\n\r?\n/);
    }
  }
  event += decoder.decode();
  if (event.trim()) consumeEvent(event);
  reply.raw.end();
}

export function registerHttpProxy(app: FastifyInstance, upstreamUrl: string, sessionId: string) {
  const upstream = new URL(upstreamUrl);
  const db = openDatabase();
  const routePath = upstream.pathname || "/";

  app.route({
    method: ["DELETE", "GET", "POST"],
    url: routePath,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body;
      const encodedBody =
        body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
      const requests = asRequests(body);
      const pending = new Map<string, PendingRequest>();
      for (const mcpRequest of requests) {
        const startTime = Date.now();
        pending.set(requestId(mcpRequest.id), { request: mcpRequest, startTime });
        recordFrame(db, sessionId, "c2s", mcpRequest);
      }

      const target = new URL(upstream);
      target.search = new URL(request.url, "http://mcpscope.local").search || target.search;
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || value === undefined) continue;
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      headers.set("traceparent", request.headers.traceparent?.toString() || traceparent());
      if (!headers.has("accept")) headers.set("accept", "application/json, text/event-stream");

      let response: Response;
      try {
        response = await fetch(target, {
          method: request.method,
          headers,
          body: encodedBody,
        });
      } catch {
        for (const pendingRequest of pending.values()) {
          buildSpan(
            sessionId,
            pendingRequest.request,
            undefined,
            pendingRequest.startTime,
            Date.now(),
          );
        }
        return reply.status(502).send({ error: "Upstream MCP server unavailable" });
      }

      copyResponseHeaders(reply, response);
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        await forwardStream(response, reply, pending, sessionId, db);
        return;
      }

      const responseText = await response.text();
      if (responseText) {
        try {
          const parsed: unknown = JSON.parse(responseText);
          recordFrame(db, sessionId, "s2c", parsed);
          completeResponses(asResponses(parsed), pending, sessionId);
        } catch {
          // Preserve non-JSON upstream responses while leaving MCP spans pending.
        }
      }
      for (const pendingRequest of pending.values()) {
        buildSpan(
          sessionId,
          pendingRequest.request,
          undefined,
          pendingRequest.startTime,
          Date.now(),
        );
      }
      return reply.code(response.status).send(responseText);
    },
  });

  app.addHook("onClose", async () => {
    db.close();
  });
}
