'use strict';
const path = require('path');
const jsonServer = require('json-server');

const router = jsonServer.router(path.join(__dirname, 'db.json'));

module.exports = { router, db: router.db };
