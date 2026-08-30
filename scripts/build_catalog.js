'use strict';

// Rebuilds scripts/catalog.json from machine-verified, human-curated sources:
//   Charlie Puth -> scripts/verified_legacy.json (npm run db:verify)
//   The Weeknd   -> the hard-curated WEEKND_TRACKS roster below, cross-checked
//                   against the oEmbed probe results in scripts/weeknd_candidates.json
//                   (gitignored; regenerate with scripts/discover_weeknd.js)
//
//   node scripts/build_catalog.js
//
// After a build, keep the frontend fallback in sync:
//   npm run db:sync

const fs = require('fs');
const path = require('path');

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

  const catalog = { artists: [CHARLIE, WEEKND], songs: [...charlieSongs, ...weekndSongs].sort(byTitle) };
  fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`[build] catalog.json: ${catalog.artists.length} artist(s), ${catalog.songs.length} songs`);
})().catch(err => { console.error('[build] failed:', err.message); process.exit(1); });