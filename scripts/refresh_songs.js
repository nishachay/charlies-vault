'use strict';

// One-shot catalog health check from the CLI (works with a plain SQLite DB —
// no HTTP endpoint required):
//
//   node scripts/refresh_songs.js                    # check stale songs
//   node scripts/refresh_songs.js --force            # check everything
//   node scripts/refresh_songs.js --maxAgeMs=86400000

const { createDb } = require('../src/db');
const { runRefresh } = require('../lib/checkYouTube');

(async () => {
  const force = process.argv.includes('--force');
  const maxArg = process.argv.find(a => a.startsWith('--maxAgeMs='));
  const maxAgeMs = maxArg ? Number(maxArg.slice(11)) : undefined;

  const db = createDb();
  db.migrate();
  const { summary, results } = await runRefresh(db, {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    force,
    maxAgeMs,
  });
  console.log(`[refresh] checked=${summary.checked} active=${summary.active} dead=${summary.dead} private=${summary.private} errors=${summary.errors}`);
  const dead = results.filter(r => r.status !== 'active');
  for (const r of dead) console.log(`  ${r.status} ${r.songId} (${r.reason || r.source})`);
  await db.adapter.close();
})().catch(err => { console.error('[refresh] failed:', err.message); process.exit(1); });