-- Shared DDL for { OUTTAKE }. Portable across both backends:
--   * SQLite (local dev / tests, via node:sqlite)
--   * PostgreSQL (production, e.g. Neon / Supabase, via pg)
--
-- All timestamps are ISO-8601 TEXT written by the app, so no dialect-specific
-- defaults (datetime('now') vs now()) are needed.

CREATE TABLE IF NOT EXISTS artists (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  initials   TEXT,
  tag        TEXT,
  avatar_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  artist_id    TEXT NOT NULL REFERENCES artists(slug),
  youtube_id   TEXT NOT NULL,
  mirror_id    TEXT,
  duration     INTEGER,
  era          TEXT,
  category     TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dead', 'private')),
  report_count INTEGER NOT NULL DEFAULT 0,
  last_checked TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);

CREATE TABLE IF NOT EXISTS song_reports (
  id         INTEGER PRIMARY KEY,
  song_id    TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_song ON song_reports(song_id);