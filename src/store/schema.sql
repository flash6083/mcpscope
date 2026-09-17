CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  started_at     INTEGER NOT NULL,
  ended_at       INTEGER,
  upstream_cmd   TEXT NOT NULL,
  protocol_version TEXT
);

CREATE TABLE IF NOT EXISTS spans (
  span_id        TEXT PRIMARY KEY,
  trace_id       TEXT NOT NULL,
  parent_span_id TEXT,
  session_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL,
  start_time     INTEGER NOT NULL,
  end_time       INTEGER NOT NULL,
  status         TEXT NOT NULL,
  status_message TEXT,
  attributes     TEXT NOT NULL,
  events         TEXT NOT NULL,
  request_body   TEXT,
  response_body  TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_spans_session ON spans(session_id);
CREATE INDEX IF NOT EXISTS idx_spans_start ON spans(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_spans_method ON spans(json_extract(attributes, '$."mcp.method.name"'));

CREATE TABLE IF NOT EXISTS raw_frames (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  direction    TEXT NOT NULL,
  ts           INTEGER NOT NULL,
  method       TEXT,
  jsonrpc_id   TEXT,
  body         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_session ON raw_frames(session_id);
