'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { createDb } = require('../src/db');
const { upsertCatalog } = require('../src/seeder');
const { createApp } = require('../server');

const catalog = require('../scripts/catalog.json');
const firstArtist = catalog.artists[0];
const firstSong = catalog.songs[0];

// Probe stub: resolves like a fetch() Response. Configurable per-app instance.
const okProbe = async () => ({ ok: true, status: 200 });
const goneProbe = async () => ({ ok: false, status: 404 });

function baseUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

async function withApp(t, { probe = okProbe, adminKey = 'test-key' } = {}) {
  const db = createDb({ dbPath: ':memory:' });
  db.migrate();
  await upsertCatalog(db, require('../scripts/catalog.json'));
  const app = createApp({ db, adminKey, apiKey: '', probe });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  return { app, db, base: baseUrl(app) };
}

describe('public API', () => {
  it('serves /api/health', async t => {
    const { base } = await withApp(t);
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.backend, 'sqlite');
    assert.equal(body.songs, catalog.songs.length);
    assert.equal(body.artists, 1);
    assert.equal(body.byStatus.active, catalog.songs.length);
  });

  it('serves /api/artists', async t => {
    const { base } = await withApp(t);
    const { artists, count } = await (await fetch(`${base}/api/artists`)).json();
    assert.equal(count, 1);
    assert.equal(artists.length, 1);
    assert.equal(artists[0].name, firstArtist.name);
    assert.equal(artists[0].songCount, catalog.songs.length);
  });

  it('serves /api/songs and respects the artist filter', async t => {
    const { base } = await withApp(t);
    const all = await (await fetch(`${base}/api/songs`)).json();
    assert.equal(all.count, catalog.songs.length);
    assert.ok(all.songs.every(s => s.status === 'active'));

    const filtered = await (await fetch(`${base}/api/songs?artist=${firstArtist.slug}`)).json();
    assert.equal(filtered.count, catalog.songs.length);
    assert.ok(filtered.songs.every(s => s.artist === firstArtist.name));
  });

  it('serves /api/songs/:id and 404s unknown ids', async t => {
    const { base } = await withApp(t);
    const res = await fetch(`${base}/api/songs/${firstSong.id}`);
    assert.equal(res.status, 200);
    const { song } = await res.json();
    assert.equal(song.title, firstSong.title);

    const miss = await fetch(`${base}/api/songs/zzz`);
    assert.equal(miss.status, 404);
  });

  it('404s unknown endpoints', async t => {
    const { base } = await withApp(t);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });

  it('serves the static frontend at /', async t => {
    const { base } = await withApp(t);
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /OUTTAKE/);
  });
});

describe('report flow', () => {
  it('collects reports and auto-flags dead at the threshold', async t => {
    const { base } = await withApp(t);
    const id = catalog.songs[1].id;

    assert.equal((await (await fetch(`${base}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: id }),
    })).json()).status, 'active');

    assert.equal((await (await fetch(`${base}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: id }),
    })).json()).status, 'active');

    const third = await (await fetch(`${base}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: id }),
    })).json();
    assert.equal(third.status, 'dead');
    assert.equal(third.reportCount, 3);

    const live = await (await fetch(`${base}/api/songs`)).json();
    assert.ok(!live.songs.some(s => s.id === id), 'flagged song hidden from players');
  });

  it('validates input', async t => {
    const { base } = await withApp(t);
    assert.equal((await fetch(`${base}/api/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"songId":""}',
    })).status, 400);
    assert.equal((await fetch(`${base}/api/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"songId":"missing"}',
    })).status, 404);
    assert.equal((await fetch(`${base}/api/report`)).status, 405);
  });
});

describe('admin refresh', () => {
  it('rejects unauthenticated refresh', async t => {
    const { base } = await withApp(t, { adminKey: 'secret' });
    const res = await fetch(`${base}/api/refresh`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 401);
  });

  it('probes videos, persists status, and can resurrect dead songs', async t => {
    const { base, db } = await withApp(t);
    const id = catalog.songs[2].id;

    // Kill a song first, then let the refresh bring it back (video is fine).
    for (let i = 0; i < 3; i++) {
      await fetch(`${base}/api/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songId: id }),
      });
    }

    const res = await fetch(`${base}/api/refresh`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key', 'Content-Type': 'application/json' },
      body: '{"force":true}',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.summary.checked, catalog.songs.length);
    assert.equal(body.summary.active, catalog.songs.length, 'all probed videos play again');

    const song = await (await fetch(`${base}/api/songs/${id}`)).json();
    assert.equal(song.song.status, 'active');
    assert.ok(song.song.lastChecked);
  });

  it('marks songs dead when the probe says so', async t => {
    const { base } = await withApp(t, { probe: goneProbe });
    const body = await (await fetch(`${base}/api/refresh`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: '{"force":true}',
    })).json();
    assert.equal(body.summary.checked, catalog.songs.length);
    assert.equal(body.summary.dead, catalog.songs.length);

    const live = await (await fetch(`${base}/api/songs`)).json();
    assert.equal(live.count, 0, 'nothing playable when all videos are gone');
    const all = await (await fetch(`${base}/api/songs?all=1`)).json();
    assert.equal(all.count, catalog.songs.length);
  });
});

describe('admin save (curation upsert)', () => {
  it('rejects unauthenticated save', async t => {
    const { base } = await withApp(t);
    const res = await fetch(`${base}/api/save`, { method: 'POST', body: '{"songs":[]}' });
    assert.equal(res.status, 401);
  });

  it('merges new artists and songs idempotently', async t => {
    const { base } = await withApp(t);
    const payload = {
      artists: [{ name: 'New Artist', initials: 'NA' }],
      songs: [{ id: 'na01', title: 'Fresh Outtake', artist: 'New Artist', youtubeId: 'abc123', duration: 180 }],
    };
    const res = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'Authorization': 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.artists, 1);
    assert.equal(body.songs, 1);

    const { songs } = await (await fetch(`${base}/api/songs?artist=new-artist`)).json();
    assert.equal(songs.length, 1);
    assert.equal(songs[0].title, 'Fresh Outtake');

    // Idempotent re-save: no duplicates.
    await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'Authorization': 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const after = await (await fetch(`${base}/api/songs?artist=new-artist`)).json();
    assert.equal(after.count, 1);
  });
});