'use strict';

const express  = require('express');
const { body, validationResult } = require('express-validator');
const router   = express.Router();
const personService   = require('../services/personService');
const messaging       = require('../services/messagingService');
const persistence     = require('../services/persistenceService');

const validate = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('birthdate')
    .notEmpty().withMessage('birthdate is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('birthdate must be YYYY-MM-DD'),
];

router.post('/', validate, async (req, res) => {
  const start  = Date.now();
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, birthdate } = req.body;

  try {
    const data = personService.calculateAge(name, birthdate);

    await persistence.savePersonQuery(data);
    await messaging.publish(messaging.EXCHANGES.person, 'person.queried', {
      ...data, service: 'api-person',
    });

    persistence.logTransaction('api-person', '/person', 'POST', 200, Date.now() - start, `${name}:${birthdate}`);
    res.json(data);
  } catch (err) {
    persistence.logTransaction('api-person', '/person', 'POST', 400, Date.now() - start, name);
    res.status(400).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  const { name, limit = '10' } = req.query;
  try {
    res.json(await persistence.getPersonHistory(name, parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
