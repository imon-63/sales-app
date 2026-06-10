'use strict';
/**
 * Fire-and-forget Kafka producer.
 * If Kafka is unavailable, all publish calls are silently dropped — the API
 * continues working without disruption.
 */
const { Kafka, logLevel } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const kafka = new Kafka({
  clientId: 'hs-sales-backend',
  brokers: BROKERS,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 3,
    factor: 1.5,
  },
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
});

let connected = false;

async function connect() {
  try {
    await producer.connect();
    connected = true;
    console.log('[Kafka] Producer connected to', BROKERS.join(', '));
  } catch (err) {
    console.warn('[Kafka] Producer could not connect (non-fatal) —', err.message);
    console.warn('[Kafka] The API will work normally; events will not be published.');
  }
}

/**
 * Publish an event to a Kafka topic.
 * Always fire-and-forget — never throws, never blocks the caller.
 */
function publish(topic, key, payload) {
  if (!connected) return;
  const message = {
    key: String(key),
    value: JSON.stringify({ ...payload, _publishedAt: new Date().toISOString() }),
  };
  producer.send({ topic, messages: [message] }).catch(err => {
    console.warn(`[Kafka] Publish to ${topic} failed (non-fatal):`, err.message);
  });
}

async function disconnect() {
  if (connected) {
    await producer.disconnect();
    connected = false;
  }
}

module.exports = { connect, publish, disconnect };
