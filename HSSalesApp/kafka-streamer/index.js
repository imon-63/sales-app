'use strict';
/**
 * HS Sales — DB Streamer
 *
 * Polls db.json every POLL_INTERVAL_MS milliseconds.
 * When the file changes (detected by SHA-256 hash), publishes a snapshot
 * event to the Kafka topic `hs-sales-db-changes`.
 *
 * A second consumer group reads from that same topic and appends each
 * event as a JSON-Lines record to SINK_FILE — giving you a durable,
 * time-ordered change log that survives consumer restarts.
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Kafka, logLevel } = require('kafkajs');

// ── Config ────────────────────────────────────────────────────────────────────
const BROKERS        = (process.env.KAFKA_BROKERS      || 'localhost:9092').split(',');
const DB_FILE        = process.env.DB_FILE             || path.join(__dirname, '../backend-json-server/db.json');
const SINK_FILE      = process.env.SINK_FILE           || path.join(__dirname, '../data/db-changes.jsonl');
const POLL_MS        = Number(process.env.POLL_INTERVAL_MS) || 500;
const TOPIC          = 'hs-sales-db-changes';
const ORDERS_TOPIC   = 'hs-sales-orders';

// ── Kafka clients ─────────────────────────────────────────────────────────────
const kafka = new Kafka({
  clientId: 'hs-sales-db-streamer',
  brokers: BROKERS,
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 500, retries: 10 },
});

const producer = kafka.producer({ allowAutoTopicCreation: true });
const consumer = kafka.consumer({ groupId: 'hs-sales-db-sink' });

// ── Helpers ───────────────────────────────────────────────────────────────────
function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureSinkDir() {
  fs.mkdirSync(path.dirname(SINK_FILE), { recursive: true });
}

function diffCollections(prev, next) {
  if (!prev || !next) return [];
  const changes = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const col of allKeys) {
    const prevArr = Array.isArray(prev[col]) ? prev[col] : [];
    const nextArr = Array.isArray(next[col]) ? next[col] : [];
    if (JSON.stringify(prevArr) === JSON.stringify(nextArr)) continue;
    const prevIds = new Set(prevArr.map(r => r.id));
    const nextIds = new Set(nextArr.map(r => r.id));
    for (const r of nextArr) {
      if (!prevIds.has(r.id)) { changes.push({ collection: col, op: 'insert', record: r }); continue; }
      const old = prevArr.find(o => o.id === r.id);
      if (JSON.stringify(old) !== JSON.stringify(r)) changes.push({ collection: col, op: 'update', before: old, after: r });
    }
    for (const r of prevArr) {
      if (!nextIds.has(r.id)) changes.push({ collection: col, op: 'delete', record: r });
    }
  }
  return changes;
}

// ── Producer: poll db.json and publish on change ─────────────────────────────
async function startPublisher() {
  await producer.connect();
  console.log('[Streamer] Producer connected. Watching:', DB_FILE);

  let lastHash = null;
  let lastParsed = null;

  setInterval(async () => {
    let content;
    try { content = fs.readFileSync(DB_FILE, 'utf8'); }
    catch { return; } // file not readable yet — skip

    const hash = sha256(content);
    if (hash === lastHash) return;

    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return; } // malformed JSON during write — skip

    const changes = diffCollections(lastParsed, parsed);
    const event = {
      timestamp: new Date().toISOString(),
      hash,
      changes,       // array of { collection, op, record/before/after }
      snapshot: parsed,
    };

    try {
      await producer.send({
        topic: TOPIC,
        messages: [{ key: hash, value: JSON.stringify(event) }],
      });
      const summary = changes.length
        ? changes.map(c => `${c.op}:${c.collection}`).join(', ')
        : 'no-diff (hash changed)';
      console.log(`[Streamer] Published — ${summary}`);
    } catch (err) {
      console.error('[Streamer] Publish error:', err.message);
    }

    lastHash   = hash;
    lastParsed = parsed;
  }, POLL_MS);
}

// ── Consumer: read from topic and append to sink file ────────────────────────
async function startSink() {
  ensureSinkDir();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  console.log(`[Sink] Consuming ${TOPIC} → ${SINK_FILE}`);

  await consumer.run({
    eachMessage: async ({ message, partition, heartbeat }) => {
      await heartbeat();
      const line = message.value.toString();
      try {
        fs.appendFileSync(SINK_FILE, line + '\n');
      } catch (err) {
        console.error('[Sink] Write error:', err.message);
      }
    },
  });
}

// ── Log all order events to console (optional monitoring) ─────────────────────
const orderConsumer = kafka.consumer({ groupId: 'hs-sales-order-monitor' });
async function startOrderMonitor() {
  await orderConsumer.connect();
  await orderConsumer.subscribe({ topic: ORDERS_TOPIC, fromBeginning: false });
  await orderConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        console.log(`[Order Event] ${evt.event} | order=${evt.orderNumber || evt.orderId} | ${evt._publishedAt}`);
      } catch {}
    },
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log('[Streamer] Shutting down…');
  await producer.disconnect();
  await consumer.disconnect();
  await orderConsumer.disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await startPublisher();
    await startSink();
    await startOrderMonitor();
    console.log('[Streamer] All components running.');
  } catch (err) {
    console.error('[Streamer] Fatal startup error:', err);
    process.exit(1);
  }
})();
