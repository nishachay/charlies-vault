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

const { json, readBody, parseUrl, isAdmin } = require('./_lib');
const M = require('../src/models');
const { runRefresh } = require('../lib/checkYouTube');

const REPORT_THRESHOLD = 3; // reports before a song auto-flags as dead

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
  const { pathname } = parseUrl(req);
  const id = pathname.split('/').pop();
  const song = await M.getSong(ctx.db, id);
  if (!song) return json(res, 404, { error: 'song not found' });
  json(res, 200, { song });
}

async function reportHandler(req, res, ctx) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  const body = await readBody(req);
  const songId = String(body.songId || '').trim();
  if (!songId) return json(res, 400, { error: 'songId is required' });

  const song = await M.getSong(ctx.db, songId);
  if (!song) return json(res, 404, { error: 'song not found' });

  const reason = String(body.reason || '').slice(0, 500) || null;
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
    songCount++;
  }

  json(res, 200, { ok: true, artists: artistCount, songs: songCount, skipped });
}

module.exports = {
  healthHandler, artistsHandler, songsHandler, songByIdHandler,
  reportHandler, refreshHandler, saveHandler,
  REPORT_THRESHOLD,
};