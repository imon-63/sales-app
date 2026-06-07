'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { ensureCollection } = require('../helpers');

function createUnit({ actor, label }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) throw new Error('Forbidden');
  const trimmed = String(label ?? '').trim();
  if (!trimmed) throw new Error('Label required');
  ensureCollection('units', []);
  const row = { id: crypto.randomUUID(), label: trimmed };
  db.get('units').push(row).write();
  return row;
}
function updateUnit({ actor, id, label }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const trimmed = String(label ?? '').trim();
  if (!trimmed) throw new Error('Label required');
  const row = db.get('units').find({ id }).value();
  if (!row) throw new Error('Unit not found');
  db.get('units').find({ id }).assign({ label: trimmed }).write();
  return { ...row, label: trimmed };
}
function deleteUnit({ actor, id }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  db.get('units').remove({ id }).write();
  return true;
}

function createCurrency({ actor, code }) {
  if (!actor || (actor.role !== 'sales' && actor.role !== 'admin')) throw new Error('Forbidden');
  const raw = String(code ?? '').trim().toUpperCase();
  if (!raw || raw.length > 8) throw new Error('Valid currency code required');
  ensureCollection('currencies', []);
  const existing = db.get('currencies').value() ?? [];
  if (existing.some(c => String(c.code).toUpperCase() === raw)) throw new Error('Currency already exists');
  const row = { id: crypto.randomUUID(), code: raw };
  db.get('currencies').push(row).write();
  return row;
}
function updateCurrency({ actor, id, code }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const raw = String(code ?? '').trim().toUpperCase();
  if (!raw || raw.length > 8) throw new Error('Valid code required');
  const row = db.get('currencies').find({ id }).value();
  if (!row) throw new Error('Currency not found');
  db.get('currencies').find({ id }).assign({ code: raw }).write();
  return { ...row, code: raw };
}
function deleteCurrency({ actor, id }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  db.get('currencies').remove({ id }).write();
  return true;
}

function createWarehouse({ actor, name }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Name required');
  ensureCollection('warehouses', []);
  const row = { id: crypto.randomUUID(), name: trimmed };
  db.get('warehouses').push(row).write();
  return row;
}
function updateWarehouse({ actor, id, name }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Name required');
  const row = db.get('warehouses').find({ id }).value();
  if (!row) throw new Error('Warehouse not found');
  db.get('warehouses').find({ id }).assign({ name: trimmed }).write();
  return { ...row, name: trimmed };
}
function deleteWarehouse({ actor, id }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  db.get('warehouses').remove({ id }).write();
  return true;
}

function createProduct({ actor, name, unitId }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const n = String(name ?? '').trim();
  if (!n) throw new Error('Name required');
  ensureCollection('products', []);
  const row = { id: crypto.randomUUID(), name: n, unitId: String(unitId) };
  db.get('products').push(row).write();
  return row;
}
function updateProduct({ actor, id, name, unitId }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  const n = String(name ?? '').trim();
  if (!n) throw new Error('Name required');
  const row = db.get('products').find({ id }).value();
  if (!row) throw new Error('Product not found');
  db.get('products').find({ id }).assign({ name: n, unitId: String(unitId) }).write();
  return { ...row, name: n, unitId: String(unitId) };
}
function deleteProduct({ actor, id }) {
  if (!actor || actor.role !== 'admin') throw new Error('Admin only');
  db.get('products').remove({ id }).write();
  return true;
}

module.exports = {
  createUnit, updateUnit, deleteUnit,
  createCurrency, updateCurrency, deleteCurrency,
  createWarehouse, updateWarehouse, deleteWarehouse,
  createProduct, updateProduct, deleteProduct,
};
