'use strict';

// { OUTTAKE } local dev server and shared HTTP factory.
//
//   node server.js                    -> http://localhost:8080
//   PORT=9000 ADMIN_KEY=abc node server.js
//
// Serves the static frontend (index.html with no-store cache so edits show up
// instantly) and mounts the same API handlers used by the Vercel functions in
// api/ on a database that defaults to local SQLite. On first boot an empty DB
// is auto-seeded from scripts/catalog.json.
//
// Tests import createApp() with an in-memory DB — no ports or files needed.

const http = require('http');
const fs = require('fs');
const path = require('path');

const { json } = require('./api/_lib');
const handlers = require('./api/handlers');
const { createDb } = require('./src/db');
const { seedIfEmpty } = require('./src/seeder');

const API_ROUTES = [
  { re: /^\/api\/health$/, handler: handlers.healthHandler },
  { re: /^\/api\/artists$/, handler: handlers.artistsHandler },
  { re: /^\/api\/songs$/, handler: handlers.songsHandler },
  { re: /^\/api\/songs\/[^/]+$/, handler: handlers.songByIdHandler },
  { re: /^\/api\/report$/, handler: handlers.reportHandler },
  { re: /^\/api\/refresh$/, handler: handlers.refreshHandler },
  { re: /^\/api\/save$/, handler: handlers.saveHandler },
];

const CONTENT_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function createApp({ db, adminKey, apiKey, probe } = {}) {
  // In a serverless deployment (Vercel) without DATABASE_URL, Postgres isn't
  // configured and SQLite on the instance is throwaway — so the root entrypoint
  // must still serve the static frontend (which plays from its bundled catalog)
  // and answer the API gracefully instead of crashing. A missing DB means the
  // API returns a clean 503; the site is never blocked.
  let database = null;
  if (db) {
    database = db;
  } else if (process.env.DATABASE_URL) {
    try {
      database = createDb();
      database.migrate();
    } catch (err) { console.warn('[boot] DB unavailable:', err.message); database = null; }
  }

  const ctxBase = {
    db: database,
    adminKey: adminKey || process.env.ADMIN_KEY || '',
    apiKey: apiKey || process.env.YOUTUBE_API_KEY || '',
    probe,
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Curation upload endpoint (dev only — stored audio is gitignored).
    if (pathname === '/api/upload' && req.method === 'POST') return handleUpload(req, res);

    if (pathname.startsWith('/api/')) {
      if (!database) {
        return json(res, 503, {
          error: 'database not configured',
          detail: 'The static catalog is bundled in the frontend; set DATABASE_URL only if you want this write/enrichment API.',
        });
      }
      const ctx = { ...ctxBase, db: database };
      const route = API_ROUTES.find(r => r.re.test(pathname));
      if (!route) return json(res, 404, { error: 'endpoint not found' });
      return Promise.resolve(route.handler(req, res, ctx))
        .catch(err => { console.error('[api]', err); json(res, 500, { error: err.message || 'internal error' }); });
    }

    // Static files (never outside the project root).
    const filePath = path.resolve(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!filePath.startsWith(__dirname + path.sep) && filePath !== path.join(__dirname, 'index.html')) {
      return json(res, 403, { error: 'forbidden' });
    }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found'); return; }
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': pathname === '/' ? 'no-cache' : 'public, max-age=60',
      });
      res.end(data);
    });
  });
}

// Dev-only: accept audio dropped in the curation flow and store it in local_uploads/ (gitignored).
function handleUpload(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const rawName = params.get('name') || `track_${Date.now()}.mp3`;
  const cleanName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const dir = path.join(__dirname, 'local_uploads');
  fs.mkdirSync(dir, { recursive: true });
  const target = fs.createWriteStream(path.join(dir, cleanName));
  req.pipe(target);
  target.on('error', err => { console.error(err); json(res, 500, { error: err.message }); });
  target.on('finish', () => json(res, 200, { url: `/local_uploads/${cleanName}` }));
}

if (require.main === module) {
  // Local dev boot: SQLite + auto-seed. On a serverless platform where the
  // root entrypoint is invoked this way but no persistent DB is available,
  // createApp() already degrades gracefully; if a local SQLite DB can't be
  // made (e.g. read-only filesystem), still serve the static site with a 503
  // API rather than crash the process.
  let db = null;
  try { db = createDb(); if (db && typeof db.migrate === 'function') db.migrate(); }
  catch (err) { console.warn('[boot] local SQLite unavailable:', err.message); }
  const server = createApp({ db });
  if (db) {
    seedIfEmpty(db).then(seeded => {
      if (seeded !== null) console.log(`[boot] auto-seeded ${seeded} songs into local SQLite`);
    }).catch(err => console.warn('[boot] seed skipped:', err.message));
  }

  const port = process.env.PORT || 8080;
  server.listen(port, () => console.log(`OUTTAKE dev server: http://localhost:${port} (${db ? db.adapter.kind : 'static-only'})`));
}

module.exports = { createApp, API_ROUTES };