'use strict';
const { wrap } = require('./_lib');
const { reportHandler } = require('./handlers');
module.exports = wrap(reportHandler);