'use strict';
const crypto = require('crypto');
const { db } = require('./db');

// ── Bengali digit helpers ─────────────────────────────────────────────────────
const BD = '০১২৩৪৫৬৭৮৯';
function toBengali(n, pad = 2) {
  return String(n).padStart(pad, '0').split('').map(d => BD[Number(d)]).join('');
}
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
function bengaliLotNumber() {
  const now = new Date();
  return `ব্যাচ-${toBengali(now.getDate())}-${BN_MONTHS[now.getMonth()]}-${toBengali(Math.floor(Math.random() * 999) + 1, 3)}`;
}

// ── User helpers ──────────────────────────────────────────────────────────────
function getUsers() { return db.get('users').value() ?? []; }
function findUserByEmail(email) {
  const em = String(email).trim().toLowerCase();
  return getUsers().find(u => String(u.email).toLowerCase() === em);
}
function findUserById(id) { return getUsers().find(u => u.id === id); }

function parseBearerUserIdFromHeader(authorization) {
  const authz = String(authorization || '');
  const match = authz.match(/^Bearer\s+demo-token-(.+)$/i);
  return match?.[1] ?? null;
}
function parseBearerUserId(req) {
  return parseBearerUserIdFromHeader(req?.headers?.authorization);
}

function publicUser(user) {
  if (!user) return null;
  const { password: _pw, ...rest } = user;
  return rest;
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function ensureCollection(name, fallback = []) {
  const cur = db.get(name).value();
  if (!Array.isArray(cur)) db.set(name, fallback).write();
}
function ensureNotificationsArray() { ensureCollection('notifications', []); }

// ── Auth ──────────────────────────────────────────────────────────────────────
function requireAuth(ctx) {
  const userId = parseBearerUserId(ctx?.req || {});
  if (!userId) throw new Error('Unauthorized');
  const actor = findUserById(userId);
  if (!actor) throw new Error('User not found');
  return { userId, actor };
}
function getAuthFromContext(ctx) {
  if (ctx?.userId && ctx?.actor) return { userId: ctx.userId, actor: ctx.actor };
  return requireAuth(ctx);
}

// ── Product translation ───────────────────────────────────────────────────────
const PRODUCT_TRANSLATIONS_BN = { 'Wheat': 'গম', 'Rice': 'চাল', 'Rice Bag': 'চালের বস্তা', 'Corn': 'ভুট্টা', 'Mastard': 'সরিষা', 'Potato': 'আলু' };
function translateProduct(name) { return PRODUCT_TRANSLATIONS_BN[name] || name || 'পণ্য'; }

module.exports = {
  crypto, toBengali, bengaliLotNumber,
  getUsers, findUserByEmail, findUserById,
  parseBearerUserIdFromHeader, parseBearerUserId, publicUser,
  ensureCollection, ensureNotificationsArray,
  requireAuth, getAuthFromContext, translateProduct,
};
