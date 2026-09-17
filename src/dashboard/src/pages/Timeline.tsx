import { useState } from "react";
import { FilterBar } from "../components/FilterBar.js";
import { SpanDetailSheet } from "../components/SpanDetailSheet.js";
import type { SpanRow } from "../components/TimelineTable.js";
import { TimelineTable } from "../components/TimelineTable.js";
import type { SpanFilters } from "../hooks/useLiveSpans.js";

export function Timeline() {
  const [selected, setSelected] = useState<SpanRow | null>(null);
  const [filters, setFilters] = useState<SpanFilters>({});

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <FilterBar onFilter={setFilters} />
      <div className="flex-1 overflow-y-auto">
        <TimelineTable filters={filters} onSelect={setSelected} />
      </div>
      <SpanDetailSheet span={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
