'use strict';

const express = require('express');
const router  = express.Router();
const weatherService = require('../services/weatherService');
const persistence    = require('../services/persistenceService');

router.get('/', async (req, res) => {
  const start = Date.now();
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'Query param "city" is required' });
  }

  try {
    const data = await weatherService.getCurrentWeather(city);
    persistence.logTransaction('api-weather', '/weather', 'GET', 200, Date.now() - start, city);
    res.json(data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    persistence.logTransaction('api-weather', '/weather', 'GET', status, Date.now() - start, city);
    res.status(status).json({ error: status === 404 ? `City "${city}" not found` : err.message });
  }
});

module.exports = router;
