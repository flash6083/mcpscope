import { SpanStatusCode } from "@opentelemetry/api";
import type { JsonRpcResponse } from "../jsonrpc/schema.js";

export type Outcome = {
  code: SpanStatusCode;
  errorType?: string;
  message?: string;
};

export function classifyOutcome(response: JsonRpcResponse): Outcome {
  if (response.error) {
    return {
      code: SpanStatusCode.ERROR,
      errorType: "jsonrpc_error",
      message: response.error.message ?? "JSON-RPC error",
    };
  }
  const result = response.result as { isError?: boolean; content?: unknown } | undefined;
  if (result?.isError === true) {
    return {
      code: SpanStatusCode.ERROR,
      errorType: "tool_error",
      message: "Tool returned isError",
    };
  }
  return { code: SpanStatusCode.OK };
}
