import { useEffect, useState } from "react";
import { fetchSpans } from "../lib/api.js";
import type { SpanFilters } from "./useLiveSpans.js";

export function useSpansQuery(filters: SpanFilters = {}, limit = 100) {
  const [spans, setSpans] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchSpans({ ...filters, limit: String(limit) })
      .then((d) => setSpans(d.spans))
      .finally(() => setLoading(false));
  }, [filters.method, filters.status, limit]);

  return { spans, loading };
}
