'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { ensureCollection, translateProduct } = require('../helpers');
const { persistNotification } = require('./notifications');
const { getConversionFactor } = require('./inventory');

function createSale({ actor, userId, input }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) throw new Error('Forbidden');
  const { warehouseId, notes, items, saleDate } = input || {};
  if (!warehouseId || !Array.isArray(items) || items.length === 0) throw new Error('Missing warehouseId or items');
  const warehouses = db.get('warehouses').value() ?? [];
  if (!warehouses.some(w => w.id === warehouseId)) throw new Error('Unknown warehouse');
  const products = db.get('products').value() ?? [];
  const currencies = db.get('currencies').value() ?? [];
  const defaultCurrencyId = currencies[0]?.id;
  if (!defaultCurrencyId) throw new Error('No currencies configured');
  const saleId = crypto.randomUUID();
  const dateStr = typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate) ? saleDate : new Date().toISOString().slice(0, 10);

  const createdItems = items
    .filter(it => it?.productId && products.some(p => p.id === it.productId))
    .map(it => {
      const qty = Number(it.quantity); const price = Number(it.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) return null;
      const currencyId = it.currencyId && currencies.some(c => c.id === it.currencyId) ? it.currencyId : defaultCurrencyId;
      const lotIds = Array.isArray(it.lotIds) ? [...new Set(it.lotIds.map(x => String(x || '').trim()).filter(Boolean))] : [];
      return { id: crypto.randomUUID(), saleId, productId: it.productId, quantity: qty, unitPrice: price, currencyId, unitId: it.unitId, lotIds, bottleBreakdown: it.bottleBreakdown ?? null };
    }).filter(Boolean);
  if (createdItems.length === 0) throw new Error('No valid line items');

  // Stock availability check
  const allBatches = db.get('lotBatches').value() ?? [];
  const allLots = db.get('lots').value() ?? [];
  for (const line of createdItems) {
    const needed = line.quantity * getConversionFactor(line.productId, line.unitId);
    const lotSet = line.lotIds?.length ? new Set(line.lotIds) : null;
    const avail = allBatches
      .filter(b => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter(b => { const lot = allLots.find(l => l.id === b.lotId); return lot?.productId === line.productId && (!lotSet || lotSet.has(lot.id)); })
      .reduce((s, b) => s + Number(b.remainingQuantity), 0);
    if (needed > avail) { const p = products.find(x => x.id === line.productId); throw new Error(`Insufficient stock for ${p?.name || 'product'}. Available: ${avail}, Needed: ${needed}`); }
  }

  const sale = { id: saleId, saleDate: dateStr, warehouseId, createdBy: userId, notes: notes != null ? String(notes) : '' };
  db.get('sales').push(sale).write();
  ensureCollection('salesItemAllocations', []);

  for (const line of createdItems) {
    db.get('salesItems').push(line).write();
    const candidates = (db.get('lotBatches').value() ?? [])
      .filter(b => b.warehouseId === warehouseId && Number(b.remainingQuantity) > 0)
      .filter(b => { const lot = (db.get('lots').value() ?? []).find(l => l.id === b.lotId); return lot?.productId === line.productId && (!line.lotIds?.length || line.lotIds.includes(lot.id)); })
      .sort((a, b) => line.lotIds?.length ? (line.lotIds.indexOf(a.lotId) - line.lotIds.indexOf(b.lotId)) || String(a.acquiredAt).localeCompare(String(b.acquiredAt)) : String(a.acquiredAt).localeCompare(String(b.acquiredAt)));

    // Build per-lot quantity cap from explicit allocations (set at processing time)
    const lotQtyCap = {}; // lotId → remaining to take from this lot
    if (line.lotAllocations) {
      try {
        const allocs = typeof line.lotAllocations === 'string' ? JSON.parse(line.lotAllocations) : line.lotAllocations;
        if (Array.isArray(allocs)) {
          for (const a of allocs) { if (a.lotId && Number(a.quantity) > 0) lotQtyCap[a.lotId] = Number(a.quantity); }
        }
      } catch {}
    }
    const hasAllocations = Object.keys(lotQtyCap).length > 0;

    let rem = line.quantity * getConversionFactor(line.productId, line.unitId);
    for (const batch of candidates) {
      if (rem <= 0) break;
      const lot = (db.get('lots').value() ?? []).find(l => l.id === batch.lotId);
      if (!lot) continue;
      // If explicit allocation: skip lots not in the cap, and cap how much we take from each
      if (hasAllocations && lotQtyCap[lot.id] === undefined) continue;
      const lotCap = hasAllocations ? (lotQtyCap[lot.id] ?? 0) : Infinity;
      if (lotCap <= 0) continue;
      const take = Math.min(rem, Number(batch.remainingQuantity), lotCap);
      if (take <= 0) continue;
      db.get('lotBatches').find({ id: batch.id }).assign({ remainingQuantity: Number(batch.remainingQuantity) - take }).write();
      db.get('salesItemAllocations').push({ id: crypto.randomUUID(), salesItemId: line.id, lotBatchId: batch.id, quantityAllocated: take, unitCostAtTime: Number(batch.unitCost) }).write();
      rem -= take;
      if (hasAllocations) lotQtyCap[lot.id] = (lotQtyCap[lot.id] ?? 0) - take;
    }
    if (rem > 0) throw new Error(`Insufficient stock in selected lot order for ${products.find(p => p.id === line.productId)?.name || 'product'}`);
  }

  // Notification
  const linesSummary = createdItems.map(li => {
    const p = products.find(x => x.id === li.productId);
    const units = db.get('units').value() ?? [];
    const unit = (p?.unitId && units.find(u => u.id === p.unitId)?.label) || p?.unit || '';
    let bottleSummary = '';
    if (li.bottleBreakdown) {
      try {
        const bd = JSON.parse(li.bottleBreakdown);
        if (Array.isArray(bd) && bd.length > 0) {
          bottleSummary = ' [' + bd.map(b => `${b.count}×${b.sizeLiter}L`).join(' + ') + ']';
        }
      } catch {}
    }
    return `${p?.name ?? 'Item'} ×${li.quantity}${unit ? ' ' + unit : ''}${bottleSummary} @ ${currencies.find(c => c.id === li.currencyId)?.code ?? 'BDT'} ${Number(li.unitPrice).toFixed(2)}`;
  }).join(' · ');
  persistNotification({ id: crypto.randomUUID(), type: 'sale_created', saleId, title: 'নতুন বিক্রয় রেকর্ড', body: `${actor.email} · ${warehouses.find(w => w.id === warehouseId)?.name ?? 'গুদাম'} · ${dateStr} · ${linesSummary}`, createdAt: new Date().toISOString(), actorUserId: userId, readByUserIds: [] });

  // Depleted lot check
  const allAllocs = db.get('salesItemAllocations').value() ?? [];
  const usedLotIds = new Set(createdItems.flatMap(li => allAllocs.filter(a => a.salesItemId === li.id).map(a => (db.get('lotBatches').find({ id: a.lotBatchId }).value() || {}).lotId).filter(Boolean)));
  for (const lid of usedLotIds) {
    const total = (db.get('lotBatches').value() ?? []).filter(b => b.lotId === lid).reduce((s, b) => s + Number(b.remainingQuantity), 0);
    if (total === 0 && !(db.get('notifications').value() ?? []).find(n => n.type === 'lot_depleted' && n.lotId === lid)) {
      const lot = db.get('lots').find({ id: lid }).value();
      const prod = products.find(p => p.id === lot?.productId);
      persistNotification({ id: crypto.randomUUID(), type: 'lot_depleted', lotId: lid, title: 'লট সম্পূর্ণ বিক্রিত', body: `ইনভেন্টরি অ্যালার্ট: লট ${lot?.lotNumber} (${translateProduct(prod?.name)}) নিঃশেষ হয়েছে।`, createdAt: new Date().toISOString(), actorUserId: userId, readByUserIds: [] });
    }
  }
  return { sale, items: createdItems };
}

module.exports = { createSale };
