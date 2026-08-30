'use strict';

// ---------------------------------------------------------------------------
// Repository layer. All queries below are written with `?` placeholders and
// column aliases so they run identically on SQLite (node:sqlite) and
// PostgreSQL (pg). Callers get only these functions — never raw SQL.
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();

const UPSELL_ARTIST = `
  INSERT INTO artists (slug, name, initials, tag, avatar_url, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (slug) DO UPDATE SET
    name = excluded.name,
    initials = excluded.initials,
    tag = excluded.tag,
    avatar_url = excluded.avatar_url,
    sort_order = excluded.sort_order,
    updated_at = excluded.updated_at`;

const UPSELL_SONG = `
  INSERT INTO songs (id, title, artist_id, youtube_id, mirror_id, duration, era, category, status, report_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    title = excluded.title,
    artist_id = excluded.artist_id,
    youtube_id = excluded.youtube_id,
    mirror_id = excluded.mirror_id,
    duration = excluded.duration,
    era = excluded.era,
    category = excluded.category,
    status = excluded.status,
    updated_at = excluded.updated_at`;

function upsertArtist(db, a, sortOrder) {
  const t = now();
  return db.adapter.run(UPSELL_ARTIST, [
    a.slug, a.name, a.initials || null, a.tag || null, a.avatarUrl || null, sortOrder ?? 0, t, t,
  ]);
}

function upsertSong(db, s) {
  const t = now();
  return db.adapter.run(UPSELL_SONG, [
    s.id, s.title, s.artistSlug, s.youtubeId, s.mirrorId || null,
    s.duration ?? null, s.era || null, s.category || null, s.status || 'active', t, t,
  ]);
}

async function listArtists(db) {
  const rows = await db.adapter.all(`
    SELECT a.slug, a.name, a.initials, a.tag, a.avatar_url AS avatarUrl, a.sort_order AS sortOrder,
           COUNT(s.id) AS songCount,
           COUNT(s.id) FILTER (WHERE s.status = 'active') AS activeCount
    FROM artists a
    LEFT JOIN songs s ON s.artist_id = a.slug
    GROUP BY a.slug
    ORDER BY a.sort_order ASC, a.name ASC`);
  return rows;
}

async function listSongs(db, { artistSlug, includeAll = false } = {}) {
  const where = [];
  const params = [];
  if (artistSlug) {
    where.push('a.slug = ?');
    params.push(artistSlug);
  }
  if (!includeAll) {
    where.push("s.status = 'active'");
  }
  const sql = `
    SELECT s.id, s.title, a.name AS artist, a.slug AS artistSlug,
           s.youtube_id AS youtubeId, s.mirror_id AS mirrorId,
           s.duration, s.era, s.category, s.status,
           s.report_count AS reportCount, s.last_checked AS lastChecked
    FROM songs s
    JOIN artists a ON a.slug = s.artist_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.sort_order ASC, a.name ASC, s.title ASC`;
  return db.adapter.all(sql, params);
}

async function getSong(db, id) {
  const rows = await db.adapter.all(`
    SELECT s.id, s.title, a.name AS artist, a.slug AS artistSlug,
           s.youtube_id AS youtubeId, s.mirror_id AS mirrorId,
           s.duration, s.era, s.category, s.status,
           s.report_count AS reportCount, s.last_checked AS lastChecked
    FROM songs s
    JOIN artists a ON a.slug = s.artist_id
    WHERE s.id = ?`, [id]);
  return rows[0] ?? null;
}

async function setSongStatus(db, id, status, checkedAt = null) {
  return db.adapter.run(
    'UPDATE songs SET status = ?, last_checked = ?, updated_at = ? WHERE id = ?',
    [status, checkedAt || now(), now(), id]);
}

async function touchChecked(db, id, status = null) {
  if (status) return setSongStatus(db, id, status);
  return db.adapter.run('UPDATE songs SET last_checked = ?, updated_at = ? WHERE id = ?', [now(), now(), id]);
}

// ---- Reports --------------------------------------------------------------

async function addReport(db, songId, reason = null) {
  const t = now();
  await db.adapter.run(
    'INSERT INTO song_reports (song_id, reason, created_at) VALUES (?, ?, ?)', [songId, reason || null, t]);
  await db.adapter.run(
    'UPDATE songs SET report_count = report_count + 1, updated_at = ? WHERE id = ?', [t, songId]);
  const row = await db.adapter.get('SELECT report_count AS n, status FROM songs WHERE id = ?', [songId]);
  return row ? { reportCount: row.n, status: row.status } : null;
}

async function reportCount(db, songId) {
  const row = await db.adapter.get('SELECT COUNT(*) AS n FROM song_reports WHERE song_id = ?', [songId]);
  return row ? row.n : 0;
}

// ---- Health checks / refresh ---------------------------------------------

async function staleSongs(db, { maxAgeMs = 3 * 24 * 60 * 60 * 1000, force = false } = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const rows = await db.adapter.all(`
    SELECT s.id, s.title, s.youtube_id AS youtubeId, s.mirror_id AS mirrorId,
           s.status, s.duration, s.last_checked AS lastChecked,
           a.slug AS artistSlug, a.name AS artist
    FROM songs s
    JOIN artists a ON a.slug = s.artist_id
    WHERE s.last_checked IS NULL OR s.last_checked < ? OR upper(?) = 'TRUE'
    ORDER BY s.last_checked IS NULL DESC, s.updated_at ASC`, [cutoff, force ? 'TRUE' : 'FALSE']);
  return rows;
}

async function stats(db) {
  const byStatus = await db.adapter.all('SELECT status, COUNT(*) AS n FROM songs GROUP BY status');
  const artists = await db.adapter.get('SELECT COUNT(*) AS n FROM artists');
  const totals = await db.adapter.get('SELECT COUNT(*) AS n FROM songs');
  const summary = { active: 0, dead: 0, private: 0 };
  for (const r of byStatus) summary[r.status] = r.n;
  return {
    songs: totals.n,
    artists: artists.n,
    byStatus: summary,
  };
}

module.exports = {
  upsertArtist, upsertSong, listArtists, listSongs, getSong,
  setSongStatus, touchChecked, addReport, reportCount, staleSongs, stats,
};