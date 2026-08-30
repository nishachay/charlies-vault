'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { probeVideo, parseIsoDuration } = require('../lib/checkYouTube');

function fakeFetch(status) {
  return async () => ({ ok: status >= 200 && status < 300, status });
}

describe('parseIsoDuration', () => {
  it('parses YouTube contentDetails durations', () => {
    assert.equal(parseIsoDuration('PT4M13S'), 253);
    assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
    assert.equal(parseIsoDuration('PT30S'), 30);
    assert.equal(parseIsoDuration('P0D'), null);
    assert.equal(parseIsoDuration(null), null);
  });
});

describe('probeVideo — keyless oEmbed path', () => {
  it('marks a reachable video active', async () => {
    const r = await probeVideo('12345678901', { fetchImpl: fakeFetch(200) });
    assert.equal(r.status, 'active');
    assert.equal(r.source, 'oembed');
  });

  it('marks a deleted video dead', async () => {
    const r = await probeVideo('12345678901', { fetchImpl: fakeFetch(404) });
    assert.equal(r.status, 'dead');
    assert.equal(r.reason, 'http_404');
  });

  it('marks an embed-restricted video dead (403)', async () => {
    const r = await probeVideo('12345678901', { fetchImpl: fakeFetch(403) });
    assert.equal(r.status, 'dead');
  });

  it('marks a private video private (401)', async () => {
    const r = await probeVideo('12345678901', { fetchImpl: fakeFetch(401) });
    assert.equal(r.status, 'private');
  });

  it('never throws on network failure — reports dead with reason', async () => {
    const r = await probeVideo('12345678901', {
      fetchImpl: async () => { throw new Error('ECONNRESET'); },
    });
    assert.equal(r.status, 'dead');
    assert.equal(r.source, 'error');
    assert.match(r.reason, /ECONNRESET/);
  });
});

describe('probeVideo — YouTube Data API path', () => {
  const apiFetch = item => async () => ({ ok: true, status: 200, json: async () => ({ items: item ? [item] : [] }) });

  it('uses the API when a key is present', async () => {
    const r = await probeVideo('vid', {
      apiKey: 'KEY',
      fetchImpl: apiFetch({ id: 'vid', status: { privacyStatus: 'public' }, contentDetails: { duration: 'PT4M13S' } }),
    });
    assert.equal(r.status, 'active');
    assert.equal(r.source, 'api');
    assert.equal(r.duration, 253);
  });

  it('flags private videos', async () => {
    const r = await probeVideo('vid', {
      apiKey: 'KEY',
      fetchImpl: apiFetch({ id: 'vid', status: { privacyStatus: 'private' }, contentDetails: {} }),
    });
    assert.equal(r.status, 'private');
  });

  it('flags deleted videos (empty items)', async () => {
    const r = await probeVideo('vid', { apiKey: 'KEY', fetchImpl: apiFetch(null) });
    assert.equal(r.status, 'dead');
  });
});