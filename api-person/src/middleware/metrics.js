'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'person_' });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total', help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'], registers: [register],
});
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request duration',
  labelNames: ['method', 'route'], buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});
const rabbitmqPublished = new client.Counter({
  name: 'rabbitmq_messages_published_total', help: 'RabbitMQ messages published',
  labelNames: ['service', 'routing_key'], registers: [register],
});

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const dur   = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route }, dur);
  });
  next();
};

module.exports = { register, metricsMiddleware, rabbitmqPublished };
