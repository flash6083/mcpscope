import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";

export function createOTLPExporter(): SpanExporter | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return null;
  }
  return new OTLPTraceExporter({
    url: endpoint,
  });
}
