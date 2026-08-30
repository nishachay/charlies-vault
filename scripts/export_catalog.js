'use strict';

// Extracts the embedded catalog (SONGS + ARTISTS_DATA) from index.html and
// writes it to scripts/catalog.json — the machine-readable source of truth
// that seeds the database. Run after editing the catalog in index.html:
//
//   node scripts/export_catalog.js

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const outPath = path.join(__dirname, 'catalog.json');

function extractConst(src, name) {
  const re = new RegExp(`(?:const|let) ${name} = \\[([\\s\\S]*?)\n\\s*\\];`);
  const m = src.match(re);
  if (!m) throw new Error(`Could not find const ${name} in index.html`);
  return new Function(`"use strict"; return [${m[1]}\n];`)();
}

const html = fs.readFileSync(htmlPath, 'utf8');
const songs = extractConst(html, 'SONGS');
const artists = extractConst(html, 'ARTISTS_DATA').map(a => ({
  slug: a.name ? a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
  name: a.name,
  initials: a.initials || null,
  tag: a.tag || null,
  avatarUrl: a.avatarUrl || null,
}));

fs.writeFileSync(outPath, JSON.stringify({ artists, songs }, null, 2) + '\n');
console.log(`[export] ${artists.length} artists, ${songs.length} songs -> scripts/catalog.json`);