'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Database bootstrap.
//
//   DATABASE_URL set        -> PostgreSQL via `pg`   (production: Neon/Supabase)
//   DATABASE_URL unset      -> SQLite via `node:sqlite` (local dev / tests)
//
// `pg` is loaded lazily so local development never needs `npm install`.
// Placeholders in SQL are always written as `?`; the pg adapter rewrites them
// to `$1, $2, ...` at call time.
// ---------------------------------------------------------------------------

function rewritePlaceholders(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function assertSqlite() {
  try {
    return require('node:sqlite');
  } catch (err) {
    throw new Error('node:sqlite is unavailable — use Node >= 22.5 or set DATABASE_URL for Postgres.');
  }
}

function createPgAdapter(connectionString) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPoolMax || 10),
  });

  return {
    kind: 'postgres',
    async exec(sql) {
      await pool.query(sql);
    },
    async all(sql, params = []) {
      const { rows } = await pool.query(rewritePlaceholders(sql), params);
      return rows;
    },
    async get(sql, params = []) {
      const { rows } = await pool.query(rewritePlaceholders(sql), params);
      return rows[0] ?? null;
    },
    async run(sql, params = []) {
      const res = await pool.query(rewritePlaceholders(sql), params);
      return { changes: res.rowCount ?? 0, lastInsertRowid: Number(res.rows?.[0]?.id ?? 0) };
    },
    async close() {
      await pool.end();
    },
  };
}

function createSqliteAdapter(dbPath) {
  const { DatabaseSync } = assertSqlite();
  const filename = dbPath === ':memory:' ? ':memory:' : (dbPath || path.join(process.cwd(), 'data', 'vault.db'));
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON;');

  return {
    kind: 'sqlite',
    exec(sql) {
      db.exec(sql);
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
    },
    close() {
      db.close();
    },
  };
}

function createDb(config = {}) {
  const connectionString = config.connectionString ?? process.env.DATABASE_URL;
  const dbPath = config.dbPath ?? process.env.DB_PATH;
  const adapter = connectionString
    ? createPgAdapter(connectionString)
    : createSqliteAdapter(dbPath);

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  function migrate() {
    adapter.exec(schemaSql);
  }

  async function dumpJson() {
    const artists = await adapter.all('SELECT slug, name, initials, tag, avatar_url AS avatarUrl, sort_order AS sortOrder FROM artists ORDER BY sort_order, name');
    const songs = await adapter.all(
      `SELECT s.id, s.title, a.name AS artist, s.youtube_id AS youtubeId, s.mirror_id AS mirrorId,
              s.duration, s.era, s.category, s.status, s.report_count AS reportCount,
              s.last_checked AS lastChecked, s.created_at AS createdAt, s.updated_at AS updatedAt
       FROM songs s JOIN artists a ON a.slug = s.artist_id ORDER BY a.sort_order, a.name, s.title`
    );
    return { artists, songs };
  }

  return { adapter, migrate, dumpJson };
}

module.exports = { createDb, rewritePlaceholders };