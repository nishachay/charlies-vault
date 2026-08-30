'use strict';

// Live-verifies every candidate in scripts/charlie_legacy_tracks.json (the
// hand-curated Charlie Puth vault recovered from the old charlies-vault repo)
// against YouTube's keyless oEmbed endpoint. Writes scripts/verified_legacy.json
// with the REAL status + real video title + uploader for the canonical id and
// each alternate version. Builds only admit tracks whose video is confirmed
// playable — same trust model as scripts/verify_songs.js.
//
//   node scripts/verify_legacy.js

const fs = require('fs');
const path = require('path');

async function probe(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`;
  const res = await fetch(url);
  if (res.ok) {
    const j = await res.json();
    return { status: 'active', title: j.title, author: j.author_name };
  }
  return { status: res.status === 401 ? 'private' : 'dead', title: null, author: null };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

(async () => {
  const source = require('./charlie_legacy_tracks.json');
  const tracks = source.tracks;
  const versionIds = [];
  for (const t of tracks) if (t.versions) for (const v of t.versions) versionIds.push(v.youtubeId);
  const needsProbe = [...new Set([...tracks.map(t => t.id), ...versionIds])];
  console.log(`[verify-legacy] probing ${needsProbe.length} unique videos (${tracks.length} candidates + ${versionIds.length} versions)...`);

  const results = await mapLimit(needsProbe, 8, async id => ({ id, ...(await probe(id)) }));
  const byId = Object.fromEntries(results.map(r => [r.id, r]));

  const enriched = tracks.map(t => {
    const c = byId[t.id] || { status: 'unknown', title: null, author: null };
    const versions = (t.versions || []).map(vv => {
      const vp = byId[vv.youtubeId] || { status: 'unknown' };
      return { ...vv, videoStatus: vp.status, realTitle: vp.title || null, realAuthor: vp.author || null };
    });
    return { ...t, videoStatus: c.status, realTitle: c.title || null, realAuthor: c.author || null, versions };
  });

  fs.writeFileSync(path.join(__dirname, 'verified_legacy.json'), JSON.stringify(enriched, null, 2) + '\n');

  const summary = {};
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  console.log('[verify-legacy] summary:', JSON.stringify(summary));
  const active = enriched.filter(t => t.videoStatus === 'active');
  console.log(`[verify-legacy] playable candidates: ${active.length}/${tracks.length}`);
  console.log('[verify-legacy] dead/private candidates:');
  for (const t of enriched.filter(t => t.videoStatus !== 'active')) console.log('  ', t.id, t.videoStatus, t.title);
})().catch(err => { console.error('[verify-legacy] failed:', err.message); process.exit(1); });