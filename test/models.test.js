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
const vid = M.versionIdOf(songId, 0);

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

describe('song versions', () => {
  it('upserts versions and attaches them to songs', async () => {
    await M.upsertSongVersion(db, { id: vid, songId, label: 'V2 · demo cut', youtubeId: 'dummyVid2', notes: null, sortOrder: 0 });
    const song = await M.getSong(db, songId);
    assert.equal(song.versions.length, 1);
    assert.equal(song.versions[0].id, vid);
    assert.equal(song.versions[0].label, 'V2 · demo cut');
    assert.equal(song.versions[0].youtubeId, 'dummyVid2');
    assert.equal(song.versions[0].status, 'active');
    const list = await M.listSongs(db);
    assert.equal(list.find(x => x.id === songId).versions.length, 1);
  });

  it('hides dead versions by default, shows them with includeAll', async () => {
    await M.setSongVersionStatus(db, vid, 'dead');
    const song = await M.getSong(db, songId);
    assert.deepEqual(song.versions, []);
    const all = await M.listSongs(db, { includeAll: true });
    const row = all.find(x => x.id === songId);
    assert.equal(row.versions.length, 1);
    assert.equal(row.versions[0].status, 'dead');
    await M.setSongVersionStatus(db, vid, 'active');
  });

  it('tracks per-version reports separately from song reports', async () => {
    const before = await M.reportCount(db, songId);
    const row = await M.addVersionReport(db, vid, 'test');
    assert.equal(row.songId, songId);
    assert.equal(row.reportCount, 1);
    assert.equal(await M.versionReportCount(db, vid), 1);
    assert.equal(await M.reportCount(db, songId), before, 'song report count excludes version reports');
  });

  it('keeps a song surfacable while any version plays', async () => {
    await M.setSongVersionStatus(db, vid, 'active');
    await M.setSongStatus(db, songId, 'dead');
    const active = await M.listSongs(db);
    assert.ok(active.some(s => s.id === songId), 'live version keeps the song listed');

    await M.setSongVersionStatus(db, vid, 'dead');
    const again = await M.listSongs(db);
    assert.ok(!again.some(s => s.id === songId), 'all-dead removes the song from players');
    assert.equal((await M.getSong(db, songId)).status, 'dead', 'song status stays the canonical verdict');

    await M.setSongVersionStatus(db, vid, 'active');
    await M.setSongStatus(db, songId, 'active');
  });

  it('selects stale versions for refresh selection', async () => {
    await db.adapter.run('UPDATE song_versions SET last_checked = NULL WHERE id = ?', [vid]);
    const stale = await M.staleVersions(db, { maxAgeMs: 0 });
    assert.ok(stale.some(v => v.id === vid), 'unchecked version is selected');
    await M.touchVersionChecked(db, vid);
    const fresh = await M.staleVersions(db, { maxAgeMs: 24 * 60 * 60 * 1000 });
    assert.ok(!fresh.some(v => v.id === vid), 'freshly checked version is skipped');
    const force = await M.staleVersions(db, { force: true });
    assert.ok(force.some(v => v.id === vid), 'force re-probes versions');
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
describe('pending-tracks admin queue', () => {
  it('queues a track and lists it as unapplied', async () => {
    const row = await M.queuePendingTrack(db, {
      url: 'https://www.youtube.com/watch?v=8vWJBNc5Q4E',
      artist: 'Kanye West',
      realTitle: 'Can U Be',
      realAuthor: 'Kanye',
      playable: true,
    });
    assert.ok(row.id > 0);
    const pending = await M.listPendingTracks(db);
    assert.ok(pending.some(t => t.id === row.id));
    const applied = await M.listPendingTracks(db, { includeApplied: true });
    assert.ok(applied.some(t => t.id === row.id && !t.appliedAt));
  });

  it('hides applied tracks by default and clears on demand', async () => {
    await M.clearAppliedPending(db);
    const pending = await M.listPendingTracks(db);
    assert.equal(pending.length, 0, 'all cleared tracks are hidden by default');
    const all = await M.listPendingTracks(db, { includeApplied: true });
    assert.ok(all.some(t => t.appliedAt), 'applied tracks still visible with includeApplied');
  });
});
