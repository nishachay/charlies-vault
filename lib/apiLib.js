'use strict';

// Shared plumbing for API entrypoints (used by both the local server and the
// Vercel functions under api/). Handlers live in handlers.js and receive a
// `ctx = { db, adminKey, apiKey }`.

const crypto = require('crypto');

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function parseUrl(req) {
  const url = new URL(req.url, 'http://localhost');
  return { pathname: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAdmin(req, adminKey) {
  if (!adminKey) return false;
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return !!token && safeEqual(token, adminKey);
}

// Production DB instance, cached per process so SQLite file locks stay single
// and the pg pool is reused across warm invocations. If no database is
// configured (e.g. a static Vercel deploy without DATABASE_URL), this returns
// null and the API responds with a graceful "database not configured" 503 —
// it must never crash the function, because the static frontend serves the
// full catalog without the API and only pings it as an optional enhancement.
function getDb() {
  if (process.env.DATABASE_URL) {
    if (!globalThis.__outtakeDb) {
      const { createDb } = require('../src/db');
      const db = createDb();
      db.migrate();
      globalThis.__outtakeDb = db;
    }
    return globalThis.__outtakeDb;
  }
  return null;
}

function createCtx() {
  return {
    db: getDb(),
    adminKey: process.env.ADMIN_KEY || '',
    apiKey: process.env.YOUTUBE_API_KEY || '',
  };
}

function wrap(handler) {
  return async function (req, res) {
    try {
      const ctx = createCtx();
      if (!ctx.db || !ctx.db.adapter) {
        return json(res, 503, {
          error: 'database not configured',
          detail: 'Latency-free static catalog is bundled in the frontend; set DATABASE_URL only if you want this write/enrichment API.',
        });
      }
      await handler(req, res, ctx);
    } catch (err) {
      console.error('[api]', err && err.stack ? err.stack : err);
      json(res, 500, { error: err.message || 'internal error' });
    }
  };
}

module.exports = { json, readBody, parseUrl, safeEqual, isAdmin, createCtx, wrap };