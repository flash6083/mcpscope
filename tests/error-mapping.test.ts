import { describe, it, expect } from "vitest";
import { classifyOutcome } from "../src/mcp/error-mapping.js";

describe("error-mapping", () => {
  it("classifies OK response", () => {
    const result = classifyOutcome({
      jsonrpc: "2.0",
      id: "1",
      result: { content: [{ type: "text", text: "hello" }] },
    });
    expect(result.code).toBe(1); // SpanStatusCode.OK
    expect(result.errorType).toBeUndefined();
  });

  it("classifies jsonrpc_error", () => {
    const result = classifyOutcome({
      jsonrpc: "2.0",
      id: "1",
      error: { code: -32600, message: "Invalid Request" },
    });
    expect(result.code).toBe(2); // SpanStatusCode.ERROR
    expect(result.errorType).toBe("jsonrpc_error");
    expect(result.message).toBe("Invalid Request");
  });

  it("classifies tool_error", () => {
    const result = classifyOutcome({
      jsonrpc: "2.0",
      id: "1",
      result: { content: [], isError: true },
    });
    expect(result.code).toBe(2); // SpanStatusCode.ERROR
    expect(result.errorType).toBe("tool_error");
    expect(result.message).toBe("Tool returned isError");
  });
});
