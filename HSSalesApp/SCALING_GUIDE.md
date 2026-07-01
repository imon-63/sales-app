# Scaling HSSalesApp to 1 Million RPS

## Current Stack Reality Check

Your stack today caps out at roughly **50–200 RPS** before falling over:

| Problem | Cause |
|---------|-------|
| `lowdb` reads/writes the entire `db.json` on every mutation | Disk I/O bottleneck |
| Single Node.js process | One CPU core, one event loop |
| No connection pooling, no caching, no replication | Every request hits the file |
| GraphQL N+1 queries | Lots → batches → allocations fetched in loops |

**1M RPS is ~5000× more load. This requires a full architecture rebuild, not tuning.**

---

## Migration Roadmap (Do This In Order)

```
Stage 1 (Week 1–2)  →  PostgreSQL replaces db.json
Stage 2 (Week 3)    →  Redis caching layer
Stage 3 (Week 4)    →  Fastify + PgBouncer replaces json-server
Stage 4 (Month 2)   →  Docker + PM2 cluster + NGINX
Stage 5 (Month 3)   →  Kafka consumers for all side-effects
Stage 6 (Month 4+)  →  Kubernetes + microservices (only when needed)
```

> **Rule:** Do not move to the next stage until the current one is stable and measured.

---

## Stage 1 — Replace the Database (Biggest ROI)

`db.json` is the single largest bottleneck. Everything else depends on fixing this first.

### 1.1 PostgreSQL as Primary DB

All your current collections map directly to Postgres tables:

```sql
-- Core catalog
CREATE TABLE users       (id UUID PRIMARY KEY, email TEXT, name TEXT, phone TEXT, role TEXT, password TEXT);
CREATE TABLE products    (id UUID PRIMARY KEY, name TEXT, unit_id UUID, unit TEXT);
CREATE TABLE warehouses  (id UUID PRIMARY KEY, name TEXT);
CREATE TABLE currencies  (id UUID PRIMARY KEY, code TEXT);
CREATE TABLE units       (id UUID PRIMARY KEY, label TEXT, global_factor NUMERIC, is_whole_number BOOLEAN);

-- Inventory / Lot system
CREATE TABLE lots (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  lot_number TEXT
);
CREATE TABLE lot_batches (
  id UUID PRIMARY KEY,
  lot_id UUID REFERENCES lots(id),
  warehouse_id UUID REFERENCES warehouses(id),
  acquired_at DATE,
  unit_cost NUMERIC,
  base_unit_cost NUMERIC,
  original_quantity NUMERIC,
  remaining_quantity NUMERIC,
  notes TEXT
);
CREATE TABLE lot_purchase_logs (
  id UUID PRIMARY KEY,
  lot_id UUID REFERENCES lots(id),
  acquired_at DATE,
  quantity NUMERIC,
  base_unit_cost NUMERIC,
  effective_unit_cost NUMERIC,
  extra_cost NUMERIC,
  notes TEXT
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY,
  sale_date DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  created_by UUID REFERENCES users(id),
  order_id UUID,
  status TEXT,
  cancelled_at DATE,
  cancel_reason TEXT,
  paid_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'due',
  extra_cost NUMERIC,
  notes TEXT
);
CREATE TABLE sales_items (
  id UUID PRIMARY KEY,
  sale_id UUID REFERENCES sales(id),
  product_id UUID REFERENCES products(id),
  quantity NUMERIC,
  unit_price NUMERIC,
  currency_id UUID REFERENCES currencies(id),
  unit_id UUID REFERENCES units(id),
  lot_ids JSONB,
  bottle_breakdown JSONB,
  lot_allocations JSONB,
  batch_allocations JSONB
);
CREATE TABLE sales_item_allocations (
  id UUID PRIMARY KEY,
  sales_item_id UUID REFERENCES sales_items(id),
  lot_batch_id UUID REFERENCES lot_batches(id),
  quantity_allocated NUMERIC,
  unit_cost_at_time NUMERIC
);
CREATE TABLE sale_payments (
  id UUID PRIMARY KEY,
  sale_id UUID REFERENCES sales(id),
  amount NUMERIC,
  collected_by UUID REFERENCES users(id),
  collected_by_name TEXT,
  paid_at DATE,
  notes TEXT
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number TEXT UNIQUE,
  status TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  order_date DATE,
  expected_delivery DATE,
  delivered_date DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  advance_paid NUMERIC DEFAULT 0,
  created_by UUID REFERENCES users(id),
  cancel_reason TEXT,
  stock_reserved BOOLEAN DEFAULT FALSE,
  confirmed_date DATE,
  processing_date DATE,
  out_for_delivery_date DATE,
  notes TEXT
);
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity NUMERIC,
  unit_price NUMERIC,
  currency_id UUID REFERENCES currencies(id),
  lot_ids JSONB,
  lot_allocations JSONB,
  batch_allocations JSONB
);
CREATE TABLE order_payments (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  amount NUMERIC,
  notes TEXT,
  paid_at DATE,
  recorded_by UUID REFERENCES users(id),
  order_step TEXT,
  type TEXT DEFAULT 'payment'
);
```

### 1.2 Critical Indexes

Add these immediately — they cover your most common query patterns:

```sql
-- Sales lookups
CREATE INDEX idx_sales_warehouse_date    ON sales(warehouse_id, sale_date DESC);
CREATE INDEX idx_sales_order             ON sales(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_sales_created_by        ON sales(created_by);
CREATE INDEX idx_sales_status            ON sales(status);

-- Inventory hot path
CREATE INDEX idx_lot_batches_lot         ON lot_batches(lot_id);
CREATE INDEX idx_lot_batches_warehouse   ON lot_batches(warehouse_id);
CREATE INDEX idx_lot_batches_remaining   ON lot_batches(remaining_quantity) WHERE remaining_quantity > 0;

-- Allocation lookups
CREATE INDEX idx_allocations_item        ON sales_item_allocations(sales_item_id);
CREATE INDEX idx_allocations_batch       ON sales_item_allocations(lot_batch_id);

-- Order lookups
CREATE INDEX idx_orders_status           ON orders(status);
CREATE INDEX idx_orders_created_by       ON orders(created_by);
CREATE INDEX idx_order_payments_order    ON order_payments(order_id, type);
CREATE INDEX idx_sale_payments_sale      ON sale_payments(sale_id);
```

### 1.3 Read Replicas

```
Write traffic  →  Primary Postgres (all INSERTs, UPDATEs, DELETEs)
Read traffic   →  3 Read Replicas (async streaming replication)
                  Route: sales queries, inventory stock, reports
```

In your Node.js services:
```js
const writePool = new Pool({ host: 'postgres-primary', ... });
const readPool  = new Pool({ host: 'postgres-replica-1', ... }); // round-robin

// Mutations → writePool
// Queries   → readPool
```

### 1.4 Connection Pooling with PgBouncer

Postgres handles ~500 direct connections max. Your app will have thousands of concurrent requests.

```
App pods (thousands of connections) → PgBouncer → Postgres (50-100 connections)
```

PgBouncer config (`pgbouncer.ini`):
```ini
[databases]
hssales = host=postgres-primary dbname=hssales

[pgbouncer]
pool_mode = transaction        ; transaction-level pooling — best for web apps
max_client_conn = 10000        ; app-facing
default_pool_size = 50         ; postgres-facing
min_pool_size = 10
reserve_pool_size = 5
```

---

## Stage 2 — Redis Caching Layer

After Postgres is in place, add Redis in front of all read-heavy data.

### 2.1 What to Cache and How Long

| Data | Cache Key Pattern | TTL | Invalidate On |
|------|------------------|-----|---------------|
| Products list | `catalog:products` | 5 min | product create/update/delete |
| Warehouses | `catalog:warehouses` | 10 min | warehouse update |
| Currencies / Units | `catalog:currencies` | 30 min | currency update |
| Inventory stock rows | `inventory:stock` | 30 sec | any lot_batch update |
| Single sale | `sale:{id}` | 2 min | sale update |
| Sale payments for sale | `sale:payments:{saleId}` | 1 min | payment added |
| Orders list (by user) | `orders:user:{userId}` | 30 sec | order update |

### 2.2 Cache Pattern in Node.js

```js
async function getProducts(redisClient, db) {
  const cached = await redisClient.get('catalog:products');
  if (cached) return JSON.parse(cached);

  const rows = await db.query('SELECT * FROM products ORDER BY name');
  await redisClient.setEx('catalog:products', 300, JSON.stringify(rows));
  return rows;
}

// On mutation, invalidate:
async function createProduct(db, redisClient, input) {
  const result = await db.query('INSERT INTO products ...', [input]);
  await redisClient.del('catalog:products');
  return result;
}
```

### 2.3 Inventory Remaining Quantity — Redis Atomic Counters

The `remainingQuantity` field on `lot_batches` is updated on every sale. At high RPS this causes write contention on Postgres. Use Redis atomic counters:

```js
// On app startup, seed Redis from Postgres
const batches = await db.query('SELECT id, remaining_quantity FROM lot_batches');
for (const b of batches) {
  await redis.set(`batch:${b.id}:remaining`, b.remaining_quantity);
}

// On sale creation — atomic decrement (no race conditions)
await redis.decrBy(`batch:${b.id}:remaining`, takeQty);

// Sync back to Postgres asynchronously via Kafka consumer (every few seconds)
// If Redis goes down → fall back to Postgres directly
```

### 2.4 Redis Cluster for High Availability

```
                ┌─── Master shard 1 ─── Replica
Redis Cluster ──┼─── Master shard 2 ─── Replica
                └─── Master shard 3 ─── Replica
```

Use `ioredis` in your Node.js code with cluster mode:
```js
import { Cluster } from 'ioredis';
const redis = new Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
]);
```

**Target: >90% of reads served from Redis, never touching Postgres.**

---

## Stage 3 — Replace json-server with Fastify + DataLoader

### 3.1 Switch from json-server to Fastify

Fastify is 2× faster than Express for GraphQL. Install:
```
npm install fastify @mercuriusjs/mercurius graphql
```

Basic setup:
```js
import Fastify from 'fastify';
import mercurius from 'mercurius';
import { schema } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';

const app = Fastify({ logger: true });

app.register(mercurius, {
  schema,
  resolvers,
  graphiql: true,
  cache: true,          // persisted query cache
  jit: 1,              // JIT compile after 1st execution — huge speedup
});

await app.listen({ port: 4000, host: '0.0.0.0' });
```

### 3.2 Add DataLoader to Fix N+1 Queries

Without DataLoader, fetching 100 sales triggers 100 separate product queries. DataLoader batches them into 1.

```js
import DataLoader from 'dataloader';

// Create per-request loaders (new instance per GraphQL request)
function createLoaders(db) {
  return {
    product: new DataLoader(async (ids) => {
      const rows = await db.query(
        'SELECT * FROM products WHERE id = ANY($1)', [ids]
      );
      return ids.map(id => rows.find(r => r.id === id));
    }),

    lotBatch: new DataLoader(async (ids) => {
      const rows = await db.query(
        'SELECT * FROM lot_batches WHERE id = ANY($1)', [ids]
      );
      return ids.map(id => rows.find(r => r.id === id));
    }),

    salePayments: new DataLoader(async (saleIds) => {
      const rows = await db.query(
        'SELECT * FROM sale_payments WHERE sale_id = ANY($1)', [saleIds]
      );
      return saleIds.map(sid => rows.filter(r => r.sale_id === sid));
    }),
  };
}

// In resolvers, use loader instead of direct DB call:
const resolvers = {
  SalesItem: {
    product: (item, _, ctx) => ctx.loaders.product.load(item.product_id),
  },
  Sale: {
    payments: (sale, _, ctx) => ctx.loaders.salePayments.load(sale.id),
  },
};
```

### 3.3 Persisted Queries

Instead of sending the full GraphQL query string on every request (expensive to parse), the client sends a hash:

```
// First request
POST /graphql  { query: "{ sales { id saleDate ... } }", extensions: { persistedQuery: { sha256Hash: "abc123" } } }

// Subsequent requests (99% of traffic)
POST /graphql  { extensions: { persistedQuery: { sha256Hash: "abc123" } } }
// Server looks up query by hash — no parsing overhead
```

---

## Stage 4 — Docker + PM2 Cluster + NGINX

### 4.1 Dockerize Your Backend

`backend-json-server/Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

### 4.2 PM2 Cluster Mode (Multiple CPU Cores)

`ecosystem.config.js`:
```js
module.exports = {
  apps: [{
    name: 'hssales-api',
    script: 'server.js',
    instances: 'max',      // one worker per CPU core
    exec_mode: 'cluster',  // share port across workers
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
    }
  }]
};
```

Start: `pm2 start ecosystem.config.js`

A server with 8 cores → 8 Node.js workers → 8× the throughput.

### 4.3 NGINX as Load Balancer and Reverse Proxy

`nginx.conf`:
```nginx
upstream hssales_api {
  least_conn;                          # route to least-busy pod
  server api-pod-1:4000;
  server api-pod-2:4000;
  server api-pod-3:4000;
  keepalive 64;                        # persistent connections to backend
}

server {
  listen 443 ssl http2;
  server_name api.hssales.com;

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api:10m rate=1000r/s;
  limit_req zone=api burst=2000 nodelay;

  location /graphql {
    proxy_pass http://hssales_api;
    proxy_http_version 1.1;
    proxy_set_header Connection "";    # enable keepalive
    proxy_connect_timeout 5s;
    proxy_read_timeout 30s;
  }

  # Cache GET requests (persisted queries)
  location ~* \.(js|css|png|jpg)$ {
    proxy_cache_valid 200 1d;
    add_header X-Cache-Status $upstream_cache_status;
  }
}
```

---

## Stage 5 — Kafka for All Side-Effects

You already have Kafka. Extend it to take all non-critical work off the API's critical path.

### 5.1 Current vs Target Flow

**Current (everything synchronous):**
```
createSale request arrives
  → validate stock (50ms)
  → deduct inventory (30ms)
  → persist sale (20ms)
  → persist allocations (40ms)
  → send notification (20ms)
  → sync order payment (30ms)
  → check lot depleted (20ms)
  → respond to client   ← 210ms total
```

**Target (only critical path is synchronous):**
```
createSale request arrives
  → validate stock in Redis (2ms)
  → persist sale to Postgres (10ms)
  → publish events to Kafka (1ms)
  → respond to client   ← 13ms total

Kafka consumers (async, parallel):
  hs-inventory-consumer   → decrement lot_batches.remaining_quantity
  hs-notification-consumer → push notification to users
  hs-payment-consumer     → sync order ↔ sale payments
  hs-depletion-consumer   → check if lot is depleted, notify
```

### 5.2 Kafka Topic Design

```
Topic: hs-sales-events
  Partitions: 30          (parallelism)
  Replication factor: 3   (fault tolerance)
  Retention: 7 days

Events published:
  { type: 'sale.created',   saleId, warehouseId, items, userId }
  { type: 'sale.cancelled', saleId, items }
  { type: 'order.delivered', orderId, saleId }
  { type: 'payment.added',   saleId, orderId, amount }
  { type: 'batch.depleted',  lotBatchId, lotId }

Topic: hs-orders-events
  Partitions: 10

Topic: hs-inventory-events
  Partitions: 20
```

### 5.3 Consumer Group Setup

```js
// inventory-consumer.js
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: ['kafka-1:9092', 'kafka-2:9092'] });
const consumer = kafka.consumer({ groupId: 'inventory-consumer-group' });

await consumer.subscribe({ topic: 'hs-sales-events' });

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.type === 'sale.created') {
      for (const alloc of event.allocations) {
        await db.query(
          'UPDATE lot_batches SET remaining_quantity = remaining_quantity - $1 WHERE id = $2',
          [alloc.quantity, alloc.batchId]
        );
      }
    }
  }
});
```

Run 3 instances of `inventory-consumer.js` → they share the 30 partitions across themselves automatically.

---

## Stage 6 — Kubernetes + Microservices

Only needed when a single service saturates (~50K RPS). Do not build this prematurely.

### 6.1 Service Decomposition

Split along your existing domain boundaries:

```
┌────────────────────────────────────────────────────────────┐
│                 API Gateway (Kong / NGINX)                  │
│         Rate limiting · Auth (JWT) · Routing               │
└──────────┬──────────────┬─────────────┬───────────────────┘
           │              │             │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌───▼──────────────┐
    │ Sales       │ │ Orders     │ │ Inventory        │
    │ Service     │ │ Service    │ │ Service          │
    │             │ │            │ │                  │
    │ /sales      │ │ /orders    │ │ /lots            │
    │ /saleItems  │ │ /orderItems│ │ /lotBatches      │
    │ /salePaymts │ │ /orderPmts │ │ /transfers       │
    └──────┬──────┘ └─────┬──────┘ └───┬──────────────┘
           │              │             │
    ┌──────▼──────────────▼─────────────▼──────┐
    │           Postgres (sharded) + Redis       │
    └───────────────────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │      Kafka Cluster   │
               └─────────────────────┘
```

Each service:
- Owns its own tables
- Has its own Postgres connection pool
- Communicates with other services via Kafka events (not direct DB joins)
- Scales independently

### 6.2 Kubernetes Deployment Example

`k8s/sales-service.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sales-service
spec:
  replicas: 10
  selector:
    matchLabels:
      app: sales-service
  template:
    spec:
      containers:
      - name: sales-service
        image: hssales/sales-service:latest
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sales-service-hpa
spec:
  scaleTargetRef:
    name: sales-service
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        averageUtilization: 60   # scale up before saturation
```

### 6.3 Database Sharding

At 1M RPS, even Postgres primary + replicas may bottleneck on writes. Shard by a natural partition key:

```
Shard 0: warehouse_id ends in 0,1,2
Shard 1: warehouse_id ends in 3,4,5
Shard 2: warehouse_id ends in 6,7,8,9
```

Or use **CockroachDB** (distributed Postgres-compatible) which handles sharding automatically.

---

## Observability — You Can't Hit 1M Without This

Set these up before you scale. Scaling blind always ends in an outage.

### Tools Stack

| Tool | What It Monitors | Install |
|------|-----------------|---------|
| **Prometheus** | Metrics collection (RPS, latency, error rate) | `npm i prom-client` |
| **Grafana** | Dashboards on top of Prometheus | Docker container |
| **Jaeger** | Distributed tracing (which query is slow) | `npm i @opentelemetry/sdk-node` |
| **PgBadger** | Postgres slow query log analysis | CLI tool |
| **Kafka UI** | Consumer lag, partition offsets | Docker container |

### Key Metrics to Watch

```
# Application
api_request_duration_seconds{quantile="0.99"} < 0.1s    ← p99 under 100ms
api_requests_total{status="5xx"} / total < 0.001         ← error rate < 0.1%
api_requests_per_second > target                          ← current RPS

# Database
postgres_connections_active < max_connections * 0.8       ← pool not exhausted
postgres_query_duration_seconds{quantile="0.99"} < 0.05s  ← slow queries
postgres_replication_lag_seconds < 1                       ← replicas in sync

# Cache
redis_hit_rate > 0.90                                      ← >90% cache hits
redis_memory_used < redis_maxmemory * 0.85                ← not evicting

# Kafka
kafka_consumer_lag < 10000                                 ← consumers keeping up
kafka_messages_per_second                                  ← event throughput
```

### Alerts to Set Up (PagerDuty / Slack)

```yaml
- alert: HighErrorRate
  condition: error_rate > 1% for 2 minutes
  severity: critical

- alert: SlowAPI
  condition: p99_latency > 500ms for 5 minutes
  severity: warning

- alert: KafkaLagHigh
  condition: consumer_lag > 100000
  severity: warning

- alert: RedisLowHitRate
  condition: cache_hit_rate < 80% for 10 minutes
  severity: warning
```

---

## Realistic Capacity Numbers

| Stage | Architecture | Max RPS | Monthly Cost (est.) |
|-------|-------------|---------|-------------------|
| Now | json-server + db.json | ~100 | $0 |
| Stage 1 | Postgres + PgBouncer | ~5,000 | $150 |
| Stage 2 | + Redis Cluster | ~30,000 | $400 |
| Stage 3 | + Fastify + DataLoader | ~60,000 | $500 |
| Stage 4 | + PM2 cluster (3 servers) + NGINX | ~200,000 | $1,500 |
| Stage 5 | + Kafka consumers (all async) | ~500,000 | $4,000 |
| Stage 6 | + K8s (50 pods) + sharding | **~1,000,000** | $15,000+ |

---

## Quick Checklist Per Stage

### Stage 1 — PostgreSQL
- [ ] Schema created (all tables + indexes)
- [ ] Migration script from db.json written and run
- [ ] PgBouncer configured (transaction mode)
- [ ] Read replica set up and query routing implemented
- [ ] All `db.get(...).value()` calls replaced with `await pool.query(...)`

### Stage 2 — Redis
- [ ] Redis Cluster deployed (3 shards × 2 nodes)
- [ ] Catalog data cached (products, warehouses, currencies)
- [ ] `inventoryStock` query cached with 30s TTL
- [ ] Cache invalidation wired to mutations
- [ ] `remainingQuantity` moved to Redis atomic counters
- [ ] Cache hit rate dashboard showing >90%

### Stage 3 — Fastify + DataLoader
- [ ] json-server replaced with Fastify + Mercurius
- [ ] DataLoader added for all 1-to-N resolver relationships
- [ ] Persisted queries enabled
- [ ] JIT compilation enabled (`jit: 1`)
- [ ] p99 latency measured and < 50ms for cached paths

### Stage 4 — Docker + PM2 + NGINX
- [ ] Dockerfile written and image builds cleanly
- [ ] PM2 cluster mode configured (instances: 'max')
- [ ] NGINX configured with `upstream` block and keepalive
- [ ] Rate limiting configured on NGINX
- [ ] Health check endpoint `/health` returns 200

### Stage 5 — Kafka Consumers
- [ ] `createSale` only does: validate + persist + publish to Kafka
- [ ] inventory-consumer handles `remainingQuantity` decrement
- [ ] notification-consumer handles all notifications
- [ ] payment-consumer handles order↔sale sync
- [ ] Consumer lag monitored and < 10K messages
- [ ] API response time for `createSale` < 20ms

### Stage 6 — Kubernetes + Microservices
- [ ] Services split by domain (sales, orders, inventory)
- [ ] Each service has its own DB connection pool
- [ ] HPA configured (scale on CPU > 60%)
- [ ] Cross-service communication via Kafka events only
- [ ] Load tested to 1M RPS with k6 or Gatling

---

## Load Testing Commands

Before declaring any stage "done", run a load test.

Install **k6**: https://k6.io

```js
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },    // ramp up to 1K RPS
    { duration: '5m', target: 10000 },   // ramp to 10K RPS
    { duration: '10m', target: 100000 }, // sustain 100K RPS
    { duration: '2m', target: 0 },       // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<100'],    // 99% of requests under 100ms
    http_req_failed: ['rate<0.001'],     // error rate under 0.1%
  },
};

export default function () {
  const res = http.post(
    'http://localhost:4000/graphql',
    JSON.stringify({ query: '{ sales { id saleDate totalAmount paymentStatus } }' }),
    { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer <token>' } }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.001);
}
```

Run: `k6 run load-test.js`

---

*Generated for HSSalesApp — follow stages in order, measure before moving to the next.*
