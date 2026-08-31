'use strict';

// All API logic. Each handler signature: async (req, res, ctx) => void.
// ctx = { db, adminKey, apiKey }.
//
// Public:
//   GET  /api/health
//   GET  /api/artists
//   GET  /api/songs            (?artist=<slug>&all=1)
//   GET  /api/songs/:id
//   POST /api/report           { songId, reason? }
// Admin (Authorization: Bearer $ADMIN_KEY):
//   POST /api/refresh          { force?, maxAgeMs?, concurrency? }
//   POST /api/save             { artists?, songs? }  (catalog upsert)

const { json, readBody, parseUrl, isAdmin } = require('./apiLib');
const M = require('../src/models');
const { runRefresh, probeVideo } = require('../lib/checkYouTube');
const { parseVideoRef } = require('../scripts/add_tracks');

const REPORT_THRESHOLD = 3; // reports before a song/version auto-flags as dead

async function healthHandler(req, res, ctx) {
  const s = await M.stats(ctx.db);
  json(res, 200, {
    ok: true,
    service: 'outtake',
    backend: ctx.db.adapter.kind,
    songs: s.songs,
    artists: s.artists,
    byStatus: s.byStatus,
    time: new Date().toISOString(),
  });
}

async function artistsHandler(req, res, ctx) {
  const rows = await M.listArtists(ctx.db);
  json(res, 200, { count: rows.length, artists: rows });
}

async function songsHandler(req, res, ctx) {
  const { query } = parseUrl(req);
  const artist = query.get('artist') || undefined;
  const includeAll = query.get('all') === '1' || query.get('all') === 'true';
  const rows = await M.listSongs(ctx.db, { artistSlug: artist, includeAll });
  json(res, 200, { count: rows.length, songs: rows });
}

async function songByIdHandler(req, res, ctx) {
  const { pathname, query } = parseUrl(req);
  const id = pathname.split('/').pop();
  const includeAll = query.get('all') === '1' || query.get('all') === 'true';
  const song = await M.getSong(ctx.db, id, { includeAll });
  if (!song) return json(res, 404, { error: 'song not found' });
  json(res, 200, { song });
}

async function reportHandler(req, res, ctx) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  const body = await readBody(req);
  const songId = String(body.songId || '').trim();
  const versionId = String(body.versionId || '').trim();
  if (!songId) return json(res, 400, { error: 'songId is required' });

  const song = await M.getSong(ctx.db, songId);
  if (!song) return json(res, 404, { error: 'song not found' });
  const reason = String(body.reason || '').slice(0, 500) || null;

  // Report targets a specific alternate version when one is named.
  if (versionId) {
    if (!song.versions.some(v => v.id === versionId)) {
      return json(res, 404, { error: 'version not found on this song' });
    }
    let row = await M.addVersionReport(ctx.db, versionId, reason);
    if (!row) return json(res, 404, { error: 'version not found' });
    let status = row.status;
    if (status === 'active' && row.reportCount >= REPORT_THRESHOLD) {
      await M.setSongVersionStatus(ctx.db, versionId, 'dead');
      status = 'dead';
    }
    return json(res, 200, {
      ok: true, songId, versionId, label: song.versions.find(v => v.id === versionId).label,
      reportCount: row.reportCount, status,
    });
  }

  const row = await M.addReport(ctx.db, songId, reason);
  let status = row.status;
  if (status === 'active' && row.reportCount >= REPORT_THRESHOLD) {
    await M.setSongStatus(ctx.db, songId, 'dead');
    status = 'dead';
  }
  json(res, 200, { ok: true, songId, reportCount: row.reportCount, status });
}

async function refreshHandler(req, res, ctx) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  const start = Date.now();
  const { summary } = await runRefresh(ctx.db, {
    apiKey: ctx.apiKey,
    force: !!body.force,
    maxAgeMs: Number(body.maxAgeMs) || undefined,
    concurrency: Number(body.concurrency) || 5,
    fetchImpl: ctx.probe || fetch,
  });
  json(res, 200, { ok: true, elapsedMs: Date.now() - start, summary });
}

async function saveHandler(req, res, ctx) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  if (!body.songs && !body.artists) return json(res, 400, { error: 'payload must include songs and/or artists' });

  const slugOf = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const initialsOf = name => name.split(/[&\s]+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 3).join('');
  let artistCount = 0, songCount = 0, skipped = 0;

  (body.artists || []).forEach((a, i) => {
    const slug = a.slug || (a.name ? slugOf(a.name) : null);
    if (!slug) { skipped++; return; }
    M.upsertArtist(ctx.db, { ...a, slug, avatarUrl: a.avatarUrl }, a.sortOrder ?? i);
    artistCount++;
  });

  const artistSlugs = new Map(((await M.listArtists(ctx.db))).map(a => [a.name, a.slug]));
  const collabs = (body.songs || [])
    .map(s => s.artist)
    .filter((name, i, arr) => name && !artistSlugs.has(name) && arr.indexOf(name) === i);
  collabs.forEach((name, i) => {
    const slug = slugOf(name);
    artistSlugs.set(name, slug);
    M.upsertArtist(ctx.db, { slug, name, initials: initialsOf(name), tag: null, avatarUrl: null }, 100 + i);
  });

  for (const s of body.songs || []) {
    const slug = artistSlugs.get(s.artist);
    if (!slug) { skipped++; continue; }
    M.upsertSong(ctx.db, { ...s, artistSlug: slug });
    (s.versions || []).forEach((v, i) => {
      if (v.youtubeId === s.youtubeId) return; // same source as canonical — skip
      M.upsertSongVersion(ctx.db, {
        id: M.versionIdOf(s.id, i),
        songId: s.id,
        label: v.label || `version ${i + 1}`,
        youtubeId: v.youtubeId,
        notes: v.notes || null,
        sortOrder: i,
      });
    });
    songCount++;
  }

  json(res, 200, { ok: true, artists: artistCount, songs: songCount, skipped });
}

// ---- Admin content pipeline (verify -> queue -> applied by CI) -------------

// GET /api/admin/verify?url=...   look up a URL: real title/author, playable.
// Never mutates anything; this is the preview the admin page shows.
async function adminVerifyHandler(req, res, ctx) {
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });
  const { query } = parseUrl(req);
  const url = (query.url || '').trim();
  if (!url) return json(res, 400, { error: 'missing url' });
  const id = parseVideoRef(url);
  if (!id) return json(res, 400, { error: 'could not parse a YouTube URL' });
  const probe = await probeVideo(id, {});
  const oembed = await (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)).json().catch(() => ({}));
  json(res, 200, {
    id,
    playable: probe.status === 'active',
    status: probe.status,
    realTitle: (oembed.title || '').replace(/\n/g, ' '),
    realAuthor: oembed.author_name || null,
    duration: probe.duration != null ? probe.duration : null,
  });
}

// GET /api/admin/pending   list queued (unapplied) track additions.
async function adminListHandler(req, res, ctx) {
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });
  const { query } = parseUrl(req);
  const includeApplied = query.all === '1';
  const rows = await M.listPendingTracks(ctx.db, { includeApplied });
  json(res, 200, { pending: rows });
}

// POST /api/admin/queue   add a verified/approved track to the queue.
// body: { url, artist?, title?, playable? }  -> previews again by default.
async function adminQueueHandler(req, res, ctx) {
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  const url = (body.url || '').trim();
  if (!url) return json(res, 400, { error: 'missing url' });
  const id = parseVideoRef(url);
  if (!id) return json(res, 400, { error: 'could not parse a YouTube URL' });

  // Auto-verify so only playable tracks make it into the queue.
  const probe = await probeVideo(id, {});
  const oembed = await (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)).json().catch(() => ({}));
  const realTitle = (oembed.title || '').replace(/\n/g, ' ');
  const row = await M.queuePendingTrack(ctx.db, {
    url,
    artist: body.artist,
    requestedTitle: body.title,
    title: body.title || realTitle,
    realTitle,
    realAuthor: oembed.author_name || null,
    playable: probe.status === 'active',
    note: body.note,
  });
  json(res, 200, { ok: true, id: row.id, status: probe.status });
}

// POST /api/admin/clear   mark all current pending as applied (after CI ships).
async function adminClearHandler(req, res, ctx) {
  if (!isAdmin(req, ctx.adminKey)) return json(res, 401, { error: 'unauthorized' });
  await M.clearAppliedPending(ctx.db);
  json(res, 200, { ok: true });
}

module.exports = {
  healthHandler, artistsHandler, songsHandler, songByIdHandler,
  reportHandler, refreshHandler, saveHandler,
  adminVerifyHandler, adminListHandler, adminQueueHandler, adminClearHandler,
  REPORT_THRESHOLD,
};