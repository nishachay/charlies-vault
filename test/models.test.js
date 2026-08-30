'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const { createDb } = require('../src/db');
const { upsertCatalog } = require('../src/seeder');
const M = require('../src/models');

const catalog = require('../scripts/catalog.json');
const catalogSongs = catalog.songs;
const songId = catalogSongs[0].id;
const secondSongId = catalogSongs[1].id;

let db;

before(async () => {
  db = createDb({ dbPath: ':memory:' });
  db.migrate();
  await upsertCatalog(db, catalog);
});

describe('artists', () => {
  it('lists all artists with song counts', async () => {
    const artists = await M.listArtists(db);
    const expected = new Set(catalog.songs.map(s => s.artist));
    assert.equal(artists.length, expected.size);
    for (const name of expected) {
      const a = artists.find(x => x.name === name);
      assert.ok(a, `artist ${name} present`);
      assert.equal(a.songCount, catalogSongs.filter(s => s.artist === name).length);
    }
    assert.ok(artists.every(a => a.activeCount === a.songCount), 'all seeded songs are active');
  });
});

describe('songs', () => {
  it('has the full catalog including inactive', async () => {
    const all = await M.listSongs(db, { includeAll: true });
    assert.equal(all.length, catalogSongs.length);
  });

  it('filters to active ones by default', async () => {
    const act = await M.listSongs(db);
    assert.equal(act.length, catalogSongs.length);
  });

  it('filters by artist slug', async () => {
    const artists = await M.listArtists(db);
    const slug = artists[0].slug;
    const songs = await M.listSongs(db, { artistSlug: slug });
    const expect = catalogSongs.filter(s => s.artist === artists[0].name);
    assert.equal(songs.length, expect.length);
    assert.ok(songs.every(s => s.artist === artists[0].name));
  });

  it('returns a song by id with artist name joined in', async () => {
    const song = await M.getSong(db, songId);
    const expect = catalogSongs[0];
    assert.equal(song.title, expect.title);
    assert.equal(song.artist, expect.artist);
    assert.equal(song.youtubeId, expect.youtubeId);
    assert.equal(song.status, 'active');
  });

  it('returns null for unknown ids', async () => {
    assert.equal(await M.getSong(db, 'nope'), null);
  });
});

describe('reports', () => {
  it('increments report_count and surfaces status', async () => {
    const row = await M.addReport(db, songId, 'test');
    assert.equal(row.reportCount, 1);
    assert.equal(row.status, 'active');
  });

  it('tracks report rows per song', async () => {
    const n = await M.reportCount(db, songId);
    assert.equal(n, 1);
  });
});

describe('status transitions', () => {
  it('marks a song dead and excludes it from default listing', async () => {
    await M.setSongStatus(db, secondSongId, 'dead');
    const active = await M.listSongs(db);
    assert.ok(!active.some(s => s.id === secondSongId));
    const all = await M.listSongs(db, { includeAll: true });
    const song = all.find(s => s.id === secondSongId);
    assert.equal(song.status, 'dead');
    assert.ok(song.lastChecked, 'last_checked is set');
  });

  it('allows resurrection back to active', async () => {
    await M.setSongStatus(db, secondSongId, 'active');
    const active = await M.listSongs(db);
    assert.ok(active.some(s => s.id === secondSongId));
  });
});

describe('stale-songs refresh selection', () => {
  it('returns everything on first pass (last_checked IS NULL)', async () => {
    const stale = await M.staleSongs(db, { maxAgeMs: 0 });
    assert.equal(stale.length, catalogSongs.length);
  });

  it('respects the staleness window after a check', async () => {
    await M.touchChecked(db, songId);
    const fresh = await M.staleSongs(db, { maxAgeMs: 24 * 60 * 60 * 1000 });
    assert.ok(!fresh.some(s => s.id === songId), 'freshly checked song is skipped');
    const full = await M.staleSongs(db, { force: true });
    assert.ok(full.some(s => s.id === songId), 'force re-checks everything');
  });
});