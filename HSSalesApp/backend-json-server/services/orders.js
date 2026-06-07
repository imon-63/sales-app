'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { ensureCollection, findUserById } = require('../helpers');
const { createSale } = require('./sales');
const { persistNotification } = require('./notifications');

const BD = '০১২৩৪৫৬৭৮৯';
function bNum(n, pad = 2) { return String(n).padStart(pad, '0').split('').map(d => BD[Number(d)]).join(''); }

function generateOrderNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${bNum(now.getMonth() + 1)}${bNum(now.getDate())}`;
  ensureCollection('orders', []);
  const count = (db.get('orders').value() ?? []).length + 1;
  return `অর্ড-${date}-${bNum(count, 3)}`;
}

function createOrder({ actor, userId, input }) {
  if (!actor) throw new Error('Unauthorized');
  const { customerName, customerPhone, customerAddress, orderDate, expectedDelivery, warehouseId, advancePaid, notes, items } = input || {};
  if (!customerName?.trim()) throw new Error('Customer name required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item required');
  const validItems = items.filter(it => it?.productId && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
  if (validItems.length === 0) throw new Error('No valid items');

  ensureCollection('orders', []);
  ensureCollection('orderItems', []);
  const orderId = crypto.randomUUID();
  const dateStr = typeof orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(orderDate) ? orderDate : new Date().toISOString().slice(0, 10);

  const order = {
    id: orderId,
    orderNumber: generateOrderNumber(),
    status: 'draft',
    customerName: String(customerName).trim(),
    customerPhone: customerPhone ? String(customerPhone).trim() : null,
    customerAddress: customerAddress ? String(customerAddress).trim() : null,
    orderDate: dateStr,
    expectedDelivery: expectedDelivery ?? null,
    deliveredDate: null,
    warehouseId: warehouseId ?? null,
    advancePaid: Number(advancePaid) || 0,
    notes: notes ? String(notes).trim() : null,
    createdBy: userId,
    cancelReason: null,
  };
  db.get('orders').push(order).write();

  for (const it of validItems) {
    db.get('orderItems').push({
      id: crypto.randomUUID(), orderId,
      productId: it.productId,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      currencyId: it.currencyId ?? null,
      lotIds: Array.isArray(it.lotIds) ? it.lotIds.filter(Boolean) : [],
      lotAllocations: it.lotAllocations ?? null,
    }).write();
  }

  // Notify everyone — both admin and sales roles see order_created
  const products = db.get('products').value() ?? [];
  const itemsSummary = validItems
    .map(it => { const p = products.find(p => p.id === it.productId); return `${p?.name ?? 'পণ্য'} ×${it.quantity}`; })
    .join(', ');
  const creator = findUserById(userId);
  persistNotification({
    id: crypto.randomUUID(),
    type: 'order_created',
    orderId,
    title: `নতুন অর্ডার — ${order.orderNumber}`,
    body: `${order.customerName}${order.customerPhone ? ' · ' + order.customerPhone : ''} · ${itemsSummary}`,
    createdAt: new Date().toISOString(),
    actorUserId: userId,
    readByUserIds: [],
    creatorRole: creator?.role ?? 'sales',
  });

  return order;
}

function updateOrder({ actor, userId, id, input }) {
  if (!actor) throw new Error('Unauthorized');
  const order = db.get('orders').find({ id }).value();
  if (!order) throw new Error('Order not found');
  // Only creator or admin can edit
  if (actor.role !== 'admin' && order.createdBy !== userId) throw new Error('Forbidden');
  if (['delivered', 'cancelled'].includes(order.status)) throw new Error('Cannot edit a completed or cancelled order');

  const allowed = ['customerName', 'customerPhone', 'customerAddress', 'expectedDelivery', 'warehouseId', 'advancePaid', 'notes'];
  const patch = {};
  for (const k of allowed) { if (input[k] !== undefined) patch[k] = input[k]; }
  db.get('orders').find({ id }).assign(patch).write();

  // Update items if provided
  if (Array.isArray(input.items)) {
    db.get('orderItems').remove({ orderId: id }).write();
    for (const it of input.items.filter(it => it?.productId && Number(it.quantity) > 0)) {
      db.get('orderItems').push({ id: crypto.randomUUID(), orderId: id, productId: it.productId, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), currencyId: it.currencyId ?? null, lotIds: Array.isArray(it.lotIds) ? it.lotIds.filter(Boolean) : [], lotAllocations: it.lotAllocations ?? null }).write();
    }
  }
  return db.get('orders').find({ id }).value();
}

const VALID_TRANSITIONS = {
  draft:            ['confirmed', 'cancelled'],
  confirmed:        ['processing', 'cancelled'],
  processing:       ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered:        [],
  cancelled:        [],
};

function updateOrderStatus({ actor, userId, id, status, cancelReason }) {
  if (!actor) throw new Error('Unauthorized');
  const order = db.get('orders').find({ id }).value();
  if (!order) throw new Error('Order not found');
  // Both admin and sales can advance any order through the flow
  // Only admin can cancel other users' orders
  if (status === 'cancelled' && actor.role !== 'admin' && order.createdBy !== userId) {
    throw new Error('Only admin can cancel orders created by others');
  }
  if (!VALID_TRANSITIONS[order.status]?.includes(status)) throw new Error(`Cannot move from ${order.status} to ${status}`);

  const patch = { status };
  const now = new Date().toISOString().slice(0, 10);
  if (status === 'confirmed')        patch.confirmedDate = now;
  if (status === 'processing')       patch.processingDate = now;
  if (status === 'out_for_delivery') patch.outForDeliveryDate = now;
  if (status === 'delivered')        patch.deliveredDate = now;
  if (status === 'cancelled')        patch.cancelReason = cancelReason ?? null;

  // ── Processing: validate stock + reserve from allocated lots ─────────────
  if (status === 'processing') {
    const orderItems = (db.get('orderItems').value() ?? []).filter(oi => oi.orderId === id);
    if (orderItems.length === 0) throw new Error('প্রক্রিয়া শুরু করা যাবে না: অর্ডারে কোনো পণ্য নেই।');
    const allBatches = db.get('lotBatches').value() ?? [];
    const allLots = db.get('lots').value() ?? [];
    const shortages = [];

    // Check total availability
    for (const oi of orderItems) {
      const available = allBatches
        .filter(b => Number(b.remainingQuantity) > 0)
        .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === oi.productId; })
        .reduce((s, b) => s + Number(b.remainingQuantity), 0);
      if (available < oi.quantity) {
        const prod = (db.get('products').value() ?? []).find(p => p.id === oi.productId);
        shortages.push(`${prod?.name ?? oi.productId}: দরকার ${oi.quantity}, মজুদ ${available}`);
      }
    }
    if (shortages.length > 0) throw new Error(`মজুদ অপর্যাপ্ত:\n${shortages.join('\n')}`);

    // If lot allocations exist, reserve stock now (deduct from lots) and store batch-level breakdown
    const hasAnyAllocations = orderItems.some(oi => oi.lotAllocations);
    if (hasAnyAllocations) {
      for (const oi of orderItems) {
        if (!oi.lotAllocations) continue;
        let allocs;
        try { allocs = typeof oi.lotAllocations === 'string' ? JSON.parse(oi.lotAllocations) : oi.lotAllocations; } catch { continue; }
        if (!Array.isArray(allocs)) continue;

        const batchAllocs = []; // [{batchId, lotId, quantity, unitCostAtTime}]
        for (const alloc of allocs) {
          if (!alloc.lotId || !Number(alloc.quantity)) continue;
          const lot = allLots.find(l => l.id === alloc.lotId);
          if (!lot) continue;
          // FIFO within this lot's batches
          const batches = allBatches
            .filter(b => b.lotId === lot.id && Number(b.remainingQuantity) > 0)
            .sort((a, b) => String(a.acquiredAt).localeCompare(String(b.acquiredAt)));
          let rem = Number(alloc.quantity);
          for (const batch of batches) {
            if (rem <= 0) break;
            const take = Math.min(rem, Number(batch.remainingQuantity));
            db.get('lotBatches').find({ id: batch.id }).assign({ remainingQuantity: Number(batch.remainingQuantity) - take }).write();
            batchAllocs.push({ batchId: batch.id, lotId: lot.id, quantity: take, unitCostAtTime: Number(batch.unitCost) });
            rem -= take;
          }
        }
        // Store batch-level allocations so delivery can create correct sale records
        db.get('orderItems').find({ id: oi.id }).assign({ batchAllocations: JSON.stringify(batchAllocs) }).write();
      }
      patch.stockReserved = true;
    }
  }

  // ── Cancellation: restore reserved stock if it was deducted at processing ──
  if (status === 'cancelled' && order.stockReserved) {
    const orderItems = (db.get('orderItems').value() ?? []).filter(oi => oi.orderId === id);
    for (const oi of orderItems) {
      if (!oi.batchAllocations) continue;
      let batchAllocs;
      try { batchAllocs = typeof oi.batchAllocations === 'string' ? JSON.parse(oi.batchAllocations) : oi.batchAllocations; } catch { continue; }
      if (!Array.isArray(batchAllocs)) continue;
      for (const ba of batchAllocs) {
        if (!ba.batchId || !Number(ba.quantity)) continue;
        const batch = db.get('lotBatches').find({ id: ba.batchId }).value();
        if (batch) {
          db.get('lotBatches').find({ id: ba.batchId }).assign({
            remainingQuantity: Number(batch.remainingQuantity) + Number(ba.quantity),
          }).write();
        }
      }
    }
    patch.stockReserved = false;
  }

  // ── Inventory reconciliation at Delivery ─────────────────────────────────
  // Use the warehouse that actually has stock for each product (FIFO across warehouses).
  // Done BEFORE writing status so a stock failure keeps the order in its current state.
  if (status === 'delivered') {
    const orderItems = (db.get('orderItems').value() ?? []).filter(oi => oi.orderId === id);
    if (orderItems.length === 0) throw new Error('Delivery blocked: order has no items.');
    const allBatches = db.get('lotBatches').value() ?? [];
    const allLots = db.get('lots').value() ?? [];
    const allWarehouses = db.get('warehouses').value() ?? [];

    // Check if all items have explicit lot allocations — if so, bypass single-warehouse requirement
    const allHaveAllocations = orderItems.every(oi => {
      if (!oi.lotAllocations) return false;
      try {
        const a = typeof oi.lotAllocations === 'string' ? JSON.parse(oi.lotAllocations) : oi.lotAllocations;
        return Array.isArray(a) && a.length > 0;
      } catch { return false; }
    });

    let resolvedWid = order.warehouseId;

    if (order.stockReserved) {
      // Stock was already deducted at processing — skip availability check entirely.
      // Just need a valid warehouse ID for the sale record; actual batch data comes from batchAllocations.
      if (!resolvedWid) {
        const firstBatch = (() => {
          for (const oi of orderItems) {
            if (!oi.batchAllocations) continue;
            try {
              const ba = typeof oi.batchAllocations === 'string' ? JSON.parse(oi.batchAllocations) : oi.batchAllocations;
              if (Array.isArray(ba) && ba[0]?.batchId) {
                const b = allBatches.find(x => x.id === ba[0].batchId);
                if (b) return b;
              }
            } catch {}
          }
          return null;
        })();
        resolvedWid = firstBatch?.warehouseId ?? allWarehouses[0]?.id;
      }
    } else if (allHaveAllocations) {
      // Allocations exist but stock wasn't reserved — verify total available across warehouses
      const shortages = [];
      for (const oi of orderItems) {
        const avail = allBatches
          .filter(b => Number(b.remainingQuantity) > 0)
          .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === oi.productId; })
          .reduce((s, b) => s + Number(b.remainingQuantity), 0);
        if (avail < oi.quantity) {
          const prod = (db.get('products').value() ?? []).find(p => p.id === oi.productId);
          shortages.push(`${prod?.name ?? oi.productId}: দরকার ${oi.quantity}, মজুদ ${avail}`);
        }
      }
      if (shortages.length > 0) throw new Error(`মজুদ অপর্যাপ্ত:\n${shortages.join('\n')}`);
      if (!resolvedWid) {
        const firstAlloc = (() => {
          for (const oi of orderItems) {
            try {
              const a = typeof oi.lotAllocations === 'string' ? JSON.parse(oi.lotAllocations) : oi.lotAllocations;
              if (Array.isArray(a) && a[0]?.lotId) return a[0];
            } catch {}
          }
          return null;
        })();
        if (firstAlloc) {
          const batch = allBatches.find(b => b.lotId === firstAlloc.lotId);
          resolvedWid = batch?.warehouseId;
        }
        if (!resolvedWid) resolvedWid = allWarehouses[0]?.id;
      }
    } else {
      // Normal warehouse resolution: find a single warehouse with full coverage
      if (resolvedWid) {
        const hasFull = orderItems.every(oi => {
          const avail = allBatches.filter(b => b.warehouseId === resolvedWid && Number(b.remainingQuantity) > 0)
            .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === oi.productId; })
            .reduce((s, b) => s + Number(b.remainingQuantity), 0);
          return avail >= oi.quantity;
        });
        if (!hasFull) resolvedWid = null;
      }
      if (!resolvedWid) {
        for (const wh of allWarehouses) {
          const ok = orderItems.every(oi => {
            const avail = allBatches.filter(b => b.warehouseId === wh.id && Number(b.remainingQuantity) > 0)
              .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === oi.productId; })
              .reduce((s, b) => s + Number(b.remainingQuantity), 0);
            return avail >= oi.quantity;
          });
          if (ok) { resolvedWid = wh.id; break; }
        }
      }
      if (!resolvedWid) throw new Error('Delivery blocked: insufficient stock across all warehouses.');
    }
    createSale({
      actor, userId,
      input: {
        warehouseId: resolvedWid,
        saleDate: now,
        notes: `অর্ডার: ${order.orderNumber}`,
        items: orderItems.map(oi => ({
          productId: oi.productId,
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          currencyId: oi.currencyId,
          lotIds: Array.isArray(oi.lotIds) && oi.lotIds.length > 0 ? oi.lotIds : undefined,
          lotAllocations: oi.lotAllocations ?? undefined,
          // If stock was already deducted at processing, pass batchAllocations so
          // createSale creates the records without re-deducting
          batchAllocations: order.stockReserved && oi.batchAllocations ? oi.batchAllocations : undefined,
        })),
      },
    });
  }

  // Only write the status after all side-effects succeed
  db.get('orders').find({ id }).assign(patch).write();

  return db.get('orders').find({ id }).value();
}

function deleteOrder({ actor, userId, id }) {
  if (!actor) throw new Error('Unauthorized');
  const order = db.get('orders').find({ id }).value();
  if (!order) throw new Error('Order not found');
  if (actor.role !== 'admin' && order.createdBy !== userId) throw new Error('Forbidden');
  if (order.status === 'delivered') throw new Error('Cannot delete a delivered order');
  db.get('orderItems').remove({ orderId: id }).write();
  db.get('orders').remove({ id }).write();
  return true;
}

function listOrders({ actor }) {
  if (!actor) throw new Error('Unauthorized');
  ensureCollection('orders', []);
  // Both admin and sales see all orders
  const orders = db.get('orders').value() ?? [];
  return orders.sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
}

function addOrderPayment({ actor, userId, input }) {
  if (!actor) throw new Error('Unauthorized');
  const { orderId, amount, notes, paidAt } = input || {};
  const order = db.get('orders').find({ id: orderId }).value();
  if (!order) throw new Error('Order not found');
  if (actor.role !== 'admin' && order.createdBy !== userId) throw new Error('Forbidden');
  if (order.status === 'cancelled') throw new Error('Cannot record payment on a cancelled order');
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Valid amount required');

  ensureCollection('orderPayments', []);
  const payment = {
    id: crypto.randomUUID(),
    orderId,
    amount: amt,
    notes: notes ? String(notes).trim() : null,
    paidAt: paidAt ?? new Date().toISOString().slice(0, 10),
    recordedBy: userId,
    orderStep: order.status, // record which step the payment was made at
  };
  db.get('orderPayments').push(payment).write();
  return payment;
}

function listPaymentsForOrder({ actor, userId, orderId }) {
  if (!actor) throw new Error('Unauthorized');
  const order = db.get('orders').find({ id: orderId }).value();
  if (!order) throw new Error('Order not found');
  if (actor.role !== 'admin' && order.createdBy !== userId) throw new Error('Forbidden');
  ensureCollection('orderPayments', []);
  return (db.get('orderPayments').value() ?? []).filter(p => p.orderId === orderId);
}

module.exports = { createOrder, updateOrder, updateOrderStatus, deleteOrder, listOrders, addOrderPayment, listPaymentsForOrder };
