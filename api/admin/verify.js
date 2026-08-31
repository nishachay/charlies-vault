'use strict';
const { wrap } = require('../_lib');
const { adminVerifyHandler } = require('../handlers');
module.exports = wrap(adminVerifyHandler);
