'use strict';

// Discovery helper for growing the vault with OTHER artists (and Charlie
// finds too). A human steers it: the query decides WHO, the script only
// harvests, probes, and flags — it never ships anything into catalog.json.
//
//   YOUTUBE_API_KEY=... node scripts/discover_youtube.js "lyre leak unreleased" 20
//
// 1. YouTube Data API v3 /search (requires YOUTUBE_API_KEY)
// 2. live oEmbed probe of every hit → playable? real title? uploader?
// 3. diffs against the current catalog (marks hits already in the vault)
// 4. writes scripts/candidates.json (gitignored) + prints the shortlist
//
// From there, eyeball candidates and add the keepers to a source file
// (charlie_legacy_tracks.json or a new <artist>_legacy_tracks.json), then
// run npm run db:verify && npm run db:build && npm run db:sync.

const fs = require('fs');
const path = require('path');

async function ytSearch(query, maxResults, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.items || []).map(it => ({
    id: it.id && it.id.videoId,
    title: it.snippet && it.snippet.title,
    channel: it.snippet && it.snippet.channelTitle,
    published: it.snippet && it.snippet.publishedAt,
  })).filter(it => it.id);
}

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
  const query = process.argv[2];
  const maxResults = Number(process.argv[3]) || 20;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!query) {
    console.error('usage: YOUTUBE_API_KEY=... node scripts/discover_youtube.js "<query>" [maxResults]');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('[discover] YOUTUBE_API_KEY is required (YouTube Data API v3 search).');
    process.exit(1);
  }

  const catalog = require('./catalog.json');
  const inVault = new Set(catalog.songs.map(s => s.youtubeId));

  console.log(`[discover] searching "${query}" (max ${maxResults})...`);
  const hits = await ytSearch(query, maxResults, apiKey);
  console.log(`[discover] ${hits.length} raw hits. probing playability...`);

  const probed = await mapLimit(hits, 6, async h => {
    const p = await probe(h.id);
    return {
      id: h.id,
      inVault: inVault.has(h.id),
      queryTitle: h.title,
      channel: h.channel,
      ...p,
    };
  });

  fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify(probed, null, 2) + '\n');
  console.log('[discover] wrote scripts/candidates.json');

  const playable = probed.filter(p => p.status === 'active');
  const fresh = playable.filter(p => !p.inVault);
  console.log(`[discover] ${probed.length} probed → ${playable.length} playable, ${fresh.length} NOT yet in the vault:`);
  for (const p of fresh) console.log(`  ${p.id}  ${p.author} — ${p.title}`);
  console.log('\n[discover] add the keepers to a *_legacy_tracks.json source, then: npm run db:verify && npm run db:build && npm run db:sync');
})().catch(err => { console.error('[discover] failed:', err.message); process.exit(1); });