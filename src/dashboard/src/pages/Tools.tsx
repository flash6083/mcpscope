import { useEffect, useState } from "react";
import { fetchTools } from "../lib/api.js";

export function Tools() {
  const [tools, setTools] = useState<any[]>([]);
  useEffect(() => {
    fetchTools().then((d) => setTools(d.tools));
  }, []);
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Tools</h2>
      <div className="grid gap-4">
        {tools.map((t) => (
          <div key={t.name} className="border rounded p-4">
            <h3 className="font-medium">{t.name}</h3>
            <p className="text-sm text-gray-500">
              {t.count} calls, avg {Math.round(t.avgLatency)}ms
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
