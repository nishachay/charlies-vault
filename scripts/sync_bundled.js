'use strict';

// Regenerates the SONGS / ARTISTS_DATA arrays embedded in index.html from
// scripts/catalog.json, keeping the static offline fallback in sync with the
// verified database catalog. Run after rebuilding catalog.json:
//
//   node scripts/sync_bundled.js

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const catalog = require('./catalog.json');

const renderSong = s => JSON.stringify({
  id: s.id, title: s.title, artist: s.artist, youtubeId: s.youtubeId,
  duration: s.duration ?? null,
});
const renderArtist = a => JSON.stringify({
  name: a.name, initials: a.initials || '', tag: a.tag || '', avatarUrl: a.avatarUrl || '',
});

const songsBlock = `const SONGS = [\n${catalog.songs.map(s => '  ' + renderSong(s) + ',').join('\n')}\n];`;
const artistsBlock = `let ARTISTS_DATA = [\n${catalog.artists.map(a => '  ' + renderArtist(a) + ',').join('\n')}\n];`;

let html = fs.readFileSync(htmlPath, 'utf8');
let songsMatched = 0, artistsMatched = 0;
html = html.replace(/const SONGS = \[[\s\S]*?\n\];/, () => { songsMatched++; return songsBlock; });
html = html.replace(/let ARTISTS_DATA = \[[\s\S]*?\n\s*\];/, () => { artistsMatched++; return artistsBlock; });
if (songsMatched !== 1 || artistsMatched !== 1) {
  throw new Error(`index.html blocks not found (SONGS:${songsMatched}, ARTISTS_DATA:${artistsMatched})`);
}

fs.writeFileSync(htmlPath, html);
console.log(`[sync] index.html bundled catalog → ${catalog.songs.length} songs, ${catalog.artists.length} artists`);