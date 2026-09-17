import type Database from "better-sqlite3";

export type SessionRow = {
  id: string;
  started_at: number;
  ended_at: number | null;
  upstream_cmd: string;
  protocol_version: string | null;
};

export type RawFrameRow = {
  id: number;
  session_id: string;
  direction: string;
  ts: number;
  method: string | null;
  jsonrpc_id: string | null;
  body: string;
};

export type SpanRow = {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  session_id: string;
  name: string;
  kind: string;
  start_time: number;
  end_time: number;
  status: string;
  status_message: string | null;
  attributes: string;
  events: string;
  request_body: string | null;
  response_body: string | null;
};

export function createSession(db: Database.Database, session: SessionRow) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO sessions (id, started_at, ended_at, upstream_cmd, protocol_version) VALUES (?, ?, ?, ?, ?)",
  );
  return stmt.run(
    session.id,
    session.started_at,
    session.ended_at,
    session.upstream_cmd,
    session.protocol_version,
  );
}

export function insertRawFrame(db: Database.Database, frame: Omit<RawFrameRow, "id">) {
  const stmt = db.prepare(
    "INSERT INTO raw_frames (session_id, direction, ts, method, jsonrpc_id, body) VALUES (?, ?, ?, ?, ?, ?)",
  );
  return stmt.run(
    frame.session_id,
    frame.direction,
    frame.ts,
    frame.method,
    frame.jsonrpc_id,
    frame.body,
  );
}

export function insertSpan(
  db: Database.Database,
  span: Omit<SpanRow, "span_id"> & { span_id: string },
) {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO spans 
     (span_id, trace_id, parent_span_id, session_id, name, kind, start_time, end_time, status, status_message, attributes, events, request_body, response_body) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return stmt.run(
    span.span_id,
    span.trace_id,
    span.parent_span_id,
    span.session_id,
    span.name,
    span.kind,
    span.start_time,
    span.end_time,
    span.status,
    span.status_message,
    span.attributes,
    span.events,
    span.request_body,
    span.response_body,
  );
}

export function getSpansBySession(db: Database.Database, sessionId: string): SpanRow[] {
  const stmt = db.prepare("SELECT * FROM spans WHERE session_id = ? ORDER BY start_time DESC");
  return stmt.all(sessionId) as SpanRow[];
}

export function getSpans(db: Database.Database): SpanRow[] {
  const stmt = db.prepare("SELECT * FROM spans ORDER BY start_time DESC");
  return stmt.all() as SpanRow[];
}

export function getSessions(db: Database.Database): SessionRow[] {
  const stmt = db.prepare("SELECT * FROM sessions ORDER BY started_at DESC");
  return stmt.all() as SessionRow[];
}
