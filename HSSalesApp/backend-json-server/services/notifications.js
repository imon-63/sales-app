'use strict';
const { db } = require('../db');
const { findUserById, ensureNotificationsArray } = require('../helpers');
const { notificationEvents, NOTIFICATION_CREATED_TOPIC } = require('../events');
const { broadcastToAll } = require('../live');

function withUnreadForUser(notification, userId) {
  return { ...notification, unread: userId ? !(notification.readByUserIds || []).includes(userId) : false };
}

function persistNotification(notification) {
  ensureNotificationsArray();
  db.get('notifications').push(notification).write();
  notificationEvents.emit(NOTIFICATION_CREATED_TOPIC, notification);
  // Push immediately to all live WebSocket clients — no polling needed
  broadcastToAll({ type: 'notification_created', notification });
  return notification;
}

function listAdminNotifications(userId) {
  const actor = findUserById(userId);
  if (!actor) throw new Error('Unauthorized');
  ensureNotificationsArray();
  const all = db.get('notifications').value() ?? [];
  // Sales users see only order_created notifications; admins see everything
  const filtered = actor.role === 'admin'
    ? all
    : all.filter(n => n.type === 'order_created');
  return filtered
    .map(n => ({ ...n, unread: !(n.readByUserIds || []).includes(userId) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function markNotificationRead({ userId, id }) {
  const actor = findUserById(userId);
  if (!actor) throw new Error('Unauthorized');
  // Admin can mark any notification; sales can only mark order_created notifications
  ensureNotificationsArray();
  const found = db.get('notifications').find({ id }).value();
  if (!found) return false;
  if (actor.role !== 'admin' && found.type !== 'order_created') return false;
  const readers = Array.isArray(found.readByUserIds) ? found.readByUserIds : [];
  if (!readers.includes(userId)) {
    db.get('notifications').find({ id }).assign({ readByUserIds: [...readers, userId] }).write();
  }
  // Tell all live clients which user read which notification
  broadcastToAll({ type: 'notification_read', id, userId });
  return true;
}

module.exports = { withUnreadForUser, persistNotification, listAdminNotifications, markNotificationRead };
