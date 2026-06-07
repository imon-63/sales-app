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
      db.get('orderItems').push({ id: crypto.randomUUID(), orderId: id, productId: it.productId, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), currencyId: it.currencyId ?? null }).write();
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
  if (status === 'delivered') patch.deliveredDate = now;
  if (status === 'cancelled') patch.cancelReason = cancelReason ?? null;

  // ── Inventory validation at Processing stage ─────────────────────────────
  // Check total available across ALL warehouses — exact warehouse resolved at delivery.
  if (status === 'processing') {
    const orderItems = (db.get('orderItems').value() ?? []).filter(oi => oi.orderId === id);
    if (orderItems.length === 0) throw new Error('প্রক্রিয়া শুরু করা যাবে না: অর্ডারে কোনো পণ্য নেই।');
    const allBatches = db.get('lotBatches').value() ?? [];
    const allLots = db.get('lots').value() ?? [];
    const shortages = [];
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
  }

  // ── Inventory reconciliation at Delivery ─────────────────────────────────
  // Use the warehouse that actually has stock for each product (FIFO across warehouses).
  // Done BEFORE writing status so a stock failure keeps the order in its current state.
  if (status === 'delivered') {
    const orderItems = (db.get('orderItems').value() ?? []).filter(oi => oi.orderId === id);
    if (orderItems.length === 0) throw new Error('Delivery blocked: order has no items.');
    // Resolve best warehouse: prefer order.warehouseId if it has all stock, else pick any with stock
    const allBatches = db.get('lotBatches').value() ?? [];
    const allLots = db.get('lots').value() ?? [];
    const allWarehouses = db.get('warehouses').value() ?? [];
    // Find warehouse that satisfies all items; fall back to any warehouse with most coverage
    let resolvedWid = order.warehouseId;
    if (resolvedWid) {
      // Verify preferred warehouse has full coverage
      const hasFull = orderItems.every(oi => {
        const avail = allBatches.filter(b => b.warehouseId === resolvedWid && Number(b.remainingQuantity) > 0)
          .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === oi.productId; })
          .reduce((s, b) => s + Number(b.remainingQuantity), 0);
        return avail >= oi.quantity;
      });
      if (!hasFull) resolvedWid = null; // fall through to search
    }
    if (!resolvedWid) {
      // Find any warehouse where ALL items are available
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
