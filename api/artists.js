'use strict';
const { wrap } = require('./_lib');
const { artistsHandler } = require('./handlers');
module.exports = wrap(artistsHandler);