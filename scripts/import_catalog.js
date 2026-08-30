'use strict';

// Seeds / upserts the database from scripts/catalog.json (or --file=<path>).
//
//   node scripts/import_catalog.js
//
// Idempotent: re-running merges instead of duplicating. To add or extend
// artists/songs, edit catalog.json (or index.html, then `npm run db:export`)
// and re-run this script.

const path = require('path');

(async () => {
  const arg = process.argv.find(a => a.startsWith('--file='));
  const catalog = require(arg ? arg.slice(7) : path.join(__dirname, 'catalog.json'));

  const { createDb } = require('../src/db');
  const { upsertCatalog } = require('../src/seeder');
  const { listArtists, listSongs } = require('../src/models');

  const db = createDb();
  db.migrate();
  const skipped = await upsertCatalog(db, catalog);

  const artists = await listArtists(db);
  const songs = await listSongs(db, { includeAll: true });
  console.log(`[seed] backend=${db.adapter.kind} artists=${artists.length} songs=${songs.length} (skipped=${skipped})`);
  await db.adapter.close();
})().catch(err => { console.error('[seed] failed:', err.message); process.exit(1); });