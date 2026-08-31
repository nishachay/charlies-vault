'use strict';
const { wrap } = require('../_lib');
const { adminQueueHandler } = require('../handlers');
module.exports = wrap(adminQueueHandler);
