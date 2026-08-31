'use strict';
const { wrap } = require('../_lib');
const { adminClearHandler } = require('../handlers');
module.exports = wrap(adminClearHandler);
