import { trace } from "@opentelemetry/api";

export function injectIntoParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const span = trace.getActiveSpan();
  if (!span) return params ?? {};
  const sc = span.spanContext();
  const traceparent = `00-${sc.traceId}-${sc.spanId}-0${sc.traceFlags.toString(16)}`;
  return {
    ...(params ?? {}),
    _meta: {
      ...((params?._meta as Record<string, unknown> | undefined) ?? {}),
      traceparent,
    },
  };
}

export function extractFromParams(params: Record<string, unknown> | undefined): string | undefined {
  return (params?._meta as Record<string, unknown> | undefined)?.traceparent as string | undefined;
}
