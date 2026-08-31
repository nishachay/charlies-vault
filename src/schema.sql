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

-- Alternate versions / variants of a song (e.g. "V2 · demo cut", "radio rip").
-- The canonical best/default source lives on `songs.youtube_id`; everything
-- else lives here. Each version has its own status + report count so one bad
-- mirror never sinks the whole track.
CREATE TABLE IF NOT EXISTS song_versions (
  id           TEXT PRIMARY KEY,
  song_id      TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  youtube_id   TEXT NOT NULL,
  notes        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dead', 'private')),
  report_count INTEGER NOT NULL DEFAULT 0,
  last_checked TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_song ON song_versions(song_id);

CREATE TABLE IF NOT EXISTS song_reports (
  id         INTEGER PRIMARY KEY,
  song_id    TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES song_versions(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_song ON song_reports(song_id);

-- Admin content queue: tracks a curator verified on the admin page, awaiting
-- auto-application by the GitHub Action (scripts/add_tracks.js + build/sync).
-- Stored in the DB so serverless (Vercel) can write it without touching the
-- repo filesystem; the Action reads it via the authed API, applies the change,
-- then clears the queue.
CREATE TABLE IF NOT EXISTS pending_tracks (
  id         INTEGER PRIMARY KEY,
  url        TEXT NOT NULL,
  artist     TEXT,
  requested_title TEXT,
  title      TEXT,
  real_title TEXT,
  real_author TEXT,
  playable   INTEGER NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TEXT NOT NULL,
  applied_at TEXT
);