'use strict';
const { WebSocketServer } = require('ws');
const { db } = require('./db');

const liveWsServer = new WebSocketServer({ noServer: true });
const activeViews = new Map(); // lotBatchId → Map(userId → name)

function broadcastToAll(payload) {
  const msg = JSON.stringify(payload);
  liveWsServer.clients.forEach(client => { if (client.readyState === 1) client.send(msg); });
}

function broadcastActiveViews() {
  const views = Array.from(activeViews.entries()).map(([lotBatchId, userMap]) => ({
    lotBatchId,
    users: Array.from(userMap.entries()).map(([id, name]) => ({ id, name })),
  }));
  broadcastToAll({ type: 'active_views', views });
}

liveWsServer.on('connection', (ws) => {
  let currentUser = null;
  let currentProduct = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        currentUser = { id: data.userId, name: data.name, role: data.role };
        ws.send(JSON.stringify({
          type: 'active_views',
          views: Array.from(activeViews.entries()).map(([lotBatchId, userMap]) => ({ lotBatchId, users: Array.from(userMap.entries()).map(([id, name]) => ({ id, name })) })),
        }));
      } else if (data.type === 'view_product_sell') {
        if (!currentUser) return;
        const lotBatchId = data.lotBatchId;
        currentProduct = lotBatchId;
        if (!activeViews.has(lotBatchId)) activeViews.set(lotBatchId, new Map());
        activeViews.get(lotBatchId).set(currentUser.id, currentUser.name);
        broadcastActiveViews();
      } else if (data.type === 'leave_product_sell') {
        if (!currentUser) return;
        const lotBatchId = data.lotBatchId;
        if (activeViews.has(lotBatchId)) {
          activeViews.get(lotBatchId).delete(currentUser.id);
          if (activeViews.get(lotBatchId).size === 0) activeViews.delete(lotBatchId);
        }
        if (currentProduct === lotBatchId) currentProduct = null;
        broadcastActiveViews();
      }
    } catch (e) { /* ignore parse errors */ }
  });

  ws.on('close', () => {
    if (currentUser && currentProduct) {
      const lotBatchId = currentProduct;
      if (activeViews.has(lotBatchId)) {
        activeViews.get(lotBatchId).delete(currentUser.id);
        if (activeViews.get(lotBatchId).size === 0) activeViews.delete(lotBatchId);
      }
      broadcastActiveViews();
    }
  });
});

module.exports = { liveWsServer, broadcastToAll };
