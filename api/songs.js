'use strict';
const { wrap } = require('./_lib');
const { songsHandler } = require('./handlers');
module.exports = wrap(songsHandler);