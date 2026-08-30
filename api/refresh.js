'use strict';
const { wrap } = require('./_lib');
const { refreshHandler } = require('./handlers');
module.exports = wrap(refreshHandler);