'use strict';

const express = require('express');
const router  = express.Router();
const locationService = require('../services/locationService');
const persistence     = require('../services/persistenceService');

const extractIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip;
};

router.get('/', async (req, res) => {
  const start = Date.now();
  const ip    = req.query.ip || extractIp(req);

  try {
    const data = await locationService.getLocation(ip);
    persistence.logTransaction('api-location', '/location', 'GET', 200, Date.now() - start, ip);
    res.json(data);
  } catch (err) {
    persistence.logTransaction('api-location', '/location', 'GET', 500, Date.now() - start, ip);
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  const { limit = '10' } = req.query;
  try {
    res.json(await persistence.getLocationHistory(parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
