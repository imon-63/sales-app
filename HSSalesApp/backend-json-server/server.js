const path = require('path');
const crypto = require('crypto');
const { createServer } = require('http');
const { EventEmitter } = require('events');

const cors = require('cors');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { createHandler } = require('graphql-http/lib/use/express');
const { useServer } = require('graphql-ws/lib/use/ws');
const jsonServer = require('json-server');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();
const notificationEvents = new EventEmitter();
const NOTIFICATION_CREATED_TOPIC = 'NOTIFICATION_CREATED';

server.use(cors({ origin: '*' }));
server.use(middlewares);

function parseBearerUserIdFromHeader(authorization) {
  const authz = String(authorization || '');
  const match = authz.match(/^Bearer\s+demo-token-(.+)$/i);
  return match?.[1] ?? null;
}

function getUsers() {
  return router.db.get('users').value() ?? [];
}

function findUserByEmail(email) {
  const em = String(email).trim().toLowerCase();
  return getUsers().find((u) => String(u.email).toLowerCase() === em);
}

function findUserById(id) {
  return getUsers().find((u) => u.id === id);
}

function parseBearerUserId(req) {
  return parseBearerUserIdFromHeader(req?.headers?.authorization);
}

function ensureNotificationsArray() {
  const n = router.db.get('notifications').value();
  if (!Array.isArray(n)) {
    router.db.set('notifications', []).write();
  }
}

function ensureCollection(name, fallback) {
  const cur = router.db.get(name).value();
  if (!Array.isArray(cur)) {
    router.db.set(name, fallback).write();
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

function withUnreadForUser(notification, userId) {
  return {
    ...notification,
    unread: userId ? !(notification.readByUserIds || []).includes(userId) : false,
  };
}

function createTopicAsyncIterator(eventName) {
  const pullQueue = [];
  const pushQueue = [];
  let listening = true;

  const pushValue = (value) => {
    if (pullQueue.length > 0) {
      const resolve = pullQueue.shift();
      resolve({ value, done: false });
      return;
    }
    pushQueue.push(value);
  };

  const eventHandler = (value) => {
    if (listening) pushValue(value);
  };

  notificationEvents.on(eventName, eventHandler);

  return {
    next() {
      if (!listening) return Promise.resolve({ value: undefined, done: true });
      if (pushQueue.length > 0) {
        const value = pushQueue.shift();
        return Promise.resolve({ value, done: false });
      }
      return new Promise((resolve) => {
        pullQueue.push(resolve);
      });
    },
    return() {
      listening = false;
      notificationEvents.off(eventName, eventHandler);
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      listening = false;
      notificationEvents.off(eventName, eventHandler);
      return Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

function persistNotification(notification) {
  ensureNotificationsArray();
  router.db.get('notifications').push(notification).write();
  notificationEvents.emit(NOTIFICATION_CREATED_TOPIC, notification);
  return notification;
}

function getConversionFactor(productId, unitId) {
  const units = router.db.get('units').value() ?? [];
  const products = router.db.get('products').value() ?? [];
  const unit = units.find((u) => u.id === unitId);
  const product = products.find((p) => p.id === productId);
  if (!unit) return 1;
  if (typeof unit.globalFactor === 'number') return unit.globalFactor;
  if (product && product.conversions && typeof product.conversions[unitId] === 'number') {
    return product.conversions[unitId];
  }
  return 1;
}

function requireAuth(ctx) {
  const userId = parseBearerUserId(ctx?.req || {});
  if (!userId) throw new Error('Unauthorized');
  const actor = findUserById(userId);
  if (!actor) throw new Error('Forbidden');
  return { userId, actor };
}

function getInventoryStockRows() {
  const lotBatches = router.db.get('lotBatches').value() ?? [];
  const lots = router.db.get('lots').value() ?? [];
  const products = router.db.get('products').value() ?? [];
  const warehouses = router.db.get('warehouses').value() ?? [];
  const units = router.db.get('units').value() ?? [];

  const rows = [];
  for (const b of lotBatches) {
    const rem = Number(b.remainingQuantity);
    if (!Number.isFinite(rem) || rem <= 0) continue;
    const lot = lots.find((l) => l.id === b.lotId);
    if (!lot) continue;
    const productId = lot.productId;
    const warehouseId = b.warehouseId;
    const p = products.find((x) => x.id === productId);
    const w = warehouses.find((x) => x.id === warehouseId);
    const unitLabel =
      (p?.unitId && units.find((u) => u.id === p.unitId)?.label) || p?.unit || '';
    rows.push({
      id: b.id,
      batchLotId: b.lotId,
      lotId: b.lotId,
      lotNumber: lot.lotNumber,
      productId,
      productName: p?.name ?? 'Product',
      unit: unitLabel,
      warehouseId,
      warehouseName: w?.name ?? 'Warehouse',
      quantityOnHand: rem,
      unitCost: Number(b.unitCost) || 0,
      acquiredAt: b.acquiredAt,
    });
  }
  rows.sort((a, b) => {
    const w = String(a.warehouseName).localeCompare(String(b.warehouseName));
    if (w !== 0) return w;
    const p = String(a.productName).localeCompare(String(b.productName));
    if (p !== 0) return p;
    return String(a.lotNumber).localeCompare(String(b.lotNumber));
  });
  return rows;
}

function listAdminNotifications(userId) {
  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') throw new Error('Admins only');
  ensureNotificationsArray();
  const all = router.db.get('notifications').value() ?? [];
  return all
    .map((n) => ({ ...n, unread: !(n.readByUserIds || []).includes(userId) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createPurchase({ actor, userId, input }) {
  if (actor.role !== 'admin') throw new Error('Only admins can record purchases');
  const { warehouseId, purchaseDate, notes, items } = input || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) {
    throw new Error('Missing warehouseId or items');
  }
  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === warehouseId)) {
    throw new Error('Unknown warehouse');
  }
  const products = router.db.get('products').value() ?? [];
  const dateStr =
    typeof purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
      ? purchaseDate
      : new Date().toISOString().slice(0, 10);
  const createdLines = [];
  for (const it of items) {
    if (!it || !it.productId) continue;
    const qty = Number(it.quantity);
    const uc = Number(it.unitCost);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(uc) || uc < 0) continue;
    if (!products.some((p) => p.id === it.productId)) continue;
    createdLines.push({ 
      productId: it.productId, 
      quantity: qty, 
      unitCost: uc, 
      lotNumber: it.lotNumber ? String(it.lotNumber).trim() : null,
      unitId: it.unitId,
    });
  }
  if (createdLines.length === 0) {
    throw new Error('No valid line items');
  }
  const purchaseId = crypto.randomUUID();
  router.db
    .get('purchases')
    .push({
      id: purchaseId,
      purchaseDate: dateStr,
      warehouseId,
      createdBy: userId,
      notes: notes != null ? String(notes) : '',
    })
    .write();

  for (const cl of createdLines) {
    const lotId = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const purchaseItemId = crypto.randomUUID();
    const lotNumber = cl.lotNumber || `RCV-${dateStr}-${String(cl.productId).slice(-6)}-${String(batchId).slice(0, 4)}`;
    router.db
      .get('lots')
      .push({
        id: lotId,
        productId: cl.productId,
        lotNumber,
      })
      .write();
    router.db
      .get('purchaseItems')
      .push({
        id: purchaseItemId,
        purchaseId,
        productId: cl.productId,
        lotId,
        quantity: cl.quantity,
        unitCost: cl.unitCost,
      })
      .write();
    const cFactor = getConversionFactor(cl.productId, cl.unitId);
    router.db
      .get('lotBatches')
      .push({
        id: batchId,
        lotId,
        warehouseId,
        acquiredAt: dateStr,
        unitCost: cl.unitCost,
        originalQuantity: cl.quantity * cFactor,
        remainingQuantity: cl.quantity * cFactor,
      })
      .write();
  }
  return { ok: true, purchaseId };
}

function createInventoryTransfer({ actor, userId, input }) {
  if (actor.role !== 'admin') throw new Error('Only admins can transfer stock');
  const { fromWarehouseId, toWarehouseId, transferDate, notes, lines } = input || {};
  if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) {
    throw new Error('Invalid warehouses');
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Missing lines');
  }
  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === fromWarehouseId)) {
    throw new Error('Unknown from warehouse');
  }
  if (!warehouses.some((w) => w.id === toWarehouseId)) {
    throw new Error('Unknown to warehouse');
  }
  const products = router.db.get('products').value() ?? [];
  const dateStr =
    typeof transferDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(transferDate)
      ? transferDate
      : new Date().toISOString().slice(0, 10);
  const normalizedLines = [];
  for (const line of lines) {
    if (!line || !line.productId) continue;
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!products.some((p) => p.id === line.productId)) continue;
    normalizedLines.push({ productId: line.productId, quantity: qty });
  }
  if (normalizedLines.length === 0) {
    throw new Error('No valid lines');
  }
  ensureCollection('inventoryTransfers', []);
  ensureCollection('inventoryTransferLines', []);
  const transferId = crypto.randomUUID();
  router.db
    .get('inventoryTransfers')
    .push({
      id: transferId,
      transferDate: dateStr,
      fromWarehouseId,
      toWarehouseId,
      createdBy: userId,
      notes: notes != null ? String(notes) : '',
    })
    .write();

  for (const nl of normalizedLines) {
    const freshBatches = router.db.get('lotBatches').value() ?? [];
    const freshLots = router.db.get('lots').value() ?? [];
    const candidates = freshBatches
      .filter((b) => b.warehouseId === fromWarehouseId && Number(b.remainingQuantity) > 0)
      .map((b) => {
        const lot = freshLots.find((l) => l.id === b.lotId);
        return { b, lot };
      })
      .filter((x) => x.lot && x.lot.productId === nl.productId)
      .sort((a, b) => String(a.b.acquiredAt).localeCompare(String(b.b.acquiredAt)));

    let remaining = nl.quantity;
    const moves = [];
    for (const { b } of candidates) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingQuantity);
      if (rem <= 0) continue;
      const take = Math.min(remaining, rem);
      moves.push({ batchId: b.id, take, unitCost: Number(b.unitCost) });
      remaining -= take;
    }
    if (remaining > 0) {
      const pname = products.find((p) => p.id === nl.productId)?.name ?? nl.productId;
      throw new Error(`Insufficient stock for ${pname}`);
    }
    for (const m of moves) {
      const row = router.db.get('lotBatches').find({ id: m.batchId }).value();
      if (!row) continue;
      const nextRemaining = Number(row.remainingQuantity) - m.take;
      router.db.get('lotBatches').find({ id: m.batchId }).assign({ remainingQuantity: nextRemaining }).write();
      const sourceLotId = row.lotId;
      const newBatchId = crypto.randomUUID();
      router.db
        .get('lotBatches')
        .push({
          id: newBatchId,
          lotId: sourceLotId,
          warehouseId: toWarehouseId,
          acquiredAt: dateStr,
          unitCost: m.unitCost,
          originalQuantity: m.take,
          remainingQuantity: m.take,
        })
        .write();

      router.db
        .get('inventoryTransferLines')
        .push({
          id: crypto.randomUUID(),
          transferId,
          productId: nl.productId,
          lotId: sourceLotId,
          quantity: m.take,
        })
        .write();
    }
  }


  const lotIdsMoved = new Set();
  const allTransferLines = router.db.get('inventoryTransferLines').value() ?? [];
  const linesForThisTransfer = allTransferLines.filter(l => l.transferId === transferId);
  for (const tl of linesForThisTransfer) {
     if (tl.lotId) lotIdsMoved.add(tl.lotId);
  }

  for (const lid of lotIdsMoved) {
    const totalRemaining = router.db.get('lotBatches').value()
      .filter(b => b.lotId === lid)
      .reduce((s, b) => s + Number(b.remainingQuantity), 0);
    
    if (totalRemaining === 0) {
      const existing = router.db.get('notifications').find({ type: 'lot_depleted', lotId: lid }).value();
      if (!existing) {
        const lot = router.db.get('lots').find({ id: lid }).value();
        const prod = router.db.get('products').find({ id: lot?.productId }).value();
        const lotNotif = {
          id: crypto.randomUUID(),
          type: 'lot_depleted',
          lotId: lid,
          title: 'Lot Fully Sold Out (via Transfer)',
          body: `Inventory Alert: Lot ${lot?.lotNumber} (${prod?.name || 'Product'}) has been moved and sold until depletion. No stock remains.`,
          createdAt: new Date().toISOString(),
          actorUserId: userId,
          readByUserIds: []
        };
        persistNotification(lotNotif);
      }
    }
  }
  return { ok: true, transferId };
}

function createUnit({ actor, label }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    throw new Error('Forbidden');
  }
  const trimmed = String(label ?? '').trim();
  if (!trimmed) {
    throw new Error('Label required');
  }
  ensureCollection('units', []);
  const row = { id: crypto.randomUUID(), label: trimmed };
  router.db.get('units').push(row).write();
  return row;
}

function createCurrency({ actor, code }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    throw new Error('Forbidden');
  }
  const raw = String(code ?? '').trim().toUpperCase();
  if (!raw || raw.length > 8) {
    throw new Error('Valid currency code required');
  }
  ensureCollection('currencies', []);
  const existing = router.db.get('currencies').value() ?? [];
  if (existing.some((c) => String(c.code).toUpperCase() === raw)) {
    throw new Error('Currency already exists');
  }
  const row = { id: crypto.randomUUID(), code: raw };
  router.db.get('currencies').push(row).write();
  return row;
}

function createSalesUser({ actor, input }) {
  if (!actor || actor.role !== 'admin') throw new Error('Only admins can add sales users');
  const { email, password, name, phone } = input || {};
  if (!email || !password) throw new Error('Missing email/password');
  const em = String(email).trim().toLowerCase();
  if (!em.includes('@')) throw new Error('Invalid email');
  if (String(password).length < 6) throw new Error('Password must be at least 6 characters');
  if (findUserByEmail(em)) throw new Error('Email already registered');
  const newUser = {
    id: crypto.randomUUID(),
    email: em,
    password: String(password),
    role: 'sales',
    name: name ? String(name).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
  };
  router.db.get('users').push(newUser).write();
  return { user: publicUser(newUser) };
}

function createSale({ actor, userId, input }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    throw new Error('Forbidden');
  }
  const { warehouseId, notes, items, saleDate } = input || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) {
    throw new Error('Missing warehouseId or items');
  }
  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === warehouseId)) {
    throw new Error('Unknown warehouse');
  }
  const products = router.db.get('products').value() ?? [];
  const currencies = router.db.get('currencies').value() ?? [];
  const defaultCurrencyId = currencies[0]?.id;
  if (!defaultCurrencyId) throw new Error('No currencies configured');
  const saleId = crypto.randomUUID();
  const dateStr =
    typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)
      ? saleDate
      : new Date().toISOString().slice(0, 10);
  const createdItems = [];
  for (const it of items) {
    if (!it || !it.productId) continue;
    const qty = Number(it.quantity);
    const price = Number(it.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    const prod = products.find((p) => p.id === it.productId);
    if (!prod) continue;
    const currencyId =
      it.currencyId && currencies.some((c) => c.id === it.currencyId)
        ? it.currencyId
        : defaultCurrencyId;
    const lotIds = Array.isArray(it.lotIds)
      ? Array.from(
          new Set(
            it.lotIds
              .map((x) => String(x || '').trim())
              .filter(Boolean),
          ),
        )
      : [];
    createdItems.push({
      id: crypto.randomUUID(),
      saleId,
      productId: it.productId,
      quantity: qty,
      unitPrice: price,
      currencyId,
      unitId: it.unitId,
      lotIds,
    });
  }
  if (createdItems.length === 0) throw new Error('No valid line items');
  const allBatchesForAudit = router.db.get('lotBatches').value() ?? [];
  const allLotsForAudit = router.db.get('lots').value() ?? [];
  for (const line of createdItems) {
    const requestedBaseQty = line.quantity * getConversionFactor(line.productId, line.unitId);
    const lotFilterSet = line.lotIds?.length ? new Set(line.lotIds) : null;
    const availableBaseQty = allBatchesForAudit
      .filter((b) => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter((b) => {
        const lot = allLotsForAudit.find((l) => l.id === b.lotId);
        if (!lot || lot.productId !== line.productId) return false;
        if (lotFilterSet && !lotFilterSet.has(lot.id)) return false;
        return true;
      })
      .reduce((sum, b) => sum + Number(b.remainingQuantity), 0);
    if (requestedBaseQty > availableBaseQty) {
      const p = products.find((x) => x.id === line.productId);
      const suffix = line.lotIds?.length ? ' in selected lots' : '';
      throw new Error(
        `Insufficient stock for ${p?.name || 'product'}${suffix}. Available: ${availableBaseQty}, Requested: ${requestedBaseQty} (in base units)`,
      );
    }
  }
  const sale = {
    id: saleId,
    saleDate: dateStr,
    warehouseId,
    createdBy: userId,
    notes: notes != null ? String(notes) : '',
  };
  router.db.get('sales').push(sale).write();
  ensureCollection('salesItemAllocations', []);
  for (const line of createdItems) {
    router.db.get('salesItems').push(line).write();
    const allBatches = router.db.get('lotBatches').value() ?? [];
    const allLots = router.db.get('lots').value() ?? [];
    const candidates = allBatches
      .filter((b) => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter((b) => {
        const lot = allLots.find((l) => l.id === b.lotId);
        if (!lot || lot.productId !== line.productId) return false;
        if (line.lotIds?.length) return line.lotIds.includes(lot.id);
        return true;
      })
      .sort((a, b) => {
        if (line.lotIds?.length) {
          const ai = line.lotIds.indexOf(a.lotId);
          const bi = line.lotIds.indexOf(b.lotId);
          if (ai !== bi) return ai - bi;
        }
        return String(a.acquiredAt).localeCompare(String(b.acquiredAt));
      });
    let remainingToDeduct = line.quantity * getConversionFactor(line.productId, line.unitId);
    for (const batch of candidates) {
      if (remainingToDeduct <= 0) break;
      const currentRemaining = Number(batch.remainingQuantity);
      const take = Math.min(remainingToDeduct, currentRemaining);
      router.db.get('lotBatches').find({ id: batch.id }).assign({ remainingQuantity: currentRemaining - take }).write();
      router.db.get('salesItemAllocations').push({
        id: crypto.randomUUID(),
        salesItemId: line.id,
        lotBatchId: batch.id,
        quantityAllocated: take,
        unitCostAtTime: Number(batch.unitCost),
      }).write();
      remainingToDeduct -= take;
    }
    if (remainingToDeduct > 0) {
      const p = products.find((x) => x.id === line.productId);
      throw new Error(`Insufficient stock in selected lot order for ${p?.name || 'product'}`);
    }
  }
  if (actor.role === 'sales') {
    const linesSummary = createdItems
      .map((li) => {
        const p = products.find((x) => x.id === li.productId);
        const name = p?.name ?? 'Item';
        const units = router.db.get('units').value() ?? [];
        const unit = (p?.unitId && units.find((u) => u.id === p.unitId)?.label) || p?.unit || '';
        const unitPart = unit ? ` ${unit}` : '';
        const cur = currencies.find((c) => c.id === li.currencyId);
        const code = cur?.code ?? 'USD';
        return `${name} ×${li.quantity}${unitPart} @ ${code} ${Number(li.unitPrice).toFixed(2)}`;
      })
      .join(' · ');
    const wh = warehouses.find((w) => w.id === warehouseId);
    persistNotification({
      id: crypto.randomUUID(),
      type: 'sale_created',
      saleId,
      title: 'New sale logged',
      body: `${actor.email} · ${wh?.name ?? 'Warehouse'} · ${dateStr} · ${linesSummary}`,
      createdAt: new Date().toISOString(),
      actorUserId: userId,
      readByUserIds: [],
    });
  }
  const lotIdsUsed = new Set();
  const allUsedAllocations = router.db.get('salesItemAllocations').value() ?? [];
  for (const line of createdItems) {
    const lineAllocations = allUsedAllocations.filter((a) => a.salesItemId === line.id);
    for (const a of lineAllocations) {
      const batch = router.db.get('lotBatches').find({ id: a.lotBatchId }).value();
      if (batch) lotIdsUsed.add(batch.lotId);
    }
  }
  for (const lid of lotIdsUsed) {
    const totalRemaining = router.db.get('lotBatches').value()
      .filter((b) => b.lotId === lid)
      .reduce((s, b) => s + Number(b.remainingQuantity), 0);
    if (totalRemaining === 0) {
      const lot = router.db.get('lots').find({ id: lid }).value();
      const prod = products.find((p) => p.id === lot?.productId);
      const existing = router.db.get('notifications').find({ type: 'lot_depleted', lotId: lid }).value();
      if (!existing && lot) {
        persistNotification({
          id: crypto.randomUUID(),
          type: 'lot_depleted',
          lotId: lid,
          title: 'Lot Fully Sold Out',
          body: `Inventory Alert: Lot ${lot.lotNumber} (${prod?.name || 'Product'}) is now completely depleted across all warehouses. Tap to view the lifecycle profitability report.`,
          createdAt: new Date().toISOString(),
          actorUserId: userId,
          readByUserIds: [],
        });
      }
    }
  }
  return { sale, items: createdItems };
}

function markNotificationRead({ userId, id }) {
  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') throw new Error('Admins only');
  ensureNotificationsArray();
  const found = router.db.get('notifications').find({ id }).value();
  if (!found) throw new Error('Not found');
  const next = Array.from(new Set([...(found.readByUserIds || []), userId]));
  router.db.get('notifications').find({ id }).assign({ readByUserIds: next }).write();
  return true;
}

function login({ email, password }) {
  if (!email || !password) throw new Error('Missing email/password');
  const user = findUserByEmail(email);
  if (!user || user.password !== password) throw new Error('Invalid credentials');
  return {
    token: `demo-token-${user.id}`,
    user: publicUser(user),
  };
}

const typeDefs = `
  type User {
    id: ID!
    email: String!
    name: String
    phone: String
    role: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Unit {
    id: ID!
    label: String!
    globalFactor: Float
    isWholeNumber: Boolean
  }

  type Currency {
    id: ID!
    code: String!
  }

  type Product {
    id: ID!
    name: String!
    unitId: String!
    unit: String
  }

  type Warehouse {
    id: ID!
    name: String!
  }

  type Sale {
    id: ID!
    saleDate: String!
    warehouseId: String!
    createdBy: String!
    notes: String
  }

  type SalesItem {
    id: ID!
    saleId: String!
    productId: String!
    quantity: Float!
    unitPrice: Float!
    currencyId: String
    unitId: String
  }

  type AdminNotification {
    id: ID!
    type: String!
    saleId: String
    lotId: String
    title: String!
    body: String!
    createdAt: String!
    actorUserId: String!
    unread: Boolean
  }

  type Lot {
    id: ID!
    productId: String!
    lotNumber: String!
  }

  type LotBatch {
    id: ID!
    lotId: String!
    warehouseId: String!
    acquiredAt: String!
    unitCost: Float!
    originalQuantity: Float!
    remainingQuantity: Float!
  }

  type SalesItemAllocation {
    id: ID!
    salesItemId: String!
    lotBatchId: String!
    quantityAllocated: Float!
    unitCostAtTime: Float!
  }

  type InventoryTransfer {
    id: ID!
    transferDate: String!
    fromWarehouseId: String!
    toWarehouseId: String!
    createdBy: String!
    notes: String
  }

  type InventoryTransferLine {
    id: ID!
    transferId: String!
    productId: String!
    lotId: String
    quantity: Float!
  }

  type StockRow {
    id: ID!
    batchLotId: String
    lotId: String
    lotNumber: String
    productId: String!
    productName: String!
    unit: String
    warehouseId: String!
    warehouseName: String!
    quantityOnHand: Float!
    unitCost: Float
    acquiredAt: String
  }

  input SaleItemInput {
    productId: String!
    quantity: Float!
    unitPrice: Float!
    currencyId: String
    unitId: String
    lotIds: [String!]
  }

  input CreateSaleInput {
    warehouseId: String!
    saleDate: String
    notes: String
    items: [SaleItemInput!]!
  }

  input CreateSalesUserInput {
    email: String!
    password: String!
    name: String
    phone: String
  }

  input PurchaseLineInput {
    productId: String!
    quantity: Float!
    unitCost: Float!
    lotNumber: String
    unitId: String
  }

  input CreatePurchaseInput {
    warehouseId: String!
    purchaseDate: String
    notes: String
    items: [PurchaseLineInput!]!
  }

  input TransferLineInput {
    productId: String!
    quantity: Float!
  }

  input CreateTransferInput {
    fromWarehouseId: String!
    toWarehouseId: String!
    transferDate: String
    notes: String
    lines: [TransferLineInput!]!
  }

  input CreateNotificationInput {
    type: String!
    saleId: String
    lotId: String
    title: String!
    body: String!
    actorUserId: String!
    readByUserIds: [String!]
  }

  type CreateSalePayload {
    sale: Sale!
    items: [SalesItem!]!
  }

  type CreateSalesUserPayload {
    user: User!
  }

  type ActionResult {
    ok: Boolean!
    purchaseId: String
    transferId: String
  }

  type Query {
    me: User
    users: [User!]!
    units: [Unit!]!
    currencies: [Currency!]!
    products: [Product!]!
    warehouses: [Warehouse!]!
    sales: [Sale!]!
    salesItems: [SalesItem!]!
    notifications: [AdminNotification!]!
    inventoryStock: [StockRow!]!
    lots: [Lot!]!
    lotBatches: [LotBatch!]!
    salesItemAllocations: [SalesItemAllocation!]!
    inventoryTransfers: [InventoryTransfer!]!
    inventoryTransferLines: [InventoryTransferLine!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createSalesUser(input: CreateSalesUserInput!): CreateSalesUserPayload!
    createSale(input: CreateSaleInput!): CreateSalePayload!
    markNotificationRead(id: ID!): Boolean!
    createUnit(label: String!): Unit!
    createCurrency(code: String!): Currency!
    createPurchase(input: CreatePurchaseInput!): ActionResult!
    createInventoryTransfer(input: CreateTransferInput!): ActionResult!
    createNotification(input: CreateNotificationInput!): AdminNotification!
  }
  type Subscription {
    notificationCreated: AdminNotification!
  }
`;

function getAuthFromContext(ctx) {
  if (ctx?.userId && ctx?.actor) return { userId: ctx.userId, actor: ctx.actor };
  return requireAuth(ctx);
}

const resolvers = {
  Query: {
    me: (_parent, _args, ctx) => {
      const userId = parseBearerUserId(ctx?.req || {});
      return publicUser(findUserById(userId));
    },
    users: () => (router.db.get('users').value() ?? []).map(publicUser),
    units: () => router.db.get('units').value() ?? [],
    currencies: () => router.db.get('currencies').value() ?? [],
    products: () => router.db.get('products').value() ?? [],
    warehouses: () => router.db.get('warehouses').value() ?? [],
    sales: () => router.db.get('sales').value() ?? [],
    salesItems: () => router.db.get('salesItems').value() ?? [],
    notifications: (_parent, _args, ctx) => {
      const { userId } = getAuthFromContext(ctx);
      return listAdminNotifications(userId);
    },
    inventoryStock: (_parent, _args, ctx) => {
      getAuthFromContext(ctx);
      return getInventoryStockRows();
    },
    lots: () => router.db.get('lots').value() ?? [],
    lotBatches: () => router.db.get('lotBatches').value() ?? [],
    salesItemAllocations: () => router.db.get('salesItemAllocations').value() ?? [],
    inventoryTransfers: () => router.db.get('inventoryTransfers').value() ?? [],
    inventoryTransferLines: () => router.db.get('inventoryTransferLines').value() ?? [],
  },
  Mutation: {
    login: (_parent, { email, password }) => login({ email, password }),
    createSalesUser: (_parent, { input }, ctx) => {
      const { actor } = getAuthFromContext(ctx);
      return createSalesUser({ actor, input });
    },
    createSale: (_parent, { input }, ctx) => {
      const { actor, userId } = getAuthFromContext(ctx);
      return createSale({ actor, userId, input });
    },
    markNotificationRead: (_parent, { id }, ctx) => {
      const { userId } = getAuthFromContext(ctx);
      return markNotificationRead({ userId, id });
    },
    createUnit: (_parent, { label }, ctx) => {
      const { actor } = getAuthFromContext(ctx);
      return createUnit({ actor, label });
    },
    createCurrency: (_parent, { code }, ctx) => {
      const { actor } = getAuthFromContext(ctx);
      return createCurrency({ actor, code });
    },
    createPurchase: (_parent, { input }, ctx) => {
      const { actor, userId } = getAuthFromContext(ctx);
      return createPurchase({ actor, userId, input });
    },
    createInventoryTransfer: (_parent, { input }, ctx) => {
      const { actor, userId } = getAuthFromContext(ctx);
      return createInventoryTransfer({ actor, userId, input });
    },
    createNotification: (_parent, { input }) => {
      const row = {
        id: crypto.randomUUID(),
        type: input.type,
        saleId: input.saleId ?? undefined,
        lotId: input.lotId ?? undefined,
        title: input.title,
        body: input.body,
        createdAt: new Date().toISOString(),
        actorUserId: input.actorUserId,
        readByUserIds: Array.isArray(input.readByUserIds) ? input.readByUserIds : [],
      };
      return persistNotification(row);
    },
  },
  Subscription: {
    notificationCreated: {
      subscribe: (_parent, _args, ctx) => {
        const actor = ctx?.actor;
        if (!actor || actor.role !== 'admin') throw new Error('Admins only');
        return createTopicAsyncIterator(NOTIFICATION_CREATED_TOPIC);
      },
      resolve: (payload, _args, ctx) => withUnreadForUser(payload, ctx?.userId),
    },
  },
  AdminNotification: {
    unread: (notification, _args, ctx) => {
      if (typeof notification.unread === 'boolean') return notification.unread;
      return withUnreadForUser(notification, ctx?.userId).unread;
    },
  },
};

const gqlSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

server.all(
  '/graphql',
  createHandler({
    schema: gqlSchema,
    context: (req) => ({ req }),
  }),
);
const httpServer = createServer(server);
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});
useServer(
  {
    schema: gqlSchema,
    context: (ctx) => {
      const authHeader =
        ctx?.connectionParams?.Authorization ||
        ctx?.connectionParams?.authorization ||
        '';
      const userId = parseBearerUserIdFromHeader(authHeader);
      const actor = userId ? findUserById(userId) : null;
      return {
        req: { headers: { authorization: String(authHeader) } },
        userId: userId ?? null,
        actor: actor ?? null,
      };
    },
  },
  wsServer,
);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL backend running on http://localhost:${PORT}/graphql (queries/mutations + subscriptions)`);
});
