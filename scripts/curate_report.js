'use strict';

// Curation prep for the harvested playlist data. Maps every unique id to the
// artist of its source playlist(s), then flags the items that look like vault
// material (unreleased / leak / demo / OG / alt-version) vs released/official
// content. The human (me) reads this to build the per-artist curated roster
// that goes into scripts/build_catalog.js.
//
//   node scripts/curate_report.js [--json artists.json]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ARTIST_BY_PLAYLIST = {
  'PLDea6BLxBE1y3l0J6GzUkRZBZzpP5i1Jv': 'Kanye West',
  'PLR4lR8H2HuIgC-P6z7CCqGxqyP0CjeqaX': 'Kanye West',
  'PLOltwsXbbJ9eifFymDVUMzDskxjmzsGpq': 'Kanye West',
  'PLz8Kr4JiCXQJrTxWk6n-zfn6qyfQqwfNI': 'The Weeknd',
  'PLynQTJDDdEUVAKuSfnq6XxEAhzUHEx-xx': 'The Weeknd',
  'PLh2aptmXt02sN9XhLHHXG_2MDte_V-ly1': 'Drake',
  'PL0H-g0ykUtf6mcwcyY6N1L73OsGQ1N0Nq': 'Drake',
  'PLdni4zpmbkRTCTTps_CD4owswxZaBnEB2': 'Juice WRLD',
  'PL7awfFWYp_pkSNIW7gvbRAKMhapNOcyxa': 'Travis Scott',
  'PL8pdMUZ_6VqD-wPWIavgvoZZeEqJ4gA1H': 'Travis Scott',
  'PLrw3BKlw-a54NpmwWhE5DmRod9dSfQmcC': 'Travis Scott',
  'PLSS5kpWZCfKPAUXK40j2gkzyRvKyMiQzY': 'Billie Eilish',
  'PLVGg0v0_YF6_U9uCXvcvcHc2QEB_9VciA': 'Post Malone',
  'PL3yd3ytr6G2RdTV5E7E5GN8Fz3EvuNBUn': 'Justin Bieber',
  'PLfHuc0l0tOJIr6WVXrn6hsX670AZ5H8pO': 'Justin Bieber',
  'PLnAgEJZSb4mQYtlGp9ipQTwxfidRiBhkE': 'Ariana Grande',
  'PLDwkf8Nx10vJ8Eoic_B22M_cknTZ6cUhE': 'Ariana Grande',
  'PLXf_MVWdzQvZfUecLckXwWJ6-MlNI6ypz': 'XXXTentacion',
  'PLtOzbVQmM6KxBJwEVictHh7qItb4gdN7b': 'XXXTentacion',
  'PLWxCVrVSkN5_3qMMF1Vjqm53Qa1rxtlkZ': 'Lil Uzi Vert',
};

const VAULT_TERMS = /unreleased|leak|leaked|demo|outtake|og\b|original (version|take)|\balternat(e|ive)|alt version|v\d|version ?\d|snippet|ig live|insta live|alternate|session|take [12]|first draft|early/i;
const OFFICIAL = /official (audio|video|lyric|visualizer)|music video|\bvevo\b|official\b|hq audio|status video|\baddress\b/i;
const RELEASED_MARKERS = /lyrics?\b|mix(ed)? by|\bvers\b|\bft\.?\s|\(official\)|instagram|twitter/i;

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

(async () => {
  const h = require('./harvested.json');
  const byId = new Map(h.probes.map(p => [p.id, p]));
  const lists = h.lists;

  const idArtist = new Map();
  for (const l of lists) {
    const artist = ARTIST_BY_PLAYLIST[l.id];
    if (!artist) continue;
    for (const id of l.videoIds) idArtist.set(id, artist);
  }

  const perArtist = {};
  for (const [id, artist] of idArtist) {
    const p = byId.get(id);
    if (!p || p.status !== 'active') continue;
    (perArtist[artist] = perArtist[artist] || []).push({ ...p, artist });
  }

  const report = { artists: {} };
  for (const [artist, rows] of Object.entries(perArtist)) {
    const vault = [], released = [], other = [];
    for (const r of rows) {
      const t = (r.realTitle || '');
      if (VAULT_TERMS.test(t) && !(OFFICIAL.test(t))) vault.push(r);
      else if (t && !OFFICIAL.test(t)) released.push(r);
      else other.push(r);
    }
    const sort = (a, b) => (b.duration || 0) - (a.duration || 0);
    vault.sort(sort); released.sort(sort); other.sort(sort);
    report.artists[slug(artist)] = { name: artist, vault, released, other };
    console.log(`${artist.padEnd(16)} total:${String(rows.length).padStart(3)}  vault-cand:${String(vault.length).padStart(3)}  other:${String(released.length + other.length).padStart(3)}`);
  }

  const outJSON = process.argv.includes('--json');
  const dest = outJSON ? 'artists_curate.json' : 'curate_report.txt';
  fs.writeFileSync(path.join(__dirname, dest), (outJSON ? JSON.stringify(report, null, 1) : renderText(report)) + '\n');
  console.log(`[curate] wrote scripts/${dest}`);
})().catch(err => { console.error('[curate] failed:', err.message); process.exit(1); });

function renderText(report) {
  const L = [];
  for (const [, a] of Object.entries(report.artists)) {
    L.push(`\n========== ${a.name} (vault candidates ${a.vault.length}) ==========`);
    for (const r of a.vault) L.push(`  ${String(r.duration || '?').padStart(4)}s  ${(r.realTitle || '').slice(0, 70).padEnd(70)}  ${(r.realAuthor || '?').slice(0, 20)}  ${r.id}`);
  }
  L.push(`\n========== ${'\u00a0'.repeat(0)} released / other per artist ==========`);
  for (const [, a] of Object.entries(report.artists)) {
    L.push(`\n-- ${a.name} (released ${a.released.length}, other ${a.other.length}) --`);
    for (const r of a.released.slice(0, 8)) L.push(`  R ${(r.duration || '?').toString().padStart(4)}s  ${(r.realTitle || '').slice(0, 70)}  ${r.id}`);
    for (const r of a.other.slice(0, 8)) L.push(`  O ${(r.duration || '?').toString().padStart(4)}s  ${(r.realTitle || '').slice(0, 70)}  ${r.id}`);
  }
  return L.join('\n');
}