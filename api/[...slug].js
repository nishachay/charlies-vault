'use strict';
// Single filesystem-router function for the whole /api tree, so Vercel's Hobby
// plan (max 12 functions) sees ONE, not one per endpoint. No root server.js
// file exists, so Vercel uses the filesystem router (this api/ = functions,
// everything else = static) instead of the Node-server preset.
const { json, readBody, parseUrl, createCtx, wrap } = require('../lib/apiLib');
const H = require('../lib/apiHandlers');

const ROUTES = [
  { re: /^\/api\/admin\/verify$/, handler: H.adminVerifyHandler },
  { re: /^\/api\/admin\/pending$/, handler: H.adminListHandler },
  { re: /^\/api\/admin\/queue$/, handler: H.adminQueueHandler },
  { re: /^\/api\/admin\/clear$/, handler: H.adminClearHandler },
  { re: /^\/api\/health$/, handler: H.healthHandler },
  { re: /^\/api\/artists$/, handler: H.artistsHandler },
  { re: /^\/api\/songs$/, handler: H.songsHandler },
  { re: /^\/api\/songs\/[^/]+$/, handler: H.songByIdHandler },
  { re: /^\/api\/report$/, handler: H.reportHandler },
  { re: /^\/api\/refresh$/, handler: H.refreshHandler },
  { re: /^\/api\/save$/, handler: H.saveHandler },
];

module.exports = wrap(async (req, res, ctx) => {
  const { pathname } = parseUrl(req);
  const route = ROUTES.find(r => r.re.test(pathname));
  if (!route) return json(res, 404, { error: 'endpoint not found' });
  return route.handler(req, res, ctx);
});
