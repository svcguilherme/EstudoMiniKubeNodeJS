'use strict';

const amqp = require('amqplib');
const { rabbitmqPublished } = require('../middleware/metrics');

let channel = null;
let connection = null;

const EXCHANGES = {
  climate:  'climate-events',
  location: 'location-events',
  person:   'person-events',
};

const connect = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
    channel    = await connection.createChannel();

    await channel.assertExchange(EXCHANGES.location, 'topic', { durable: true });
    await channel.assertQueue('audit-queue',    { durable: true });
    await channel.bindQueue('audit-queue', EXCHANGES.location, '#');

    connection.on('close', () => { channel = null; setTimeout(connect, 5000); });
    connection.on('error', (err) => console.error('RabbitMQ error:', err.message));
    console.log('RabbitMQ connected');
  } catch (err) {
    console.error('RabbitMQ connect failed:', err.message);
    setTimeout(connect, 5000);
  }
};

const publish = async (exchange, routingKey, data) => {
  if (!channel) return;
  try {
    channel.publish(exchange, routingKey,
      Buffer.from(JSON.stringify({ ...data, publishedAt: new Date().toISOString() })),
      { persistent: true, contentType: 'application/json' }
    );
    rabbitmqPublished.inc({ service: data.service || 'api-location', routing_key: routingKey });
  } catch (err) { console.error('RabbitMQ publish error:', err.message); }
};

module.exports = { connect, publish, EXCHANGES };
