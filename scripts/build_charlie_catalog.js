'use strict';

// Rebuilds scripts/catalog.json from the machine-verified Charlie Puth vault:
//  1. reads scripts/verified_legacy.json (run scripts/verify_legacy.js first)
//  2. keeps ONLY candidates whose video was confirmed playable
//     (videoStatus === 'active'), canonical AND versions
//  3. merges them with the current catalog so existing (historically poached)
//     rows keep their verified durations, new rows get the legacy duration
//
//   node scripts/build_charlie_catalog.js
//
// After a build, keep the frontend fallback in sync:
//   npm run db:sync

const fs = require('fs');
const path = require('path');

const ARTIST = {
  slug: 'charlie-puth',
  name: 'Charlie Puth',
  initials: 'CP',
  tag: 'Voicenotes & Studio Cuts',
  // Confirmed Charlie Puth portrait: Wikimedia Commons "Charlie Puth 2017
  // (cropped).jpg" (press photo, CC BY 2.0), self-hosted at
  // assets/artists/charlie-puth.jpg for zero external image dependencies.
  avatarUrl: '/assets/artists/charlie-puth.jpg',
};

function byTitle(a, b) {
  const ta = (a.title || '').toLowerCase(), tb = (b.title || '').toLowerCase();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

(async () => {
  if (!fs.existsSync(path.join(__dirname, 'verified_legacy.json'))) {
    console.error('[build] scripts/verified_legacy.json is missing — run `npm run db:verify:charlie` first.');
    process.exit(1);
  }
  const verified = require('./verified_legacy.json');
  const current = require('./catalog.json');

  const playable = verified.filter(t => t.videoStatus === 'active');
  const curated = playable.map(t => {
    const existing = current.songs.find(s => s.id === t.id);
    const versions = (t.versions || [])
      .filter(v => v.videoStatus === 'active')
      .map(v => ({ label: v.label, youtubeId: v.youtubeId, notes: v.notes || null }));
    return {
      id: t.id,
      title: t.title,
      artist: ARTIST.name,
      youtubeId: t.id,
      duration: existing && existing.duration ? existing.duration : (isFinite(t.duration) ? t.duration : null),
      ...(versions.length ? { versions } : {}),
    };
  }).sort(byTitle);

  const dropped = verified.filter(t => t.videoStatus !== 'active').map(t => t.id);
  const droppedVersions = verified
    .flatMap(t => (t.versions || []).filter(v => v.videoStatus !== 'active').map(v => `${t.id}/${v.youtubeId}`));

  const catalog = { artists: [ARTIST], songs: curated };
  fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`[build] catalog.json: ${catalog.artists.length} artist(s), ${catalog.songs.length} verified songs`);
  console.log(`[build] dropped ${dropped.length} unplayable candidates:${dropped.map(id => ' ' + id).join('') || ' none'}`);
  if (droppedVersions.length) console.log(`[build] dropped ${droppedVersions.length} unplayable versions:\n`, droppedVersions.join('\n'));
})().catch(err => { console.error('[build] failed:', err.message); process.exit(1); });