'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { ensureCollection } = require('../helpers');
const { persistNotification } = require('./notifications');

const BD = '০১২৩৪৫৬৭৮৯';
function bNum(n, pad = 2) { return String(n).padStart(pad, '0').split('').map(d => BD[Number(d)]).join(''); }
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
function bengaliProductionNumber() {
  const now = new Date();
  ensureCollection('productions', []);
  const count = (db.get('productions').value() ?? []).length + 1;
  return `উৎপা-${bNum(now.getDate())}-${BN_MONTHS[now.getMonth()]}-${bNum(count, 3)}`;
}

// ── Create production order ────────────────────────────────────────────────────
function createProduction({ actor, userId, input }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const { inputLotBatchId, inputQuantity, outputProductId, expectedOutputQty, processingCostPerUnit, extraCosts, notes, orderDate } = input || {};
  if (!inputLotBatchId || !outputProductId) throw new Error('inputLotBatchId and outputProductId required');
  const qty = Number(inputQuantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Valid inputQuantity required');

  // Validate lot batch
  const batch = db.get('lotBatches').find({ id: inputLotBatchId }).value();
  if (!batch) throw new Error('Input lot batch not found');
  if (Number(batch.remainingQuantity) < qty) throw new Error(`Insufficient stock. Available: ${batch.remainingQuantity}`);

  // Validate output product
  const outProd = db.get('products').find({ id: outputProductId }).value();
  if (!outProd) throw new Error('Output product not found');

  ensureCollection('productions', []);
  const id = crypto.randomUUID();
  const dateStr = typeof orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(orderDate) ? orderDate : new Date().toISOString().slice(0, 10);

  const prod = {
    id,
    productionNumber: bengaliProductionNumber(),
    status: 'draft',
    orderDate: dateStr,
    startDate: null,
    completedDate: null,
    cancelDate: null,
    inputLotBatchId,
    inputQuantity: qty,
    processingCostPerUnit: Number(processingCostPerUnit) || 0,
    // Stored as JSON string so GraphQL's String type resolves cleanly
    extraCosts: JSON.stringify(Array.isArray(extraCosts) ? extraCosts.map(e => ({ label: String(e.label || ''), amount: Number(e.amount) || 0 })) : []),
    outputProductId,
    expectedOutputQty: Number(expectedOutputQty) || null,
    actualOutputQty: null,
    effectiveCostPerOutputUnit: null,
    outputLotBatchId: null,
    cancelReason: null,
    notes: notes ? String(notes).trim() : null,
    createdBy: userId,
  };
  db.get('productions').push(prod).write();
  return prod;
}

// ── Update production details (while draft) ───────────────────────────────────
function updateProduction({ actor, userId, id, input }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const prod = db.get('productions').find({ id }).value();
  if (!prod) throw new Error('Production not found');
  if (!['draft'].includes(prod.status)) throw new Error('Can only edit draft productions');

  const allowed = ['inputQuantity', 'processingCostPerUnit', 'expectedOutputQty', 'notes', 'orderDate'];
  const patch = {};
  for (const k of allowed) { if (input[k] !== undefined) patch[k] = input[k]; }
  if (input.extraCosts !== undefined) {
    patch.extraCosts = JSON.stringify(Array.isArray(input.extraCosts) ? input.extraCosts.map(e => ({ label: String(e.label || ''), amount: Number(e.amount) || 0 })) : []);
  }
  db.get('productions').find({ id }).assign(patch).write();
  return db.get('productions').find({ id }).value();
}

// ── Advance status ─────────────────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function updateProductionStatus({ actor, userId, id, status, actualOutputQty, cancelReason, bottlePrices }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const prod = db.get('productions').find({ id }).value();
  if (!prod) throw new Error('Production not found');
  if (!VALID_TRANSITIONS[prod.status]?.includes(status)) throw new Error(`Cannot move from ${prod.status} to ${status}`);

  const patch = { status };
  const now = new Date().toISOString().slice(0, 10);

  if (status === 'in_progress') {
    patch.startDate = now;
    // Deduct input stock
    const batch = db.get('lotBatches').find({ id: prod.inputLotBatchId }).value();
    if (!batch) throw new Error('Input lot batch not found');
    if (Number(batch.remainingQuantity) < prod.inputQuantity) throw new Error(`Insufficient stock. Available: ${batch.remainingQuantity}`);
    db.get('lotBatches').find({ id: prod.inputLotBatchId }).assign({ remainingQuantity: Number(batch.remainingQuantity) - prod.inputQuantity }).write();

    // Record consumption so lot history shows WHY the quantity was deducted
    ensureCollection('productionConsumptions', []);
    db.get('productionConsumptions').push({
      id: crypto.randomUUID(),
      productionId: id,
      productionNumber: prod.productionNumber,
      lotBatchId: prod.inputLotBatchId,
      quantity: prod.inputQuantity,
      consumedAt: now,
      createdBy: userId,
    }).write();
  }

  if (status === 'completed') {
    const outQty = Number(actualOutputQty);
    if (!Number.isFinite(outQty) || outQty <= 0) throw new Error('actualOutputQty required for completion');
    patch.completedDate = now;
    patch.actualOutputQty = outQty;
    if (bottlePrices) patch.bottlePrices = bottlePrices;

    // Calculate effective cost per output unit
    const inputBatch = db.get('lotBatches').find({ id: prod.inputLotBatchId }).value();
    const inputUnitCost = Number(inputBatch?.unitCost ?? 0);
    const totalInputCost = prod.inputQuantity * inputUnitCost;
    const processingCost = prod.inputQuantity * (Number(prod.processingCostPerUnit) || 0);
    const parsedExtras = (() => { try { return JSON.parse(prod.extraCosts || '[]'); } catch { return []; } })();
    const extraTotal = parsedExtras.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalCost = totalInputCost + processingCost + extraTotal;
    const effectiveCostPerUnit = outQty > 0 ? totalCost / outQty : 0;
    patch.effectiveCostPerOutputUnit = effectiveCostPerUnit;

    // Check depleted lot
    const inputBatchAfter = db.get('lotBatches').find({ id: prod.inputLotBatchId }).value();
    const inputLot = db.get('lots').find({ id: inputBatchAfter?.lotId }).value();
    if (inputLot) {
      const lotTotal = (db.get('lotBatches').value() ?? []).filter(b => b.lotId === inputLot.id).reduce((s, b) => s + Number(b.remainingQuantity), 0);
      if (lotTotal === 0 && !(db.get('notifications').value() ?? []).find(n => n.type === 'lot_depleted' && n.lotId === inputLot.id)) {
        const inProd = db.get('products').find({ id: inputLot.productId }).value();
        persistNotification({ id: crypto.randomUUID(), type: 'lot_depleted', lotId: inputLot.id, title: 'লট সম্পূর্ণ ব্যবহৃত', body: `উৎপাদনে ব্যবহারের পর লট ${inputLot.lotNumber} (${inProd?.name || 'পণ্য'}) নিঃশেষ হয়েছে।`, createdAt: new Date().toISOString(), actorUserId: userId, readByUserIds: [] });
      }
    }

    // Create output lot + batch
    const outLotId = crypto.randomUUID();
    const outBatchId = crypto.randomUUID();
    const outLotNum = `উৎ-${prod.productionNumber}`;
    db.get('lots').push({ id: outLotId, productId: prod.outputProductId, lotNumber: outLotNum }).write();
    db.get('lotBatches').push({
      id: outBatchId, lotId: outLotId,
      warehouseId: (db.get('lotBatches').find({ id: prod.inputLotBatchId }).value() || {}).warehouseId,
      acquiredAt: now, unitCost: effectiveCostPerUnit, baseUnitCost: effectiveCostPerUnit,
      notes: `উৎপাদন: ${prod.productionNumber}`,
      originalQuantity: outQty, remainingQuantity: outQty,
    }).write();
    patch.outputLotBatchId = outBatchId;
  }

  if (status === 'cancelled') {
    patch.cancelDate = now;
    patch.cancelReason = cancelReason ?? null;
    // If was in_progress, restore the reserved input stock and remove consumption record
    if (prod.status === 'in_progress') {
      const b = db.get('lotBatches').find({ id: prod.inputLotBatchId }).value();
      if (b) db.get('lotBatches').find({ id: prod.inputLotBatchId }).assign({ remainingQuantity: Number(b.remainingQuantity) + prod.inputQuantity }).write();
      // Remove the consumption record (stock was returned)
      db.get('productionConsumptions').remove({ productionId: id }).write();
    }
  }

  db.get('productions').find({ id }).assign(patch).write();
  return db.get('productions').find({ id }).value();
}

function listProductions({ actor }) {
  if (!actor) throw new Error('Unauthorized');
  // All authenticated users can read productions (creation/editing remains admin-only)
  ensureCollection('productions', []);
  return (db.get('productions').value() ?? []).sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
}

function deleteProduction({ actor, id }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const prod = db.get('productions').find({ id }).value();
  if (!prod) throw new Error('Production not found');
  if (prod.status !== 'cancelled') throw new Error('Only cancelled productions can be deleted');
  db.get('productions').remove({ id }).write();
  db.get('productionConsumptions').remove({ productionId: id }).write();
  return true;
}

function listConsumptionsForLot({ lotId }) {
  ensureCollection('productionConsumptions', []);
  const batchIds = new Set((db.get('lotBatches').value() ?? []).filter(b => b.lotId === lotId).map(b => b.id));
  return (db.get('productionConsumptions').value() ?? []).filter(c => batchIds.has(c.lotBatchId));
}

module.exports = { createProduction, updateProduction, updateProductionStatus, deleteProduction, listProductions, listConsumptionsForLot };
