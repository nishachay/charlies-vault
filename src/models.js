'use strict';

// ---------------------------------------------------------------------------
// Repository layer. All queries below are written with `?` placeholders and
// column aliases so they run identically on SQLite (node:sqlite) and
// PostgreSQL (pg). Callers get only these functions — never raw SQL.
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();

// A version's stable id is derived from the parent song + its position in the
// catalog's `versions` array, so it survives re-seeds and round-trips
// (catalog.json <-> index.html <-> DB) without being stored in the catalog.
function versionIdOf(songId, index) {
  return `${songId}__v${index + 1}`;
}

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

const UPSELL_VERSION = `
  INSERT INTO song_versions (id, song_id, label, youtube_id, notes, sort_order, status, report_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    song_id = excluded.song_id,
    label = excluded.label,
    youtube_id = excluded.youtube_id,
    notes = excluded.notes,
    sort_order = excluded.sort_order,
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

function upsertSongVersion(db, v) {
  const t = now();
  return db.adapter.run(UPSELL_VERSION, [
    v.id, v.songId, v.label, v.youtubeId, v.notes || null, v.sortOrder ?? 0, v.status || 'active', t, t,
  ]);
}

async function listArtists(db) {
  const rows = await db.adapter.all(`
    SELECT a.slug, a.name, a.initials, a.tag, a.avatar_url AS avatarUrl, a.sort_order AS sortOrder,
           COUNT(s.id) AS songCount,
           COUNT(s.id) FILTER (WHERE s.status = 'active'
             OR EXISTS (SELECT 1 FROM song_versions v WHERE v.song_id = s.id AND v.status = 'active')) AS activeCount
    FROM artists a
    LEFT JOIN songs s ON s.artist_id = a.slug
    GROUP BY a.slug
    ORDER BY a.sort_order ASC, a.name ASC`);
  return rows;
}

async function versionsForSongs(db, songIds, includeAll = false) {
  if (!songIds.length) return [];
  const statusClause = includeAll ? '' : "AND v.status = 'active' ";
  const rows = await db.adapter.all(`
    SELECT v.id, v.song_id AS songId, v.label, v.youtube_id AS youtubeId, v.notes,
           v.sort_order AS sortOrder, v.status,
           v.report_count AS reportCount, v.last_checked AS lastChecked
    FROM song_versions v
    WHERE v.song_id IN (${songIds.map(() => '?').join(',')})
    ${statusClause}
    ORDER BY v.sort_order ASC`, songIds);
  const bySong = new Map(songIds.map(id => [id, []]));
  for (const r of rows) bySong.get(r.songId)?.push(r);
  return bySong;
}

const SONG_SELECT = `
  SELECT s.id, s.title, a.name AS artist, a.slug AS artistSlug,
         s.youtube_id AS youtubeId, s.mirror_id AS mirrorId,
         s.duration, s.era, s.category, s.status,
         s.report_count AS reportCount, s.last_checked AS lastChecked
  FROM songs s
  JOIN artists a ON a.slug = s.artist_id`;

async function listSongs(db, { artistSlug, includeAll = false } = {}) {
  const where = [];
  const params = [];
  if (artistSlug) {
    where.push('a.slug = ?');
    params.push(artistSlug);
  }
  if (!includeAll) {
    where.push(`(s.status = 'active'
       OR EXISTS (SELECT 1 FROM song_versions v WHERE v.song_id = s.id AND v.status = 'active'))`);
  }
  const sql = `
    ${SONG_SELECT}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.sort_order ASC, a.name ASC, s.title ASC`;
  const rows = await db.adapter.all(sql, params);
  return attachVersions(db, rows, includeAll);
}

async function getSong(db, id, { includeAll = false } = {}) {
  const rows = await db.adapter.all(`${SONG_SELECT} WHERE s.id = ?`, [id]);
  const rows2 = await attachVersions(db, rows, includeAll);
  return rows2[0] ?? null;
}

async function attachVersions(db, rows, includeAll) {
  if (!rows.length) return rows;
  const bySong = await versionsForSongs(db, rows.map(r => r.id), includeAll);
  return rows.map(r => ({ ...r, versions: bySong.get(r.id) || [] }));
}

async function setSongStatus(db, id, status, checkedAt = null) {
  return db.adapter.run(
    'UPDATE songs SET status = ?, last_checked = ?, updated_at = ? WHERE id = ?',
    [status, checkedAt || now(), now(), id]);
}

async function setSongVersionStatus(db, id, status, checkedAt = null) {
  return db.adapter.run(
    'UPDATE song_versions SET status = ?, last_checked = ?, updated_at = ? WHERE id = ?',
    [status, checkedAt || now(), now(), id]);
}

async function touchChecked(db, id, status = null) {
  if (status) return setSongStatus(db, id, status);
  return db.adapter.run('UPDATE songs SET last_checked = ?, updated_at = ? WHERE id = ?', [now(), now(), id]);
}

async function touchVersionChecked(db, id, status = null) {
  if (status) return setSongVersionStatus(db, id, status);
  return db.adapter.run('UPDATE song_versions SET last_checked = ?, updated_at = ? WHERE id = ?', [now(), now(), id]);
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

async function addVersionReport(db, versionId, reason = null) {
  const v = await db.adapter.get(
    'SELECT song_id AS songId, report_count AS n, status FROM song_versions WHERE id = ?', [versionId]);
  if (!v) return null;
  const t = now();
  await db.adapter.run(
    'INSERT INTO song_reports (song_id, version_id, reason, created_at) VALUES (?, ?, ?, ?)',
    [v.songId, versionId, reason || null, t]);
  await db.adapter.run(
    'UPDATE song_versions SET report_count = report_count + 1, updated_at = ? WHERE id = ?', [t, versionId]);
  return { songId: v.songId, reportCount: v.n + 1, status: v.status };
}

async function reportCount(db, songId) {
  const row = await db.adapter.get(
    'SELECT COUNT(*) AS n FROM song_reports WHERE song_id = ? AND version_id IS NULL', [songId]);
  return row ? row.n : 0;
}

async function versionReportCount(db, versionId) {
  const row = await db.adapter.get('SELECT COUNT(*) AS n FROM song_reports WHERE version_id = ?', [versionId]);
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

async function staleVersions(db, { maxAgeMs = 3 * 24 * 60 * 60 * 1000, force = false } = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const rows = await db.adapter.all(`
    SELECT v.id, v.song_id AS songId, v.label, v.youtube_id AS youtubeId,
           v.status, v.last_checked AS lastChecked
    FROM song_versions v
    WHERE v.last_checked IS NULL OR v.last_checked < ? OR upper(?) = 'TRUE'
    ORDER BY v.last_checked IS NULL DESC, v.updated_at ASC`, [cutoff, force ? 'TRUE' : 'FALSE']);
  return rows;
}

async function stats(db) {
  const byStatus = await db.adapter.all('SELECT status, COUNT(*) AS n FROM songs GROUP BY status');
  const versionStatus = await db.adapter.all('SELECT status, COUNT(*) AS n FROM song_versions GROUP BY status');
  const artists = await db.adapter.get('SELECT COUNT(*) AS n FROM artists');
  const totals = await db.adapter.get('SELECT COUNT(*) AS n FROM songs');
  const versions = await db.adapter.get('SELECT COUNT(*) AS n FROM song_versions');
  const summary = { active: 0, dead: 0, private: 0 };
  for (const r of byStatus) summary[r.status] = r.n;
  const versionSummary = { active: 0, dead: 0, private: 0 };
  for (const r of versionStatus) versionSummary[r.status] = r.n;
  return {
    songs: totals.n,
    artists: artists.n,
    byStatus: summary,
    versions: versions.n,
    versionsByStatus: versionSummary,
  };
}

// ---- Pending track queue (admin content additions) -------------------------

async function queuePendingTrack(db, t = {}) {
  const nowIso = now();
  await db.adapter.run(
    'INSERT INTO pending_tracks (url, artist, requested_title, title, real_title, real_author, playable, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [t.url, t.artist || null, t.requestedTitle || null, t.title || null, t.realTitle || null, t.realAuthor || null, t.playable ? 1 : 0, t.note || null, nowIso]);
  return db.adapter.get('SELECT id, created_at AS createdAt FROM pending_tracks ORDER BY id DESC LIMIT 1');
}

async function listPendingTracks(db, { includeApplied = false } = {}) {
  const rows = await db.adapter.all(
    `SELECT id, url, artist, requested_title AS requestedTitle, title, real_title AS realTitle,
            real_author AS realAuthor, playable, note, created_at AS createdAt, applied_at AS appliedAt
     FROM pending_tracks ${includeApplied ? '' : 'WHERE applied_at IS NULL'}
     ORDER BY applied_at IS NOT NULL ASC, id ASC`);
  return rows;
}

async function clearAppliedPending(db) {
  const t = now();
  await db.adapter.run('UPDATE pending_tracks SET applied_at = ? WHERE applied_at IS NULL', [t]);
  return t;
}

module.exports = {
  upsertArtist, upsertSong, upsertSongVersion, versionIdOf,
  listArtists, listSongs, getSong, versionsForSongs,
  setSongStatus, setSongVersionStatus, touchChecked, touchVersionChecked,
  addReport, addVersionReport, reportCount, versionReportCount,
  staleSongs, staleVersions, stats,
  queuePendingTrack, listPendingTracks, clearAppliedPending,
};