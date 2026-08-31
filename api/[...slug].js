'use strict';
// Single catch-all API function so the Hobby plan (max 12 functions) sees ONE,
// not one per endpoint. All /api/* routes dispatch through handlers here.
const { json, readBody, parseUrl, createCtx, wrap } = require('./_lib');
const H = require('./handlers');

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
  await route.handler(req, res, ctx);
});
