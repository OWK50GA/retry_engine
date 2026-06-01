import Database from "better-sqlite3";
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id            TEXT PRIMARY KEY,
    url           TEXT NOT NULL,
    method        TEXT NOT NULL,
    body          TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_retries   INTEGER NOT NULL DEFAULT 5,
    backoff_ms    INTEGER NOT NULL DEFAULT 1000,
    next_retry_at INTEGER,
    last_error    TEXT,
    result        TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id     TEXT NOT NULL REFERENCES requests(id),
    attempt_number INTEGER NOT NULL,
    status_code    INTEGER,
    error          TEXT,
    duration_ms    INTEGER NOT NULL,
    attempted_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requests_status_retry
    ON requests(status, next_retry_at);

  CREATE INDEX IF NOT EXISTS idx_attempts_request_id
    ON attempts(request_id);
`);

export default db;

console.log('Tables: ', db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table'`
).all());