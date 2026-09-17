import { describe, it, expect } from "vitest";
import { trace, context } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { buildSpan } from "../src/otel/span-builder.js";
import { MCP_METHOD_NAME, MCP_PROTOCOL_VERSION, MCP_SESSION_ID, MCP_RESOURCE_URI, GEN_AI_OPERATION_NAME, GEN_AI_TOOL_NAME, JSONRPC_REQUEST_ID } from "../src/mcp/semconv.js";

describe("span-builder", () => {
  it("builds a tools/call span", () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: "mcpscope-test",
      }),
      spanProcessors: [
        {
          onStart: () => {},
          onEnd: (span: ReadableSpan) => exporter.export([span], () => {}),
          shutdown: async () => {},
          forceFlush: async () => {},
        } as any,
      ],
    });
    trace.setGlobalTracerProvider(provider);

    const request = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "hello" } },
    };

    const startTime = Date.now();
    buildSpan("session-1", request, undefined, startTime, startTime + 100);

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span.name).toBe("tools/call echo");
    expect(span.kind).toBe(0); // CLIENT
    expect((span.attributes as any)[MCP_METHOD_NAME]).toBe("tools/call");
    expect((span.attributes as any)[MCP_SESSION_ID]).toBe("session-1");
    expect((span.attributes as any)[GEN_AI_OPERATION_NAME]).toBe("execute_tool");
    expect((span.attributes as any)[GEN_AI_TOOL_NAME]).toBe("echo");
  });
});
