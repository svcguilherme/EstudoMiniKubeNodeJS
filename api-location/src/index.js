require('./telemetry');
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const { metricsMiddleware, register } = require('./middleware/metrics');
const locationRouter = require('./routes/location');
const { connectMongo, initSqlite } = require('./services/persistenceService');
const { connect: connectRabbitMQ }  = require('./services/messagingService');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

app.use('/location', locationRouter);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'api-location', timestamp: new Date().toISOString() })
);

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const start = async () => {
  initSqlite();
  await connectMongo();
  await connectRabbitMQ();
  app.listen(PORT, '0.0.0.0', () =>
    console.log(`api-location running on port ${PORT}`)
  );
};

start().catch(console.error);
