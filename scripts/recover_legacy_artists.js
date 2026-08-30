'use strict';

// Recovers the pre-verification multi-artist dataset (all 12 artists from the
// old OUTTAKE index.html, commit 3a6e79b) the verified way:
//
//   1. Extracts the old SONGS array from git history.
//   2. Probes every unique youtube id via the keyless oEmbed check.
//   3. Writes a committed candidate source (legacy_artists_tracks.json) and a
//      gitignored, verified report (verified_legacy_artists.json).
//
// Nothing is auto-added to the catalog — a human picks which artists to build
// in after seeing the per-artist playable counts.
//
//   node scripts/recover_legacy_artists.js

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { probeVideo, mapLimit } = require('../lib/checkYouTube');

const SOURCE_COMMIT = process.env.SOURCE_COMMIT || '3a6e79b';

function extractSongsFromHistory(commit) {
  const html = execFileSync('git', ['show', `${commit}:index.html`], { cwd: path.join(__dirname, '..') }).toString('utf8');
  const start = html.indexOf('const SONGS = [');
  const end = html.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error(`could not locate const SONGS in ${commit}:index.html`);
  const block = html
    .slice(start + 'const SONGS = ['.length, end)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('//'))
    .join('\n')
    .replace(/,\s*$/, '')
    .replace(/,(\s*})/g, '$1');
  return JSON.parse(`[${block}]`);
}

async function main() {
  const songs = extractSongsFromHistory(SOURCE_COMMIT);
  const artistSet = [...new Set(songs.map(s => s.artist).filter(Boolean))];
  console.log(`[recover] ${songs.length} legacy songs across ${artistSet.length} artists (from ${SOURCE_COMMIT})`);

  const seen = new Set();
  const tracks = [];
  for (const s of songs) {
    const id = s.youtubeId || s.id;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    if (seen.has(id)) continue; // collab ids reused across artists still dedupe once per probe
    seen.add(id);
    tracks.push({
      id,
      title: s.title,
      artist: s.artist,
      duration: s.duration || null,
      era: s.era || null,
      category: s.category || null,
    });
  }
  tracks.sort((a, b) => (a.artist || 'z').localeCompare(b.artist || 'z') || a.title.localeCompare(b.title));

  const source = { _source: `pre-verification OUTTAKE SONGS (commit ${SOURCE_COMMIT})`, count: tracks.length, tracks };
  fs.writeFileSync(path.join(__dirname, 'legacy_artists_tracks.json'), JSON.stringify(source, null, 2) + '\n');
  console.log(`[recover] wrote scripts/legacy_artists_tracks.json (${tracks.length} unique videos)`);

  const results = await mapLimit(tracks, 8, t => probeVideo(t.id));
  const byId = new Map(results.map(r => [r.id, r]));
  const verified = tracks.map(t => {
    const r = byId.get(t.id) || { status: 'unknown', source: 'error' };
    return { ...t, videoStatus: r.status, source: r.source, reason: r.reason || null };
  });
  fs.writeFileSync(path.join(__dirname, 'verified_legacy_artists.json'), JSON.stringify(verified, null, 2) + '\n');

  const byArtist = {};
  for (const v of verified) {
    const cur = (byArtist[v.artist] = byArtist[v.artist] || { total: 0, active: 0, dead: 0, private: 0, error: 0 });
    cur.total++;
    cur[v.videoStatus] = (cur[v.videoStatus] || 0) + 1;
  }

  console.log('\n[recover] verified playability by artist:');
  for (const [name, a] of Object.entries(byArtist).sort((x, y) => y[1].active - x[1].active)) {
    console.log(`  ${name.padEnd(22)} active: ${String(a.active).padStart(2)}  dead: ${String(a.dead || 0).padStart(2)}  private: ${String(a.private || 0).padStart(2)}  (${a.total})`);
  }
  console.log('\n[recover] per-video detail in scripts/verified_legacy_artists.json (gitignored).');
}

main().catch(err => { console.error('[recover] failed:', err.message); process.exit(1); });