const path = require('path');
const crypto = require('crypto');

const cors = require('cors');
const jsonServer = require('json-server');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use(cors({ origin: '*' }));
server.use(middlewares);
server.use(jsonServer.bodyParser);

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
  const authz = req.headers.authorization || '';
  const match = authz.match(/^Bearer\s+demo-token-(.+)$/i);
  return match?.[1] ?? null;
}

function ensureNotificationsArray() {
  const n = router.db.get('notifications').value();
  if (!Array.isArray(n)) {
    router.db.set('notifications', []).write();
  }
}

// Demo login route so the app can authenticate against JSON Server.
// For now this uses plaintext passwords (demo only).
server.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email/password' });
  }

  const user = findUserByEmail(email);

  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  return res.json({
    token: `demo-token-${user.id}`,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  });
});

// Admin-only: create a new sales user ("sign up" for sales reps, issued by admin).
server.post('/api/users', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can add sales users' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email/password' });
  }

  const em = String(email).trim().toLowerCase();
  if (!em.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (findUserByEmail(em)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newUser = {
    id: crypto.randomUUID(),
    email: em,
    password: String(password),
    role: 'sales',
  };

  router.db.get('users').push(newUser).write();

  return res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

// Authenticated: log a sale (+ line items). When a sales rep logs it, admins get a notification.
function getConversionFactor(productId, unitId) {
  const units = router.db.get('units').value() ?? [];
  const products = router.db.get('products').value() ?? [];
  const unit = units.find((u) => u.id === unitId);
  const product = products.find((p) => p.id === productId);

  if (!unit) return 1;
  // Priority 1: Global factor (Tons, Grams, etc.)
  if (typeof unit.globalFactor === 'number') return unit.globalFactor;
  // Priority 2: Product-specific conversion (Bags, boxes, etc.)
  if (product && product.conversions && typeof product.conversions[unitId] === 'number') {
    return product.conversions[unitId];
  }
  return 1;
}

server.post('/api/sales', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const actor = findUserById(userId);
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { warehouseId, notes, items, saleDate } = req.body || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing warehouseId or items' });
  }

  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === warehouseId)) {
    return res.status(400).json({ error: 'Unknown warehouse' });
  }

  const products = router.db.get('products').value() ?? [];
  const currencies = router.db.get('currencies').value() ?? [];
  const defaultCurrencyId = currencies[0]?.id;
  if (!defaultCurrencyId) {
    return res.status(500).json({ error: 'No currencies configured' });
  }
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

    const line = {
      id: crypto.randomUUID(),
      saleId,
      productId: it.productId,
      quantity: qty,
      unitPrice: price,
      currencyId,
      unitId: it.unitId, // Store the unit used in the transaction
    };
    createdItems.push(line);
  }

  if (createdItems.length === 0) {
    return res.status(400).json({ error: 'No valid line items' });
  }

  const sale = {
    id: saleId,
    saleDate: dateStr,
    warehouseId,
    createdBy: userId,
    notes: notes != null ? String(notes) : '',
  };

  // --- PRE-VALIDATION: Check total available stock ---
  const allBatchesForAudit = router.db.get('lotBatches').value() ?? [];
  const allLotsForAudit = router.db.get('lots').value() ?? [];
  
  for (const line of createdItems) {
    const requestedBaseQty = line.quantity * getConversionFactor(line.productId, line.unitId);
    
    const availableBaseQty = allBatchesForAudit
      .filter(b => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter(b => {
        const lot = allLotsForAudit.find(l => l.id === b.lotId);
        return lot && lot.productId === line.productId;
      })
      .reduce((sum, b) => sum + Number(b.remainingQuantity), 0);

    if (requestedBaseQty > availableBaseQty) {
      const p = products.find(x => x.id === line.productId);
      return res.status(400).json({ 
        error: `Insufficient stock for ${p?.name || 'product'}. Available: ${availableBaseQty}, Requested: ${requestedBaseQty} (in base units)` 
      });
    }
  }

  router.db.get('sales').push(sale).write();
  for (const line of createdItems) {
    router.db.get('salesItems').push(line).write();

    // --- FIFO AUTOMATIC ALLOCATION ---
    const allBatches = router.db.get('lotBatches').value() ?? [];
    const allLots = router.db.get('lots').value() ?? [];
    
    // Sort batches for this product + warehouse by date (Oldest first)
    const candidates = allBatches
      .filter(b => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter(b => {
        const lot = allLots.find(l => l.id === b.lotId);
        return lot && lot.productId === line.productId;
      })
      .sort((a, b) => String(a.acquiredAt).localeCompare(String(b.acquiredAt)));

    let remainingToDeduct = line.quantity * getConversionFactor(line.productId, line.unitId);
    ensureCollection('salesItemAllocations', []);

    for (const batch of candidates) {
      if (remainingToDeduct <= 0) break;
      const currentRemaining = Number(batch.remainingQuantity);
      const take = Math.min(remainingToDeduct, currentRemaining);
      
      // Permanently deduct from this batch
      router.db.get('lotBatches').find({ id: batch.id }).assign({
        remainingQuantity: currentRemaining - take
      }).write();

      // Mirror the allocation for detailed profit/cost reporting
      router.db.get('salesItemAllocations').push({
        id: crypto.randomUUID(),
        salesItemId: line.id,
        lotBatchId: batch.id,
        quantityAllocated: take,
        unitCostAtTime: Number(batch.unitCost)
      }).write();

      remainingToDeduct -= take;
    }
  }

  if (actor.role === 'sales') {
    ensureNotificationsArray();
    const linesSummary = createdItems
      .map((li) => {
        const p = products.find((x) => x.id === li.productId);
        const name = p?.name ?? 'Item';
        const units = router.db.get('units').value() ?? [];
        const unit =
          (p?.unitId && units.find((u) => u.id === p.unitId)?.label) || p?.unit || '';
        const unitPart = unit ? ` ${unit}` : '';
        const cur = currencies.find((c) => c.id === li.currencyId);
        const code = cur?.code ?? 'USD';
        return `${name} ×${li.quantity}${unitPart} @ ${code} ${Number(li.unitPrice).toFixed(2)}`;
      })
      .join(' · ');
    const wh = warehouses.find((w) => w.id === warehouseId);
    const notif = {
      id: crypto.randomUUID(),
      type: 'sale_created',
      saleId,
      title: 'New sale logged',
      body: `${actor.email} · ${wh?.name ?? 'Warehouse'} · ${dateStr} · ${linesSummary}`,
      createdAt: new Date().toISOString(),
      actorUserId: userId,
      readByUserIds: [],
    };
    router.db.get('notifications').push(notif).write();
  }

  // --- LOT DEPLETION CHECK ---
  // If any lot used in this sale just hit 0 across all warehouses, notify the admin
  const lotIdsUsed = new Set();
  const allUsedAllocations = router.db.get('salesItemAllocations').value() ?? [];
  for (const line of createdItems) {
    const lineAllocations = allUsedAllocations.filter(a => a.salesItemId === line.id);
    for (const a of lineAllocations) {
      const batch = router.db.get('lotBatches').find({ id: a.lotBatchId }).value();
      if (batch) lotIdsUsed.add(batch.lotId);
    }
  }

  for (const lid of lotIdsUsed) {
    const totalRemaining = router.db.get('lotBatches').value()
      .filter(b => b.lotId === lid)
      .reduce((s, b) => s + Number(b.remainingQuantity), 0);
    
    if (totalRemaining === 0) {
      const lot = router.db.get('lots').find({ id: lid }).value();
      const prod = products.find(p => p.id === lot?.productId);
      const lotNotifId = crypto.randomUUID();
      
      // Ensure we don't spam duplicate depletion notifications for the same lot
      const existing = router.db.get('notifications').find({ type: 'lot_depleted', lotId: lid }).value();
      
      if (!existing && lot) {
        const lotNotif = {
          id: lotNotifId,
          type: 'lot_depleted',
          lotId: lid,
          title: 'Lot Fully Sold Out',
          body: `Inventory Alert: Lot ${lot.lotNumber} (${prod?.name || 'Product'}) is now completely depleted across all warehouses. Tap to view the lifecycle profitability report.`,
          createdAt: new Date().toISOString(),
          actorUserId: userId,
          readByUserIds: []
        };
        ensureNotificationsArray();
        router.db.get('notifications').push(lotNotif).write();
      }
    }
  }

  return res.status(201).json({ sale, items: createdItems });
});

// Admin-only: list notifications for the signed-in admin (includes unread flag).
server.get('/api/notifications', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }

  ensureNotificationsArray();
  const all = router.db.get('notifications').value() ?? [];
  const enriched = all
    .map((n) => ({
      ...n,
      unread: !(n.readByUserIds || []).includes(userId),
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return res.json(enriched);
});

// Admin-only: mark a notification as read for this admin.
server.post('/api/notifications/:id/read', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }

  const { id } = req.params;
  ensureNotificationsArray();
  const found = router.db.get('notifications').find({ id }).value();
  if (!found) {
    return res.status(404).json({ error: 'Not found' });
  }

  const next = Array.from(new Set([...(found.readByUserIds || []), userId]));
  router.db.get('notifications').find({ id }).assign({ readByUserIds: next }).write();

  return res.json({ ok: true });
});

function ensureCollection(name, fallback) {
  const cur = router.db.get(name).value();
  if (!Array.isArray(cur)) {
    router.db.set(name, fallback).write();
  }
}

// Authenticated: on-hand quantities by product + warehouse (from lot batches).
server.get('/api/inventory/stock', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = findUserById(userId);
  if (!actor) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const lotBatches = router.db.get('lotBatches').value() ?? [];
  const lots = router.db.get('lots').value() ?? [];
  const products = router.db.get('products').value() ?? [];
  const warehouses = router.db.get('warehouses').value() ?? [];
  const units = router.db.get('units').value() ?? [];

  const summaryMap = new Map();
  for (const b of lotBatches) {
    const rem = Number(b.remainingQuantity);
    if (!Number.isFinite(rem) || rem <= 0) continue;
    const lot = lots.find((l) => l.id === b.lotId);
    if (!lot) continue;
    const key = `${lot.productId}__${b.warehouseId}`;
    const existing = summaryMap.get(key) || { qty: 0, oldestCost: b.unitCost };
    summaryMap.set(key, { 
      qty: existing.qty + rem, 
      oldestCost: existing.oldestCost // Keep the first (oldest) cost found
    });
  }

  const rows = [];
  for (const [key, data] of summaryMap) {
    const [productId, warehouseId] = key.split('__');
    const p = products.find((x) => x.id === productId);
    const w = warehouses.find((x) => x.id === warehouseId);
    const unitLabel =
      (p?.unitId && units.find((u) => u.id === p.unitId)?.label) || p?.unit || '';
    rows.push({
      productId,
      productName: p?.name ?? 'Product',
      unit: unitLabel,
      warehouseId,
      warehouseName: w?.name ?? 'Warehouse',
      quantityOnHand: data.qty,
      unitCost: data.oldestCost || 0,
    });
  }
  rows.sort((a, b) => {
    const w = String(a.warehouseName).localeCompare(String(b.warehouseName));
    if (w !== 0) return w;
    return String(a.productName).localeCompare(String(b.productName));
  });
  return res.json(rows);
});

// Admin: inbound purchase → lots, lot batches, purchase line items.
server.post('/api/purchases', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can record purchases' });
  }

  const { warehouseId, purchaseDate, notes, items } = req.body || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing warehouseId or items' });
  }

  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === warehouseId)) {
    return res.status(400).json({ error: 'Unknown warehouse' });
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
    return res.status(400).json({ error: 'No valid line items' });
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

  return res.status(201).json({ purchaseId, ok: true });
});

// Admin: move stock between warehouses (FIFO from source batches).
server.post('/api/inventory/transfers', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = findUserById(userId);
  if (!actor || actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can transfer stock' });
  }

  const { fromWarehouseId, toWarehouseId, transferDate, notes, lines } = req.body || {};
  if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) {
    return res.status(400).json({ error: 'Invalid warehouses' });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Missing lines' });
  }

  const warehouses = router.db.get('warehouses').value() ?? [];
  if (!warehouses.some((w) => w.id === fromWarehouseId)) {
    return res.status(400).json({ error: 'Unknown from warehouse' });
  }
  if (!warehouses.some((w) => w.id === toWarehouseId)) {
    return res.status(400).json({ error: 'Unknown to warehouse' });
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
    return res.status(400).json({ error: 'No valid lines' });
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
      return res.status(400).json({ error: `Insufficient stock for ${pname}` });
    }

    for (const m of moves) {
      const row = router.db.get('lotBatches').find({ id: m.batchId }).value();
      if (!row) continue;
      
      const nextRemaining = Number(row.remainingQuantity) - m.take;
      router.db.get('lotBatches').find({ id: m.batchId }).assign({ remainingQuantity: nextRemaining }).write();

      // NEW: reuse the same lotId for the destination batch to track lifecycle
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
          lotId: sourceLotId, // NEW: link transfer line to specific lot
          quantity: m.take,
        })
        .write();
    }
  }


  // --- DEPLETION CHECK FOR TRANSFERS ---
  // If moving stock emptied out a lot in the source warehouse, check if it's 0 everywhere else
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
        ensureNotificationsArray();
        router.db.get('notifications').push(lotNotif).write();
      }
    }
  }

  return res.status(201).json({ transferId, ok: true });
});

// Authenticated: add a unit (shown on products & stock).
server.post('/api/units', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = findUserById(userId);
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const label = String(req.body?.label ?? '').trim();
  if (!label) {
    return res.status(400).json({ error: 'Label required' });
  }
  ensureCollection('units', []);
  const row = { id: crypto.randomUUID(), label };
  router.db.get('units').push(row).write();
  return res.status(201).json(row);
});

// Authenticated: add a currency (pricing on sale lines).
server.post('/api/currencies', (req, res) => {
  const userId = parseBearerUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const actor = findUserById(userId);
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const raw = String(req.body?.code ?? '').trim().toUpperCase();
  if (!raw || raw.length > 8) {
    return res.status(400).json({ error: 'Valid currency code required' });
  }
  ensureCollection('currencies', []);
  const existing = router.db.get('currencies').value() ?? [];
  if (existing.some((c) => String(c.code).toUpperCase() === raw)) {
    return res.status(400).json({ error: 'Currency already exists' });
  }
  const row = { id: crypto.randomUUID(), code: raw };
  router.db.get('currencies').push(row).write();
  return res.status(201).json(row);
});

// Expose the rest of JSON Server collections under /api/*.
server.use('/api', router);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`JSON Server backend running on http://localhost:${PORT}`);
});
