'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { ensureCollection, translateProduct } = require('../helpers');
const { persistNotification } = require('./notifications');

function getConversionFactor(productId, unitId) {
  const units = db.get('units').value() ?? [];
  const products = db.get('products').value() ?? [];
  const unit = units.find(u => u.id === unitId);
  const product = products.find(p => p.id === productId);
  if (!unit) return 1;
  if (typeof unit.globalFactor === 'number') return unit.globalFactor;
  if (product?.conversions && typeof product.conversions[unitId] === 'number') return product.conversions[unitId];
  return 1;
}

function getInventoryStockRows() {
  const lotBatches = db.get('lotBatches').value() ?? [];
  const lots = db.get('lots').value() ?? [];
  const products = db.get('products').value() ?? [];
  const warehouses = db.get('warehouses').value() ?? [];
  const units = db.get('units').value() ?? [];
  const purchases = db.get('purchases').value() ?? [];
  const purchaseItems = db.get('purchaseItems').value() ?? [];

  const purchaseByLotId = new Map();
  const purchaseItemByLotId = new Map();
  for (const pi of purchaseItems) {
    if (!pi?.lotId) continue;
    if (!purchaseItemByLotId.has(pi.lotId)) purchaseItemByLotId.set(pi.lotId, pi);
    if (purchaseByLotId.has(pi.lotId)) continue;
    const p = purchases.find(x => x.id === pi.purchaseId);
    if (p) purchaseByLotId.set(pi.lotId, p);
  }

  const rows = [];
  for (const b of lotBatches) {
    const rem = Number(b.remainingQuantity);
    if (!Number.isFinite(rem) || rem <= 0) continue;
    const lot = lots.find(l => l.id === b.lotId);
    if (!lot) continue;
    const p = products.find(x => x.id === lot.productId);
    const w = warehouses.find(x => x.id === b.warehouseId);
    const unitLabel = (p?.unitId && units.find(u => u.id === p.unitId)?.label) || p?.unit || '';
    rows.push({
      id: b.id, batchLotId: b.lotId, lotId: b.lotId, lotNumber: lot.lotNumber,
      productId: lot.productId, productName: p?.name ?? 'Product',
      unit: unitLabel, warehouseId: b.warehouseId, warehouseName: w?.name ?? 'Warehouse',
      quantityOnHand: rem, unitCost: Number(b.unitCost) || 0,
      acquiredAt: b.acquiredAt,
      purchaseDate: purchaseByLotId.get(b.lotId)?.purchaseDate || b.acquiredAt,
      purchaseNotes: b.notes || purchaseItemByLotId.get(b.lotId)?.notes || purchaseByLotId.get(b.lotId)?.notes || '',
    });
  }
  rows.sort((a, b2) => {
    const w = String(a.warehouseName).localeCompare(String(b2.warehouseName));
    if (w !== 0) return w;
    const p = String(a.productName).localeCompare(String(b2.productName));
    if (p !== 0) return p;
    return String(a.lotNumber).localeCompare(String(b2.lotNumber));
  });
  return rows;
}

function createPurchase({ actor, userId, input }) {
  if (actor.role !== 'admin' && actor.role !== 'sales') throw new Error('Forbidden');
  const { warehouseId, purchaseDate, notes, items } = input || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) throw new Error('Missing warehouseId or items');
  const warehouses = db.get('warehouses').value() ?? [];
  if (!warehouses.some(w => w.id === warehouseId)) throw new Error('Unknown warehouse');
  const products = db.get('products').value() ?? [];
  const dateStr = typeof purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? purchaseDate : new Date().toISOString().slice(0, 10);
  const createdLines = [];
  for (const it of items) {
    if (!it?.productId) continue;
    const qty = Number(it.quantity);
    const uc = Number(it.unitCost);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(uc) || uc < 0) continue;
    if (!products.some(p => p.id === it.productId)) continue;
    createdLines.push({ productId: it.productId, quantity: qty, unitCost: uc, baseUnitCost: Number(it.baseUnitCost) || uc, notes: it.notes != null ? String(it.notes).trim() : '', lotNumber: it.lotNumber ? String(it.lotNumber).trim() : null, unitId: it.unitId });
  }
  if (createdLines.length === 0) throw new Error('No valid line items');

  const purchaseId = crypto.randomUUID();
  db.get('purchases').push({ id: purchaseId, purchaseDate: dateStr, warehouseId, createdBy: userId, notes: notes != null ? String(notes) : '' }).write();

  for (const cl of createdLines) {
    const lotId = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const lotNumber = cl.lotNumber || `RCV-${dateStr}-${String(cl.productId).slice(-6)}-${String(batchId).slice(0, 4)}`;
    db.get('lots').push({ id: lotId, productId: cl.productId, lotNumber }).write();
    db.get('purchaseItems').push({ id: crypto.randomUUID(), purchaseId, productId: cl.productId, lotId, quantity: cl.quantity, unitCost: cl.unitCost, baseUnitCost: cl.baseUnitCost, notes: cl.notes }).write();
    const cFactor = getConversionFactor(cl.productId, cl.unitId);
    db.get('lotBatches').push({ id: batchId, lotId, warehouseId, acquiredAt: dateStr, unitCost: cl.unitCost, baseUnitCost: cl.baseUnitCost, notes: cl.notes, originalQuantity: cl.quantity * cFactor, remainingQuantity: cl.quantity * cFactor }).write();
  }
  return { ok: true, purchaseId };
}

function createInventoryTransfer({ actor, userId, input }) {
  if (actor.role !== 'admin') throw new Error('Only admins can transfer stock');
  const { fromWarehouseId, toWarehouseId, transferDate, notes, lines } = input || {};
  if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) throw new Error('Invalid warehouses');
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('Missing lines');
  const warehouses = db.get('warehouses').value() ?? [];
  if (!warehouses.some(w => w.id === fromWarehouseId)) throw new Error('Unknown from warehouse');
  if (!warehouses.some(w => w.id === toWarehouseId)) throw new Error('Unknown to warehouse');
  const products = db.get('products').value() ?? [];
  const dateStr = typeof transferDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(transferDate) ? transferDate : new Date().toISOString().slice(0, 10);
  const normalizedLines = lines.filter(l => l?.productId && products.some(p => p.id === l.productId) && Number(l.quantity) > 0).map(l => ({ productId: l.productId, quantity: Number(l.quantity) }));
  if (normalizedLines.length === 0) throw new Error('No valid lines');

  ensureCollection('inventoryTransfers', []);
  ensureCollection('inventoryTransferLines', []);
  const transferId = crypto.randomUUID();
  db.get('inventoryTransfers').push({ id: transferId, transferDate: dateStr, fromWarehouseId, toWarehouseId, createdBy: userId, notes: notes != null ? String(notes) : '' }).write();

  for (const nl of normalizedLines) {
    const freshBatches = db.get('lotBatches').value() ?? [];
    const freshLots = db.get('lots').value() ?? [];
    const candidates = freshBatches
      .filter(b => b.warehouseId === fromWarehouseId && Number(b.remainingQuantity) > 0)
      .map(b => ({ b, lot: freshLots.find(l => l.id === b.lotId) }))
      .filter(x => x.lot?.productId === nl.productId)
      .sort((a, b) => String(a.b.acquiredAt).localeCompare(String(b.b.acquiredAt)));

    let remaining = nl.quantity;
    const moves = [];
    for (const { b } of candidates) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(b.remainingQuantity));
      moves.push({ batchId: b.id, take, unitCost: Number(b.unitCost), lotId: b.lotId });
      remaining -= take;
    }
    if (remaining > 0) throw new Error(`Insufficient stock for ${products.find(p => p.id === nl.productId)?.name ?? nl.productId}`);

    for (const m of moves) {
      const row = db.get('lotBatches').find({ id: m.batchId }).value();
      if (!row) continue;
      db.get('lotBatches').find({ id: m.batchId }).assign({ remainingQuantity: Number(row.remainingQuantity) - m.take }).write();
      db.get('lotBatches').push({ id: crypto.randomUUID(), lotId: m.lotId, warehouseId: toWarehouseId, acquiredAt: dateStr, unitCost: m.unitCost, originalQuantity: m.take, remainingQuantity: m.take }).write();
      db.get('inventoryTransferLines').push({ id: crypto.randomUUID(), transferId, productId: nl.productId, lotId: m.lotId, quantity: m.take }).write();
    }
  }

  // Check depleted lots
  const movedLotIds = new Set((db.get('inventoryTransferLines').value() ?? []).filter(l => l.transferId === transferId).map(l => l.lotId).filter(Boolean));
  for (const lid of movedLotIds) {
    const total = (db.get('lotBatches').value() ?? []).filter(b => b.lotId === lid).reduce((s, b) => s + Number(b.remainingQuantity), 0);
    if (total === 0 && !(db.get('notifications').value() ?? []).find(n => n.type === 'lot_depleted' && n.lotId === lid)) {
      const lot = db.get('lots').find({ id: lid }).value();
      const prod = db.get('products').find({ id: lot?.productId }).value();
      persistNotification({ id: crypto.randomUUID(), type: 'lot_depleted', lotId: lid, title: 'লট সম্পূর্ণ বিক্রিত', body: `ইনভেন্টরি অ্যালার্ট: লট ${lot?.lotNumber} (${translateProduct(prod?.name)}) নিঃশেষ হয়েছে।`, createdAt: new Date().toISOString(), actorUserId: userId, readByUserIds: [] });
    }
  }
  return { ok: true, transferId };
}

module.exports = { getConversionFactor, getInventoryStockRows, createPurchase, createInventoryTransfer };
