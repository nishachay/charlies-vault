'use strict';
const { wrap } = require('../_lib');
const { adminListHandler } = require('../handlers');
module.exports = wrap(adminListHandler);
