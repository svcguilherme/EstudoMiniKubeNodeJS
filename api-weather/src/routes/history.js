'use strict';

const express = require('express');
const router  = express.Router();
const persistence = require('../services/persistenceService');

router.get('/weather', async (req, res) => {
  const { city, limit = '10' } = req.query;
  try {
    const data = await persistence.getWeatherHistory(city, parseInt(limit));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', (req, res) => {
  const { limit = '50', offset = '0' } = req.query;
  try {
    const data = persistence.getTransactions(parseInt(limit), parseInt(offset));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
