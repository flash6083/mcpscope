import { context, trace } from "@opentelemetry/api";
import { captureLevel, maybeCapture } from "../config.js";
import type { JsonRpcRequest, JsonRpcResponse } from "../jsonrpc/schema.js";
import { classifyOutcome } from "../mcp/error-mapping.js";
import { WellKnownMethods } from "../mcp/methods.js";
import {
  GEN_AI_OPERATION_NAME,
  GEN_AI_TOOL_NAME,
  JSONRPC_REQUEST_ID,
  MCP_METHOD_NAME,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_URI,
  MCP_SESSION_ID,
} from "../mcp/semconv.js";

export function buildSpan(
  sessionId: string,
  request: JsonRpcRequest,
  response: JsonRpcResponse | undefined,
  _startTime: number,
  endTime: number,
) {
  const tracer = trace.getTracer("mcpscope");
  const method = typeof request.method === "string" ? request.method : "unknown";
  const requestId = typeof request.id === "string" ? request.id : String(request.id ?? "");
  const parentContext = context.active();

  let target = "";
  if (method === WellKnownMethods.ToolsCall) {
    const params = request.params as { name?: string } | undefined;
    target = params?.name ?? "";
  } else if (method === WellKnownMethods.ResourcesRead) {
    const params = request.params as { uri?: string } | undefined;
    target = params?.uri ?? "";
  }

  const spanName = `${method}${target ? ` ${target}` : ""}`;

  const span = tracer.startSpan(spanName, { kind: 0 /* CLIENT */ }, parentContext);
  span.setAttribute(MCP_METHOD_NAME, method);
  const paramsRecord = request.params as { protocolVersion?: string } | undefined;
  span.setAttribute(MCP_PROTOCOL_VERSION, paramsRecord?.protocolVersion ?? "2025-03-26");
  span.setAttribute(MCP_SESSION_ID, sessionId);
  if (target) {
    span.setAttribute(MCP_RESOURCE_URI, target);
  }
  span.setAttribute(
    GEN_AI_OPERATION_NAME,
    method === WellKnownMethods.ToolsCall ? "execute_tool" : method,
  );
  if (method === WellKnownMethods.ToolsCall) {
    span.setAttribute(GEN_AI_TOOL_NAME, target);
  }
  span.setAttribute(JSONRPC_REQUEST_ID, requestId);

  if (captureLevel !== "none") {
    span.setAttribute("request.body", maybeCapture(request.params) ?? "");
  }

  if (response) {
    const outcome = classifyOutcome(response);
    span.setStatus({ code: outcome.code, message: outcome.message });
    if (outcome.errorType) {
      span.setAttribute("error.type", outcome.errorType);
    }
    if (captureLevel !== "none") {
      span.setAttribute("response.body", maybeCapture(response.result) ?? "");
    }
  } else {
    span.setStatus({ code: 2 /* ERROR */, message: "No response" });
  }

  span.end(endTime);

  return span;
}
