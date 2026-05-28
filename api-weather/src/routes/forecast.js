'use strict';

const express = require('express');
const router  = express.Router();
const weatherService = require('../services/weatherService');
const persistence    = require('../services/persistenceService');

router.get('/', async (req, res) => {
  const start = Date.now();
  const { city, days = '5' } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'Query param "city" is required' });
  }

  const daysNum = Math.min(Math.max(parseInt(days) || 5, 1), 7);

  try {
    const data = await weatherService.getForecast(city, daysNum);
    persistence.logTransaction('api-weather', '/forecast', 'GET', 200, Date.now() - start, `${city}:${daysNum}`);
    res.json(data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    persistence.logTransaction('api-weather', '/forecast', 'GET', status, Date.now() - start, city);
    res.status(status).json({ error: status === 404 ? `City "${city}" not found` : err.message });
  }
});

module.exports = router;
