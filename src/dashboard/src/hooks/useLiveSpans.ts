import { useEffect, useState } from "react";
import { fetchSpans } from "../lib/api.js";
import { useEventSource } from "../lib/sse.js";

export interface SpanFilters {
  method?: string;
  status?: string;
}

export function useLiveSpans(filters: SpanFilters = {}) {
  const [spans, setSpans] = useState<unknown[]>([]);
  const [connected, setConnected] = useState(false);
  const esData = useEventSource("/api/events");

  useEffect(() => {
    fetchSpans({ ...filters, limit: 200 }).then((d) => setSpans(d.spans));
  }, [filters.method, filters.status]);

  useEffect(() => {
    if (!esData) return;
    if (esData.type === "connected") {
      setConnected(true);
    }
    if (esData.type === "span") {
      setSpans((prev) => {
        const filtered = matchesFilters(esData.span, filters);
        if (!filtered) return prev;
        return [esData.span, ...prev];
      });
    }
  }, [esData, filters.method, filters.status]);

  return { spans, connected };
}

function matchesFilters(span: unknown, filters: SpanFilters): boolean {
  const s = span as { status?: string; attributes?: Record<string, unknown> };
  if (filters.status && s.status !== filters.status) return false;
  if (filters.method && s.attributes?.["mcp.method.name"] !== filters.method) return false;
  return true;
}
