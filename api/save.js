'use strict';
const { wrap } = require('./_lib');
const { saveHandler } = require('./handlers');
module.exports = wrap(saveHandler);