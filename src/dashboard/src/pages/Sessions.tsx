import { useEffect, useState } from "react";
import { fetchSessions } from "../lib/api.js";

export function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    fetchSessions().then((d) => setSessions(d.sessions));
  }, []);
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Sessions</h2>
      <div className="grid gap-4">
        {sessions.map((s) => (
          <div key={s.id} className="border rounded p-4">
            <h3 className="font-medium">{s.id}</h3>
            <p className="text-sm text-gray-500">
              {new Date(s.started_at).toLocaleString()} - {s.upstream_cmd}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
