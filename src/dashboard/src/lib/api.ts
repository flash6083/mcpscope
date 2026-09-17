const API_BASE = "/api";

export async function fetchSpans(params?: {
  session_id?: string;
  method?: string;
  status?: string;
  since?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.session_id) qs.set("session_id", params.session_id);
  if (params?.method) qs.set("method", params.method);
  if (params?.status) qs.set("status", params.status);
  if (params?.since) qs.set("since", String(params.since));
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/spans?${qs}`);
  return res.json() as Promise<{ spans: any[] }>;
}

export async function fetchSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  return res.json() as Promise<{ sessions: any[] }>;
}

export async function fetchTools() {
  const res = await fetch(`${API_BASE}/tools`);
  return res.json() as Promise<{ tools: any[] }>;
}
