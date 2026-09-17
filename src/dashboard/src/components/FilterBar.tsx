import { useEffect, useState } from "react";
import type { SpanFilters } from "../hooks/useLiveSpans.js";

export function FilterBar({ onFilter }: { onFilter: (f: SpanFilters) => void }) {
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    onFilter({
      method: method || undefined,
      status: status || undefined,
    });
  }, [method, status, onFilter]);

  return (
    <div className="flex gap-2 p-4 border-b bg-white">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="">All methods</option>
        <option value="tools/call">tools/call</option>
        <option value="tools/list">tools/list</option>
        <option value="resources/read">resources/read</option>
        <option value="prompts/get">prompts/get</option>
        <option value="initialize">initialize</option>
      </select>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="">All statuses</option>
        <option value="OK">OK</option>
        <option value="ERROR">ERROR</option>
      </select>
    </div>
  );
}
