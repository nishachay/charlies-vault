'use strict';

// Idempotent catalog seeding — shared by the CLI (scripts/import_catalog.js)
// and the dev server bootstrap (seeds an empty database so `node dev.js`
// "just works").

const { upsertArtist, upsertSong, upsertSongVersion, versionIdOf, listArtists, listSongs } = require('./models');

const slugOf = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function upsertCatalog(db, catalog) {
  const artistSlugs = new Map();
  (catalog.artists || []).forEach((a, i) => {
    const slug = a.slug || slugOf(a.name);
    artistSlugs.set(a.name, slug);
    upsertArtist(db, { ...a, slug, avatarUrl: a.avatarUrl }, a.sortOrder ?? i);
  });

  // Resolve slugs for any artists added after the initial seed.
  const known = await listArtists(db);
  known.forEach(a => { if (!artistSlugs.has(a.name)) artistSlugs.set(a.name, a.slug); });

  // Auto-register artists that appear on songs but not in the artists list
  // (e.g. collab credits like "Playboi Carti & Lil Uzi Vert"). Nothing drops.
  const collabs = (catalog.songs || [])
    .map(s => s.artist)
    .filter((name, i, arr) => name && !artistSlugs.has(name) && arr.indexOf(name) === i);
  collabs.forEach((name, i) => {
    const slug = slugOf(name);
    artistSlugs.set(name, slug);
    upsertArtist(db, { slug, name, initials: initialsOf(name), tag: null, avatarUrl: null }, 100 + i);
  });

  let skipped = 0;
  for (const s of catalog.songs || []) {
    const slug = artistSlugs.get(s.artist);
    if (!slug) { console.warn(`[seed] skip "${s.title}" — unknown artist "${s.artist}"`); skipped++; continue; }
    upsertSong(db, { ...s, artistSlug: slug });
    (s.versions || []).forEach((v, i) => {
      if (v.youtubeId === s.youtubeId) return;
      upsertSongVersion(db, {
        id: versionIdOf(s.id, i),
        songId: s.id,
        label: v.label || `version ${i + 1}`,
        youtubeId: v.youtubeId,
        notes: v.notes || null,
        sortOrder: i,
      });
    });
  }
  return skipped;
}

const initialsOf = name => name.split(/[&\s]+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 3).join('');

// Seed only when the DB has never been populated. Returns number of songs
// written, or null when the DB already had data.
async function seedIfEmpty(db, catalogPath) {
  const artists = await listArtists(db);
  const songs = await listSongs(db, { includeAll: true });
  if (artists.length || songs.length) return null;

  let catalog;
  try {
    catalog = require(catalogPath || './catalog.json');
  } catch {
    try { catalog = require('../scripts/catalog.json'); } catch {
      console.warn('[seed] no catalog.json found — run `node scripts/export_catalog.js` first');
      return null;
    }
  }
  await upsertCatalog(db, catalog);
  const after = await listSongs(db, { includeAll: true });
  return after.length;
}

module.exports = { upsertCatalog, seedIfEmpty };