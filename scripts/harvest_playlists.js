'use strict';

// Harvest the curated playlist registry (scripts/playlists.json), dedupe the
// union of every video id across lists, then machine-verify each unique id:
//   * playability via the keyless oEmbed probe (200 -> active, 401 -> private,
//     else dead) plus the video's REAL title/author (the anti-fabrication
//     truth-check),
//   * duration pulled from the watch page's embedded lengthSeconds.
//
// Probing is cached in scripts/.probe_cache.json (gitignored) so re-runs are
// cheap; the union + per-list detail lands in scripts/harvested.json
// (gitignored) for the curation step.
//
//   node scripts/harvest_playlists.js [--harvest-only]

const fs = require('fs');
const path = require('path');
const { mapLimit } = require('../lib/checkYouTube');

const REGISTRY = require('./playlists.json');
const CACHE_PATH = path.join(__dirname, '.probe_cache.json');
const OUT_PATH = path.join(__dirname, 'harvested.json');
const HARVEST_ONLY = process.argv.includes('--harvest-only');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { return {}; }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0) + '\n');
}

function stripTags(s) { return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim(); }

async function fetchText(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
      if (!r.ok) throw new Error(`http_${r.status}`);
      return await r.text();
    } catch (err) {
      lastErr = err;
      await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function harvestPlaylist(list) {
  // Playlists are canonical on www.youtube.com regardless of the origin link
  // (music.youtube.com links are just alternate entry points), and only the
  // www page embeds the item ids in its HTML.
  const url = `https://www.youtube.com/playlist?list=${list.id}`;
  try {
    const html = await fetchText(url);
    const ids = [...new Set([...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map(m => m[1]))];
    const jt = (html.match(/"playlistMetadataRenderer":\{"title":"([^"]*)"/) || [])[1] || '';
    const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/\s+/g, ' ');
    const title = jt || h1 || list.id;
    const desc = stripTags((html.match(/<meta name="description"\s+content="([^"]*)"/) || [])[1] || '').replace(/\s+/g, ' ').slice(0, 300);
    return { id: list.id, host: list.host, title, desc, count: ids.length, videoIds: ids };
  } catch (err) {
    return { id: list.id, host: list.host, title: `ERROR: ${err.message}`, count: 0, videoIds: [] };
  }
}

async function probeAndCached(id, cache) {
  if (cache[id]) return cache[id];
  const rec = { id, status: 'dead', reason: null, realTitle: null, realAuthor: null, duration: null };
  try {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
        if (r.ok) {
          const j = await r.json();
          rec.status = 'active';
          rec.realTitle = (j.title || '').replace(/\n/g, ' ');
          rec.realAuthor = j.author_name || null;
        } else {
          rec.status = r.status === 401 ? 'private' : 'dead';
          rec.reason = `http_${r.status}`;
        }
        break;
      } catch (err) {
        rec.reason = err.message;
        await new Promise(res => setTimeout(res, 600 * (i + 1)));
      }
    }
  } catch {} // unreachable; keep shape
  if (rec.status === 'active') {
    try {
      const html = await fetchText('https://www.youtube.com/watch?v=' + id);
      const m = html.match(/"lengthSeconds":"(\d+)"/);
      rec.duration = m ? +m[1] : null;
    } catch { rec.duration = null; }
  }
  cache[id] = rec;
  return rec;
}

async function main() {
  console.log(`[harvest] fetching ${REGISTRY.length} playlists from source registry...`);
  const lists = await mapLimit(REGISTRY, 2, harvestPlaylist);
  const ok = lists.filter(l => !l.title.startsWith('ERROR'));
  const failed = lists.filter(l => l.title.startsWith('ERROR'));
  for (const l of lists) console.log(`  ${String(l.count).padStart(4)}  ${l.host.padEnd(7)}  ${(l.title || '').slice(0, 60)}  [${l.id}]`);
  if (failed.length) console.warn(`[harvest] ${failed.length} playlist page(s) failed: ${failed.map(f => f.id).join(', ')}`);

  const firstSeen = new Map();
  for (const l of lists) for (const id of l.videoIds) if (!firstSeen.has(id)) firstSeen.set(id, l.id);
  const unique = [...firstSeen.keys()];
  console.log(`\n[harvest] ${unique.length} unique video ids across ${ok.length} playlists`);

  const out = { harvestedAt: new Date().toISOString(), lists, totalUnique: unique.length, uniqueIds: unique };
  saveCache(loadCache());

  if (!HARVEST_ONLY) {
    const cache = loadCache();
    console.log(`[probe] verifying ${unique.length} unique videos (cached: ${Object.keys(cache).length})...`);
    const results = await mapLimit(unique, 8, id => probeAndCached(id, cache));
    const active = results.filter(r => r.status === 'active');
    console.log(`[probe] active: ${active.length}  dead: ${results.length - active.length}`);
    out.probes = results;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');
  saveCache(loadCache());
  console.log(`[harvest] wrote scripts/harvested.json (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB)`);
}

main().catch(err => { console.error('[harvest] failed:', err.message); process.exit(1); });