'use strict';
const { wrap } = require('./_lib');
const { healthHandler } = require('./handlers');
module.exports = wrap(healthHandler);