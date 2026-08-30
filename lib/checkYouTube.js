'use strict';

// ---------------------------------------------------------------------------
// YouTube availability probing.
//
// Two paths, both injectable for tests:
//   * YouTube Data API v3 (authoritative) when YOUTUBE_API_KEY is set.
//   * youtube.com/oembed  (keyless) otherwise. Public videos answer 200, so
//     this checks "can our iframe player play this?" for free — exactly what a
//     scheduled refresh needs. 404 -> deleted, 401 -> private, 403 -> embed
//     disabled (unplayable in the iframe), anything else -> dead.
// ---------------------------------------------------------------------------

async function probeWithApi(apiKey, id, fetchImpl) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  const item = data.items && data.items[0];
  if (!item) return { id, status: 'dead', source: 'api', reason: 'deleted' };
  const privacy = item.status && item.status.privacyStatus;
  const status = privacy === 'private' ? 'private' : 'active';
  const durationSec = parseIsoDuration(item.contentDetails && item.contentDetails.duration);
  return { id, status, source: 'api', duration: durationSec || null };
}

async function probeWithOembed(id, fetchImpl) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`;
  const res = await fetchImpl(url);
  if (res.ok) {
    return { id, status: 'active', source: 'oembed', duration: null };
  }
  const code = res.status;
  const status = code === 401 ? 'private' : 'dead';
  return { id, status, source: 'oembed', reason: `http_${code}` };
}

function parseIsoDuration(d) {
  if (!d) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return null;
  const [, h, min, s] = m;
  return (+h || 0) * 3600 + (+min || 0) * 60 + (+s || 0);
}

// Probe one video. Never throws for a network/parsing failure — it reports
// `status: 'dead', error` so a transient outage can't brick the catalog.
async function probeVideo(id, opts = {}) {
  const { apiKey, fetchImpl = fetch } = opts;
  try {
    if (apiKey) return await probeWithApi(apiKey, id, fetchImpl);
    return await probeWithOembed(id, fetchImpl);
  } catch (err) {
    return { id, status: 'dead', source: 'error', reason: err.message };
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Refresh cycle: probe stale songs AND their alternate versions, persist
// status, recompute effective song status (a track stays live while any of its
// sources plays), return summary.
async function runRefresh(db, {
  apiKey, maxAgeMs, force = false, concurrency = 5, fetchImpl = fetch,
} = {}) {
  const models = require('../src/models');
  const { setSongStatus, setSongVersionStatus, touchChecked, touchVersionChecked, staleSongs, staleVersions } = models;
  const songRows = await staleSongs(db, { maxAgeMs, force });
  const versionRows = await staleVersions(db, { maxAgeMs, force });

  const results = await mapLimit(songRows, concurrency, async s => {
    const probe = await probeVideo(s.youtubeId, { apiKey, fetchImpl });
    if (probe.status === 'active' && probe.duration) {
      await db.adapter.run('UPDATE songs SET duration = ? WHERE id = ?', [probe.duration, s.id]);
    }
    await setSongStatus(db, s.id, probe.status);
    return { songId: s.id, youtubeId: s.youtubeId, status: probe.status, source: probe.source };
  });

  const versionResults = await mapLimit(versionRows, concurrency, async v => {
    const probe = await probeVideo(v.youtubeId, { apiKey, fetchImpl });
    await setSongVersionStatus(db, v.id, probe.status);
    return { versionId: v.id, songId: v.songId, youtubeId: v.youtubeId, status: probe.status, source: probe.source };
  });

  const summary = {
    checked: results.length, active: 0, dead: 0, private: 0, errors: 0,
    versions: versionResults.length, versionsActive: 0, versionsDead: 0, versionsPrivate: 0, versionErrors: 0,
  };
  for (const r of results) {
    if (r.status === 'active') summary.active++;
    else if (r.status === 'private') summary.private++;
    else summary.dead++;
    if (r.source === 'error') summary.errors++;
  }
  for (const r of versionResults) {
    if (r.status === 'active') summary.versionsActive++;
    else if (r.status === 'private') summary.versionsPrivate++;
    else summary.versionsDead++;
    if (r.source === 'error') summary.versionErrors++;
  }
  return { summary, results: [...results, ...versionResults] };
}

module.exports = { probeVideo, runRefresh, parseIsoDuration, mapLimit };