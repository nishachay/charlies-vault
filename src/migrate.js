'use strict';

// CLI: apply the schema to whatever backend is configured.
//   node src/migrate.js           # SQLite (local) or DATABASE_URL (Postgres)

const { createDb } = require('./db');

(async () => {
  const db = createDb();
  db.migrate();
  const { stats } = require('./models');
  const s = await stats(db);
  console.log(`[migrate] OK — backend=${db.adapter.kind} songs=${s.songs} artists=${s.artists}`);
  await db.adapter.close();
})().catch(err => { console.error('[migrate] failed:', err.message); process.exit(1); });