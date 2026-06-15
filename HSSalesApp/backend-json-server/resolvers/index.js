'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { parseBearerUserId, findUserById, publicUser, getAuthFromContext, ensureCollection } = require('../helpers');
const { createTopicAsyncIterator, NOTIFICATION_CREATED_TOPIC } = require('../events');
const { withUnreadForUser, listAdminNotifications, markNotificationRead, persistNotification } = require('../services/notifications');
const { getInventoryStockRows, createPurchase, addLotTranche, createInventoryTransfer } = require('../services/inventory');
const { createSale, addSalePayment } = require('../services/sales');
const { createSalesUser } = require('../services/users');
const { createUnit, updateUnit, deleteUnit, createCurrency, updateCurrency, deleteCurrency, createWarehouse, updateWarehouse, deleteWarehouse, createProduct, updateProduct, deleteProduct } = require('../services/catalog');
const { createOrder, updateOrder, updateOrderStatus, deleteOrder, listOrders, addOrderPayment, listPaymentsForOrder } = require('../services/orders');
const { createProduction, updateProduction, updateProductionStatus, deleteProduction, listProductions, listConsumptionsForLot } = require('../services/production');

function login({ email, password }) {
  if (!email || !password) throw new Error('Missing email/password');
  const user = require('../helpers').findUserByEmail(email);
  if (!user || user.password !== password) throw new Error('Invalid credentials');
  return { token: `demo-token-${user.id}`, user: publicUser(user) };
}

const resolvers = {
  Query: {
    me: (_p, _a, ctx) => publicUser(findUserById(parseBearerUserId(ctx?.req || {}))),
    users: () => (db.get('users').value() ?? []).map(publicUser),
    units: () => db.get('units').value() ?? [],
    currencies: () => db.get('currencies').value() ?? [],
    products: () => db.get('products').value() ?? [],
    warehouses: () => db.get('warehouses').value() ?? [],
    sales: () => {
      const allSales = db.get('sales').value() ?? [];
      ensureCollection('orderPayments', []);
      const allOrders = db.get('orders').value() ?? [];
      const allOrderPayments = db.get('orderPayments').value() ?? [];
      return allSales.map(sale => {
        if (!sale.orderId) return sale;
        const order = allOrders.find(o => o.id === sale.orderId);
        if (!order) return sale;
        const orderPaid = (order.advancePaid ?? 0) + allOrderPayments.filter(p => p.orderId === sale.orderId && p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0);
        const effectivePaid = Math.max(Number(sale.paidAmount) || 0, orderPaid);
        if (effectivePaid === (Number(sale.paidAmount) || 0)) return sale;
        const totalAmount = Number(sale.totalAmount) || 0;
        const paymentStatus = effectivePaid >= totalAmount ? 'paid' : effectivePaid > 0 ? 'partial' : 'due';
        return { ...sale, paidAmount: effectivePaid, paymentStatus };
      });
    },
    salesItems: () => db.get('salesItems').value() ?? [],
    notifications: (_p, _a, ctx) => { const { userId } = getAuthFromContext(ctx); return listAdminNotifications(userId); },
    inventoryStock: (_p, _a, ctx) => { getAuthFromContext(ctx); return getInventoryStockRows(); },
    lots: () => db.get('lots').value() ?? [],
    lotBatches: () => db.get('lotBatches').value() ?? [],
    lotPurchaseLogs: () => { ensureCollection('lotPurchaseLogs', []); return db.get('lotPurchaseLogs').value() ?? []; },
    salesItemAllocations: () => db.get('salesItemAllocations').value() ?? [],
    inventoryTransfers: () => db.get('inventoryTransfers').value() ?? [],
    inventoryTransferLines: () => db.get('inventoryTransferLines').value() ?? [],
    orders: (_p, _a, ctx) => { const { actor } = getAuthFromContext(ctx); return listOrders({ actor }); },
    orderItems: (_p, _a, ctx) => { const { actor } = getAuthFromContext(ctx); const orders = listOrders({ actor }); const ids = new Set(orders.map(o => o.id)); return (db.get('orderItems').value() ?? []).filter(oi => ids.has(oi.orderId)); },
    orderPayments: (_p, { orderId }, ctx) => {
      const { actor, userId } = getAuthFromContext(ctx);
      if (orderId) return listPaymentsForOrder({ actor, userId, orderId });
      // No orderId — return all payments for orders accessible to this user
      const orders = listOrders({ actor });
      const orderIds = new Set(orders.map(o => o.id));
      ensureCollection('orderPayments', []);
      return (db.get('orderPayments').value() ?? []).filter(p => orderIds.has(p.orderId));
    },
    salePayments: (_p, { saleId }, ctx) => {
      const { actor, userId } = getAuthFromContext(ctx);
      ensureCollection('salePayments', []);
      const all = db.get('salePayments').value() ?? [];
      if (actor.role === 'admin') return saleId ? all.filter(p => p.saleId === saleId) : all;
      const mySaleIds = new Set((db.get('sales').value() ?? []).filter(s => s.createdBy === userId).map(s => s.id));
      return (saleId ? all.filter(p => p.saleId === saleId) : all).filter(p => mySaleIds.has(p.saleId));
    },
    productions: (_p, _a, ctx) => { const { actor } = getAuthFromContext(ctx); return listProductions({ actor }); },
    productionConsumptionsForLot: (_p, { lotId }, ctx) => { getAuthFromContext(ctx); return listConsumptionsForLot({ lotId }); },
  },

  Mutation: {
    login: (_p, { email, password }) => login({ email, password }),
    createSalesUser: (_p, { input }, ctx) => { const { actor } = getAuthFromContext(ctx); return createSalesUser({ actor, input }); },
    createSale: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return createSale({ actor, userId, input }); },
    markNotificationRead: (_p, { id }, ctx) => { const { userId } = getAuthFromContext(ctx); return markNotificationRead({ userId, id }); },
    createProduct: (_p, { name, unitId }, ctx) => { const { actor } = getAuthFromContext(ctx); return createProduct({ actor, name, unitId }); },
    updateProduct: (_p, { id, name, unitId }, ctx) => { const { actor } = getAuthFromContext(ctx); return updateProduct({ actor, id, name, unitId }); },
    deleteProduct: (_p, { id }, ctx) => { const { actor } = getAuthFromContext(ctx); return deleteProduct({ actor, id }); },
    createUnit: (_p, { label }, ctx) => { const { actor } = getAuthFromContext(ctx); return createUnit({ actor, label }); },
    updateUnit: (_p, { id, label }, ctx) => { const { actor } = getAuthFromContext(ctx); return updateUnit({ actor, id, label }); },
    deleteUnit: (_p, { id }, ctx) => { const { actor } = getAuthFromContext(ctx); return deleteUnit({ actor, id }); },
    createCurrency: (_p, { code }, ctx) => { const { actor } = getAuthFromContext(ctx); return createCurrency({ actor, code }); },
    updateCurrency: (_p, { id, code }, ctx) => { const { actor } = getAuthFromContext(ctx); return updateCurrency({ actor, id, code }); },
    deleteCurrency: (_p, { id }, ctx) => { const { actor } = getAuthFromContext(ctx); return deleteCurrency({ actor, id }); },
    createWarehouse: (_p, { name }, ctx) => { const { actor } = getAuthFromContext(ctx); return createWarehouse({ actor, name }); },
    updateWarehouse: (_p, { id, name }, ctx) => { const { actor } = getAuthFromContext(ctx); return updateWarehouse({ actor, id, name }); },
    deleteWarehouse: (_p, { id }, ctx) => { const { actor } = getAuthFromContext(ctx); return deleteWarehouse({ actor, id }); },
    createPurchase: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return createPurchase({ actor, userId, input }); },
    addLotTranche: (_p, { input }, ctx) => { const { actor } = getAuthFromContext(ctx); return addLotTranche({ actor, input }); },
    createInventoryTransfer: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return createInventoryTransfer({ actor, userId, input }); },
    createNotification: (_p, { input }) => {
      const row = { id: crypto.randomUUID(), type: input.type, saleId: input.saleId, lotId: input.lotId, productId: input.productId, title: input.title, body: input.body, createdAt: new Date().toISOString(), actorUserId: input.actorUserId, readByUserIds: Array.isArray(input.readByUserIds) ? input.readByUserIds : [] };
      return persistNotification(row);
    },
    createOrder: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return createOrder({ actor, userId, input }); },
    updateOrder: (_p, { id, input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return updateOrder({ actor, userId, id, input }); },
    updateOrderStatus: (_p, { id, status, cancelReason }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return updateOrderStatus({ actor, userId, id, status, cancelReason }); },
    deleteOrder: (_p, { id }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return deleteOrder({ actor, userId, id }); },
    addOrderPayment: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return addOrderPayment({ actor, userId, input }); },
    addSalePayment: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return addSalePayment({ actor, userId, input }); },
    createProduction: (_p, { input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return createProduction({ actor, userId, input }); },
    updateProduction: (_p, { id, input }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return updateProduction({ actor, userId, id, input }); },
    updateProductionStatus: (_p, { id, status, actualOutputQty, cancelReason, bottlePrices }, ctx) => { const { actor, userId } = getAuthFromContext(ctx); return updateProductionStatus({ actor, userId, id, status, actualOutputQty, cancelReason, bottlePrices }); },
    deleteProduction: (_p, { id }, ctx) => { const { actor } = getAuthFromContext(ctx); return deleteProduction({ actor, id }); },
  },

  Subscription: {
    notificationCreated: {
      subscribe: (_p, _a, ctx) => { const actor = ctx?.actor; if (!actor || actor.role !== 'admin') throw new Error('Admins only'); return createTopicAsyncIterator(NOTIFICATION_CREATED_TOPIC); },
      resolve: (payload, _a, ctx) => withUnreadForUser(payload, ctx?.userId),
    },
  },

  AdminNotification: {
    unread: (n, _a, ctx) => typeof n.unread === 'boolean' ? n.unread : withUnreadForUser(n, ctx?.userId).unread,
  },
};

module.exports = resolvers;
