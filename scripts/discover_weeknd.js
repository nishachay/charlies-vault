'use strict';

// Keyless discovery + truth-check for The Weeknd unreleased-track uploads.
// Sources: the "After Hours unreleased demos 2018-2020" playlist (harvested
// from its HTML) plus ids surfaced by web search with known claims.
//
// Each id is probed with youtube.com/oembed, which returns BOTH playability
// (200 = plays in our iframe) and the video's real title/author — the same
// truth-check that exposed the fabricated legacy artists.
//
// Writes gitignored scripts/weeknd_candidates.json and prints the verdicts.
//   node scripts/discover_weeknd.js

const fs = require('fs');
const path = require('path');
const { mapLimit } = require('../lib/checkYouTube');

const CLAIMS = {
  '4yijhp-x4WU': 'Hold Your Heart / The Abyss (After Hours original)',
  '82jpYIdC0ks': 'Timeless (Demo V4)',
  'qtNZilrswno': 'WeekndHQ 2013 upload (unidentified)',
  'emufFyDShlo': 'Rio (feat. Anitta) — live premier 2026',
  'MCq6_cIU2QE': 'Wake Me Up (early leak, CDQ)',
  'ZGdLMEka6dc': 'Unprepared Certainty... teaser (Hold Your Heart rework)',
  'TZXoz-TGzxY': 'The Birds Interlude (live)',
};

const PLAYLIST_IDS = [
  '22Hz75MVE8E','sqUihaHhZYw','NscMa8aLrLs','raSXyFN2h-o','kgTnxCT7Yqk','dDNWpfsV2Gg',
  'qS5outNseGQ','w3p_pI4jhTk','FwiQadNFqUI','rxzANLTQfOg','EYYuE5YdrNU','bjchSct38ck',
  '5SDoJ990c-0','4cqOyhrgnx8','Wu-fEzEnDw8','Zr-ges6LU9Q','JteH1CHqCMI','mtBABBpQ_dU',
  'gszjkDv_LJ8','aWAbzYVRH3U','p-Qj7tsn-G0','E-ceqs_qehc','UWdm5RLDRrA','_pMnOZwOLaU',
  '_KbgAd-6HxU','cmNTfyzfrJY','2OSIlun7Q6Q','0sqYPh_9eEk','j-AJImLkBCA','vXRvPARj2aI',
  'tdpKgYgW5Qw','OaoBsbveBng','r6rwrlY0TnQ','ihJW2sSD4fs','xWjix8V3P3w','m-XD2SuYJG0',
  '11yHvabfMqw',
];

async function main() {
  const ids = new Set([...Object.keys(CLAIMS), ...PLAYLIST_IDS]);
  console.log(`[weeknd] probing ${ids.size} candidate videos (keyless oEmbed)...`);

  const results = await mapLimit([...ids], 6, async id => {
    try {
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      const body = r.ok ? await r.json() : null;
      return {
        id,
        claim: CLAIMS[id] || null,
        status: r.ok ? 'active' : r.status === 401 ? 'private' : 'dead',
        reason: r.ok ? null : `http_${r.status}`,
        realTitle: body ? body.title : null,
        realAuthor: body ? body.author_name : null,
      };
    } catch (err) {
      return { id, claim: CLAIMS[id] || null, status: 'dead', reason: err.message, realTitle: null, realAuthor: null };
    }
  });

  results.sort((a, b) => (a.status === 'active' ? -1 : 1) || (a.realTitle || '').localeCompare(b.realTitle || ''));
  fs.writeFileSync(path.join(__dirname, 'weeknd_candidates.json'), JSON.stringify(results, null, 2) + '\n');

  const active = results.filter(r => r.status === 'active');
  console.log(`\n[weeknd] ACTIVE (${active.length}/${results.length}):`);
  for (const r of active) {
    console.log(`  ✓ ${r.id}  real: "${r.realTitle}" — ${r.realAuthor}${r.claim ? `   | claim: ${r.claim}` : ''}`);
  }
  const dead = results.filter(r => r.status !== 'active');
  console.log(`\n[weeknd] dead/private (${dead.length}): sample lines...`);
  for (const r of dead.slice(0, 25)) console.log(`  ✗ ${r.id} ${r.reason || r.status}`);
  console.log('\n[weeknd] full detail in scripts/weeknd_candidates.json (gitignored).');
}

main().catch(err => { console.error('[weeknd] failed:', err.message); process.exit(1); });