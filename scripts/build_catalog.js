'use strict';

// Rebuilds scripts/catalog.json from machine-verified, human-curated sources:
//   Charlie Puth -> scripts/verified_legacy.json (npm run db:verify)
//   The Weeknd   -> the hard-curated WEEKND_TRACKS roster below, cross-checked
//                   against the oEmbed probe results in scripts/weeknd_candidates.json
//                   (gitignored; regenerate with scripts/discover_weeknd.js)
//   Everyone else -> scripts/vault_roster.json (human-curated), every id
//                   validated against the oEmbed probe evidence in
//                   scripts/harvested.json (gitignored; regenerate with
//                   scripts/harvest_playlists.js)
//
//   node scripts/build_catalog.js
//
// After a build, keep the frontend fallback in sync:
//   npm run db:sync

const fs = require('fs');
const path = require('path');

const ROSTER_PATH = path.join(__dirname, 'vault_roster.json');
const HARVEST_PATH = path.join(__dirname, 'harvested.json');

const CHARLIE = {
  slug: 'charlie-puth',
  name: 'Charlie Puth',
  initials: 'CP',
  tag: 'Voicenotes & Studio Cuts',
  // Confirmed Charlie Puth portrait: Wikimedia Commons "Charlie Puth 2017
  // (cropped).jpg" (press photo, CC BY 2.0), self-hosted at
  // assets/artists/charlie-puth.jpg for zero external image dependencies.
  avatarUrl: '/assets/artists/charlie-puth.jpg',
};

const WEEKND = {
  slug: 'the-weeknd',
  name: 'The Weeknd',
  initials: 'TW',
  tag: 'After Hours Sessions & Vault Leaks',
  // Official artist page art (Apple Music AMCArtistImages) self-hosted to
  // assets/artists/the-weeknd.jpg; initials fallback if the asset is absent.
  avatarUrl: '/assets/artists/the-weeknd.jpg',
};

// Human-curated The Weeknd roster. Every id is oEmbed-verified playable with a
// matching real title/author (see scripts/discover_weeknd.js). Pre-release
// demos / original versions of later-released songs are deliberately included —
// the project's own convention ("Girls Born in the 90s (Original Tell Your
// Friends)") treats those as first-class vault material.
const WEEKND_TRACKS = [
  { id: '82jpYIdC0ks', title: 'Timeless (Demo V4)' },
  { id: 'cmNTfyzfrJY', title: 'Deeper (Noble)' },
  { id: 'xWjix8V3P3w', title: 'Too Late (Demo)' },
  {
    id: 'dDNWpfsV2Gg', title: 'Spite (Over Now Original)',
    versions: [{ label: 'Over Now (Demo V2)', youtubeId: 'qS5outNseGQ', notes: 'Closer-to-release rework of the Spite leak' }],
  },
  {
    id: '4yijhp-x4WU', title: 'Hold Your Heart (The Abyss) [Original]',
    versions: [{ label: 'The Abyss [V2]', youtubeId: 'aWAbzYVRH3U', notes: 'Alternate After Hours-era take' }],
  },
  { id: 'bjchSct38ck', title: 'Alone Again (Demo)' },
  { id: 'NscMa8aLrLs', title: 'Save Your Tears (Demo)' },
  {
    id: 'UWdm5RLDRrA', title: 'In Your Eyes (Demo)',
    versions: [
      { label: 'Demo V2', youtubeId: 'E-ceqs_qehc', notes: 'Alternate mix' },
      { label: 'New Leak Version', youtubeId: 'p-Qj7tsn-G0', notes: 'Extended leak take' },
    ],
  },
  { id: 'ihJW2sSD4fs', title: 'Be Myself (Take Me Back To L.A. Demo)' },
  { id: 'sqUihaHhZYw', title: 'Final Lullaby (Instagram Live)' },
  { id: 'kgTnxCT7Yqk', title: 'Nothing Compares (Instagram Live)' },
  { id: '11yHvabfMqw', title: 'Die For It (OG Version, with Belly)' },
  { id: 'raSXyFN2h-o', title: 'Missed You (Instagram Live)' },
];

function byTitle(a, b) {
  const ta = (a.title || '').toLowerCase(), tb = (b.title || '').toLowerCase();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

(async () => {
  const current = require('./catalog.json');

  const charlieSongs = (function buildCharlie() {
    if (!fs.existsSync(path.join(__dirname, 'verified_legacy.json'))) {
      console.error('[build] scripts/verified_legacy.json is missing — run `npm run db:verify` first.');
      process.exit(1);
    }
    const verified = require('./verified_legacy.json');
    const playable = verified.filter(t => t.videoStatus === 'active');
    return playable.map(t => {
      const existing = current.songs.find(s => s.id === t.id && s.artist === CHARLIE.name);
      const versions = (t.versions || [])
        .filter(v => v.videoStatus === 'active')
        .map(v => ({ label: v.label, youtubeId: v.youtubeId, notes: v.notes || null }));
      return {
        id: t.id,
        title: t.title,
        artist: CHARLIE.name,
        youtubeId: t.id,
        duration: existing && existing.duration ? existing.duration : (isFinite(t.duration) ? t.duration : null),
        ...(versions.length ? { versions } : {}),
      };
    });
  })();
  console.log(`[build] charlie: ${charlieSongs.length} verified songs`);

  const candidates = fs.existsSync(path.join(__dirname, 'weeknd_candidates.json'))
    ? require('./weeknd_candidates.json')
    : [];
  const candById = new Map(candidates.map(c => [c.id, c]));
  const weekndSongs = WEEKND_TRACKS.map(t => {
    const c = candById.get(t.id);
    if (!c || c.status !== 'active') {
      console.error(`[build] weeknd track ${t.id} is not actively playable — drop it from WEEKND_TRACKS or re-run scripts/discover_weeknd.js`);
      process.exit(1);
    }
    const versions = [];
    for (const tv of t.versions || []) {
      if (tv.youtubeId === t.id) continue;
      const v = candById.get(tv.youtubeId);
      if (v && v.status === 'active') versions.push({ label: tv.label, youtubeId: tv.youtubeId, notes: tv.notes || null });
    }
    return {
      id: t.id,
      title: t.title,
      artist: WEEKND.name,
      youtubeId: t.id,
      duration: isFinite(c.duration) ? c.duration : null,
      ...(versions.length ? { versions } : {}),
    };
  });
  const versionCount = weekndSongs.reduce((n, s) => n + (s.versions || []).length, 0);
  console.log(`[build] weeknd: ${weekndSongs.length} verified songs (+${versionCount} alt versions)`);

  const roster = (function buildRoster() {
    if (!fs.existsSync(ROSTER_PATH)) {
      console.error('[build] scripts/vault_roster.json is missing.');
      process.exit(1);
    }
    if (!fs.existsSync(HARVEST_PATH)) {
      console.error('[build] scripts/harvested.json is missing — run `node scripts/harvest_playlists.js` first.');
      process.exit(1);
    }
    const curated = require(ROSTER_PATH);
    const probes = new Map(require(HARVEST_PATH).probes.map(p => [p.id, p]));
    const songs = curated.tracks.map(t => {
      const c = probes.get(t.id);
      if (!c || c.status !== 'active') {
        console.error(`[build] roster track ${t.id} ("${t.title}") is not actively playable — drop it from vault_roster.json or re-run scripts/harvest_playlists.js`);
        process.exit(1);
      }
      const versions = [];
      for (const tv of t.versions || []) {
        if (tv.youtubeId === t.id) continue;
        const v = probes.get(tv.youtubeId);
        if (v && v.status === 'active') versions.push({ label: tv.label, youtubeId: tv.youtubeId, notes: tv.notes || null });
      }
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        youtubeId: t.id,
        duration: isFinite(c.duration) ? c.duration : null,
        ...(versions.length ? { versions } : {}),
      };
    });
    const artists = curated.artists.map(a => ({ slug: a.slug, name: a.name, initials: a.initials, tag: a.tag }));
    return { artists, songs };
  })();
  const rosterVersionCount = roster.songs.reduce((n, s) => n + (s.versions || []).length, 0);
  console.log(`[build] roster: ${roster.songs.length} verified songs (+${rosterVersionCount} alt versions) across ${roster.artists.length} artists`);

  // Merge artists, keeping first-seen order; a roster entry reusing an existing
  // artist (e.g. The Weeknd) inherits its avatarUrl while picking up the
  // roster's fresher initials/tag.
  const artistsByName = new Map();
  for (const a of [CHARLIE, WEEKND, ...roster.artists]) {
    const existing = artistsByName.get(a.name);
    artistsByName.set(a.name, existing
      ? { ...existing, ...a, avatarUrl: existing.avatarUrl || a.avatarUrl }
      : a);
  }

  const catalog = {
    artists: [...artistsByName.values()],
    songs: [...charlieSongs, ...weekndSongs, ...roster.songs].sort(byTitle),
  };
  fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`[build] catalog.json: ${catalog.artists.length} artist(s), ${catalog.songs.length} songs`);
})().catch(err => { console.error('[build] failed:', err.message); process.exit(1); });