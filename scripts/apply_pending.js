'use strict';

// ---------------------------------------------------------------------------
// Apply the admin pending queue: fetch queued (verified, playable) tracks and
// add them to the vault roster via the shared add_tracks engine. Used by the
// GitHub Action (.github/workflows/apply_pending.yml) and locally:
//
//   # Local: read a JSON file of {url, artist, title?} entries:
//   node scripts/apply_pending.js --file=tmp_pending.json
//
//   # Via the live API (in the Action runner):
//   PROD_URL=https://app.vercel.app ADMIN_KEY=xxx \
//       node scripts/apply_pending.js --api
//
// After adding, the caller runs  db:build && db:sync  (to produce catalog.json
// and re-bundle index.html), then commits + pushes; next Vercel deploy ships it.
// ---------------------------------------------------------------------------

const path = require('path');
const { addFromSpecs } = require('./add_tracks');

async function fetchFromApi(prodUrl, adminKey) {
  const res = await fetch(`${prodUrl.replace(/\/+$/, '')}/api/admin/pending`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  if (!res.ok) throw new Error(`api/admin/pending -> ${res.status}`);
  const data = await res.json();
  return (data.pending || []).filter(t => !t.appliedAt);
}

async function main() {
  let specs = [];
  const fileArg = process.argv.find(a => a.startsWith('--file='));
  if (fileArg) {
    const p = path.resolve(fileArg.slice(7));
    const data = require(p);
    specs = (Array.isArray(data) ? data : data.pending || []).filter(t => !t.appliedAt);
  } else if (process.argv.includes('--api')) {
    const prodUrl = process.env.PROD_URL;
    const adminKey = process.env.ADMIN_KEY;
    if (!prodUrl || !adminKey) { console.error('--api needs PROD_URL and ADMIN_KEY env vars'); process.exit(1); }
    const pending = await fetchFromApi(prodUrl, adminKey);
    specs = pending.map(t => ({ url: t.url, artist: t.artist, title: t.requestedTitle || t.title }));
  } else {
    console.error('Usage: node scripts/apply_pending.js --file=tracks.json | --api');
    process.exit(1);
  }

  if (!specs.length) { console.log('Nothing to apply.'); process.exit(0); }
  const results = await addFromSpecs(specs);
  for (const r of results) {
    const line = r.status === 'added'
      ? `  + added  ${r.artist} — ${r.title}  (${r.id})`
      : `  = ${r.status.toUpperCase()}  ${r.reason}${r.id ? ' (' + r.id + ')' : ''}`;
    console.log(line);
  }
  const added = results.filter(r => r.status === 'added').length;
  console.log(`\n${added}/${results.length} added to vault_roster.json.`);
}

main().catch(err => { console.error('[apply_pending] failed:', err.message); process.exit(1); });
