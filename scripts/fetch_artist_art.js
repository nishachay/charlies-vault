'use strict';

// Fetches an artist's OFFICIAL Apple Music profile image (the "artist
// identity" photo shown on music.apple.com), via:
//   1. iTunes Search API lookup -> artist page URL
//   2. scrape the artist page for the AMCArtistImages avatar (+ mzstatic CDN)
// Fallback: the artist's top-track artwork when no identity photo exists.
//
//   node scripts/fetch_artist_art.js "Charlie Puth"          # prints best URL
//   node scripts/fetch_artist_art.js "Charlie Puth" --save    # also downloads
//                                                              to assets/artists/<slug>.jpg
//
// See AGENTS.md "Artist art".

const https = require('https');
const fs = require('fs');
const path = require('path');

function getRaw(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', ...headers } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getRaw(res.headers.location, headers));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

const getJson = async url => {
  const r = await getRaw(url);
  if (r.status !== 200) throw new Error(`GET ${url} -> ${r.status}`);
  return JSON.parse(r.body.toString('utf8'));
};

function slugOf(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Scrapes the Apple Music artist page (embedded JSON) for the artist identity
// image on the mzstatic CDN. Returns the most recent *_cropped.png base URL.
function artistIdentityImage(html) {
  const found = [];
  const re = /https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/(AMCArtistImages\w+)\/v4\/([a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+)\/([^"' ]*?(?:T\d\d-\d\d-\d\d\.\d+Z)?[^"' ]*?_cropped\.png)\/(?:{[^}]+}|[0-9x]+[a-z0-9.-]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const base = `${m[1]}/v4/${m[2]}/${m[3]}`;
    const date = (m[3].match(/(\d{4}-\d{2}-\d{2})T/) || [])[1] || '';
    found.push({ base, date });
  }
  if (!found.length) return null;
  found.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return `https://is1-ssl.mzstatic.com/image/thumb/${found[0].base}`;
}

function sized(u, size) {
  return `${u}/${size}x${size}cc-60.jpg`;
}

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];
  const doSave = args.includes('--save');
  const size = parseFloat(args.find(a => /^\d+$/.test(a))) || 800;
  if (!name) {
    console.error('usage: node scripts/fetch_artist_art.js "<artist name>" [size] [--save]');
    process.exit(1);
  }

  const json = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`);
  const artist = json.results && json.results[0];
  let url = null;
  if (artist) {
    const link = (artist.artistLinkUrl || '').replace('?uo=4', '');
    if (link) {
      try {
        const page = await getRaw(link);
        if (page.status === 200) url = artistIdentityImage(page.body.toString('utf8'));
      } catch (_) { /* fall through to song art */ }
    }
    if (url) url = sized(url, size);
  }
  if (!url) {
    const songJson = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=5`);
    const hit = (songJson.results || []).find(r => r.artworkUrl100);
    if (!hit) {
      console.error(`[art] no Apple Music artwork found for "${name}"`);
      process.exit(1);
    }
    url = hit.artworkUrl100.replace(/\/(\d+)x(\d+)bb\.jpg$/, `/${size}x${size}bb.jpg`);
  }

  console.log(`[art] ${name}: ${url}`);
  if (doSave) {
    const outPath = path.join(__dirname, '..', 'assets', 'artists', `${slugOf(name)}.jpg`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const img = await getRaw(url);
    if (img.status !== 200 || img.body[0] !== 0xff || img.body[1] !== 0xd8) {
      console.error(`[art] download failed (${img.status})`);
      process.exit(1);
    }
    fs.writeFileSync(outPath, img.body);
    console.log(`[art] saved -> assets/artists/${slugOf(name)}.jpg`);
  }
}

main().catch(err => { console.error('[art] failed:', err.message); process.exit(1); });