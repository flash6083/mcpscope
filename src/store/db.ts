import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import schema from "./schema.sql";

const DB_PATH =
  process.env.MCPSCOPE_DB ?? path.join(process.env.HOME ?? ".", ".mcpscope", "scope.db");

export function openDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(schema);
  return db;
}
