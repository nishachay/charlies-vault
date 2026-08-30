'use strict';

// Live-verifies every unique YouTube ID in catalog.json against YouTube's
// keyless oEmbed endpoint and writes scripts/verified.json with the REAL
// status + real video title + uploader. This is the source of truth for
// curating a vault that actually plays.
//
//   node scripts/verify_songs.js

const fs = require('fs');
const path = require('path');

async function probe(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`;
  const res = await fetch(url);
  if (res.ok) {
    const j = await res.json();
    return { id, status: 'active', title: j.title, author: j.author_name };
  }
  return { id, status: res.status === 401 ? 'private' : 'dead' };
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
  const catalog = require('./catalog.json');
  const seen = new Set();
  const unique = [];
  const push = id => { if (!seen.has(id)) { seen.add(id); unique.push(id); } };
  for (const s of catalog.songs) {
    push(s.youtubeId);
    if (s.versions) for (const v of s.versions) push(v.youtubeId);
  }
  console.log(`[verify] probing ${unique.length} unique videos (catalog has ${catalog.songs.length} rows + ${catalog.songs.reduce((n, s) => n + (s.versions ? s.versions.length : 0), 0)} versions)...`);

  const results = await mapLimit(unique, 8, probe);
  const byId = Object.fromEntries(results.map(r => [r.id, r]));

  const enrichedSongs = catalog.songs.map(s => {
    const v = byId[s.youtubeId] || { status: 'unknown' };
    const versions = (s.versions || []).map(vv => {
      const vp = byId[vv.youtubeId] || { status: 'unknown' };
      return { ...vv, videoStatus: vp.status, realTitle: vp.title || null };
    });
    return { ...s, videoStatus: v.status, realTitle: v.title || null, realAuthor: v.author || null, versions };
  });

  fs.writeFileSync(path.join(__dirname, 'verified.json'), JSON.stringify(enrichedSongs, null, 2) + '\n');

  const summary = {};
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  console.log('[verify] summary:', JSON.stringify(summary));

  const activeIds = new Set(results.filter(r => r.status === 'active').map(r => r.id));
  const listed = enrichedSongs.filter(s => activeIds.has(s.youtubeId));
  console.log(`[verify] active videos: ${activeIds.size}, rows they appear in: ${listed.length}`);
  const activeVersions = enrichedSongs.reduce((n, s) => n + (s.versions || []).filter(v => v.videoStatus === 'active').length, 0);
  console.log(`[verify] active song versions: ${activeVersions}`);
  const dupActive = new Set(catalog.songs.filter(s => activeIds.has(s.youtubeId)).map(s => s.youtubeId))
  const dupRows = catalog.songs.filter(s => activeIds.has(s.youtubeId) && [...new Set(catalog.songs.map(x => x.youtubeId))].includes(s.youtubeId) && catalog.songs.filter(x => x.youtubeId === s.youtubeId).length > 1);
  console.log(`[verify] active videos shared by 2+ catalog rows: ${new Set(dupRows.map(r => r.youtubeId)).size}`);
})().catch(err => { console.error('[verify] failed:', err.message); process.exit(1); });