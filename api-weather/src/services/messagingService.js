'use strict';

const amqp = require('amqplib');
const { rabbitmqPublished } = require('../middleware/metrics');

let channel = null;
let connection = null;
let reconnectTimer = null;

const EXCHANGES = {
  climate: 'climate-events',
  location: 'location-events',
  person: 'person-events',
};

const setupChannel = async (conn) => {
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGES.climate, 'topic', { durable: true });
  await ch.assertExchange(EXCHANGES.location, 'topic', { durable: true });
  await ch.assertExchange(EXCHANGES.person, 'topic', { durable: true });

  await ch.assertQueue('audit-queue', { durable: true });
  await ch.bindQueue('audit-queue', EXCHANGES.climate, '#');
  await ch.bindQueue('audit-queue', EXCHANGES.location, '#');
  await ch.bindQueue('audit-queue', EXCHANGES.person, '#');

  await ch.assertQueue('analytics-queue', { durable: true });
  await ch.bindQueue('analytics-queue', EXCHANGES.climate, '#');

  await ch.assertQueue('notification-queue', { durable: true });
  await ch.bindQueue('notification-queue', EXCHANGES.climate, 'weather.queried');

  return ch;
};

const connect = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
    channel = await setupChannel(connection);

    connection.on('close', () => {
      console.warn('RabbitMQ connection closed, reconnecting...');
      channel = null;
      reconnectTimer = setTimeout(connect, 5000);
    });

    connection.on('error', (err) => console.error('RabbitMQ error:', err.message));

    console.log('RabbitMQ connected');
  } catch (err) {
    console.error('RabbitMQ connect failed:', err.message);
    reconnectTimer = setTimeout(connect, 5000);
  }
};

const publish = async (exchange, routingKey, data) => {
  if (!channel) return;
  try {
    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify({ ...data, publishedAt: new Date().toISOString() })),
      { persistent: true, contentType: 'application/json' }
    );
    rabbitmqPublished.inc({ service: data.service || 'api-weather', routing_key: routingKey });
  } catch (err) {
    console.error('RabbitMQ publish error:', err.message);
  }
};

module.exports = { connect, publish, EXCHANGES };
