import { useState } from "react";
import type { SpanFilters } from "../hooks/useLiveSpans.js";
import { useLiveSpans } from "../hooks/useLiveSpans.js";
import { StatusBadge } from "./StatusBadge.js";

export interface SpanRow {
  span_id: string;
  name: string;
  start_time: number;
  end_time: number;
  status: string;
  attributes: string;
  request_body: string | null;
  response_body: string | null;
}

export function TimelineTable({
  filters,
  onSelect,
}: {
  filters: SpanFilters;
  onSelect: (span: SpanRow) => void;
}) {
  const { spans, connected } = useLiveSpans(filters);
  const [_hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-2 text-xs text-gray-500">
        {connected ? "Connected to SSE" : "Disconnected"} · {spans.length} spans
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Duration</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {spans.map((span) => {
            const s = span as SpanRow;
            return (
              <tr
                key={s.span_id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(s)}
                onMouseEnter={() => setHovered(s.span_id)}
                onMouseLeave={() => setHovered(null)}
              >
                <td className="p-2">{new Date(s.start_time).toLocaleTimeString()}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.end_time - s.start_time}ms</td>
                <td className="p-2">
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
