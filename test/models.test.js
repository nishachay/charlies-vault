'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const { createDb } = require('../src/db');
const { upsertCatalog } = require('../src/seeder');
const M = require('../src/models');

let db;

before(async () => {
  db = createDb({ dbPath: ':memory:' });
  db.migrate();
  const catalog = require('../scripts/catalog.json');
  await upsertCatalog(db, catalog);
});

describe('artists', () => {
  it('lists all artists with song counts', async () => {
    const artists = await M.listArtists(db);
    assert.equal(artists.length, 13);
    const kanye = artists.find(a => a.slug === 'kanye-west');
    assert.ok(kanye);
    assert.equal(kanye.name, 'Kanye West');
    assert.equal(kanye.songCount, 5);
    assert.equal(kanye.activeCount, 5);
  });

  it('auto-registers collab artists from song credits', async () => {
    const artists = await M.listArtists(db);
    const collab = artists.find(a => a.slug === 'playboi-carti-lil-uzi-vert');
    assert.ok(collab, 'collab artist exists');
    assert.equal(collab.songCount, 1);
  });
});

describe('songs', () => {
  it('has the full catalog (128) including inactive', async () => {
    const all = await M.listSongs(db, { includeAll: true });
    assert.equal(all.length, 128);
  });

  it('filters to active ones by default', async () => {
    const act = await M.listSongs(db);
    assert.equal(act.length, 128);
  });

  it('filters by artist slug', async () => {
    const songs = await M.listSongs(db, { artistSlug: 'charlie-puth' });
    assert.ok(songs.length > 50, 'charlie puth has the biggest vault');
    assert.ok(songs.every(s => s.artist === 'Charlie Puth'));
  });

  it('returns a song by id with artist name joined in', async () => {
    const song = await M.getSong(db, 'kye01');
    assert.equal(song.title, 'Alien (feat. Kid Cudi & Young Thug)');
    assert.equal(song.artist, 'Kanye West');
    assert.equal(song.youtubeId, '8xX7mYjWJGE');
    assert.equal(song.status, 'active');
  });

  it('returns null for unknown ids', async () => {
    assert.equal(await M.getSong(db, 'nope'), null);
  });
});

describe('reports', () => {
  it('increments report_count and surfaces status', async () => {
    const row = await M.addReport(db, 'drk01', 'test');
    assert.equal(row.reportCount, 1);
    assert.equal(row.status, 'active');
  });

  it('tracks report rows per song', async () => {
    const n = await M.reportCount(db, 'drk01');
    assert.equal(n, 1);
  });
});

describe('status transitions', () => {
  it('marks a song dead and excludes it from default listing', async () => {
    await M.setSongStatus(db, 'twk01', 'dead');
    const active = await M.listSongs(db);
    assert.ok(!active.some(s => s.id === 'twk01'));
    const all = await M.listSongs(db, { includeAll: true });
    const song = all.find(s => s.id === 'twk01');
    assert.equal(song.status, 'dead');
    assert.ok(song.lastChecked, 'last_checked is set');
  });

  it('allows resurrection back to active', async () => {
    await M.setSongStatus(db, 'twk01', 'active');
    const active = await M.listSongs(db);
    assert.ok(active.some(s => s.id === 'twk01'));
  });
});

describe('stale-songs refresh selection', () => {
  it('returns everything on first pass (last_checked IS NULL)', async () => {
    const stale = await M.staleSongs(db, { maxAgeMs: 0 });
    assert.equal(stale.length, 128);
  });

  it('respects the staleness window after a check', async () => {
    await M.touchChecked(db, 'tsv01');
    const fresh = await M.staleSongs(db, { maxAgeMs: 24 * 60 * 60 * 1000 });
    assert.ok(!fresh.some(s => s.id === 'tsv01'), 'freshly checked song is skipped');
    const full = await M.staleSongs(db, { force: true });
    assert.ok(full.some(s => s.id === 'tsv01'), 'force re-checks everything');
  });
});