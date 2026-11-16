'use strict';

const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Start the adapter in a temporary js-controller and check that it does not crash
// (without a configured address it only waits for the "search" command).
tests.integration(path.join(__dirname, '..'));
