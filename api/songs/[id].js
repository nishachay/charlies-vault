'use strict';
const { wrap } = require('../_lib');
const { songByIdHandler } = require('../handlers');
module.exports = wrap(songByIdHandler);