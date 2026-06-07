import { getWebSocketUrl } from '../config/apiBase';
import { Vibration } from 'react-native';
import { store } from '../store';
import {
  addNotification,
  markNotificationReadLocal,
  setActiveViews,
} from '../store/slices/notificationsSlice';
import { fetchOrders, upsertOrder } from '../store/slices/ordersSlice';
import { showToast } from '../store/slices/uiSlice';
import type { User } from '../types/models';

class LiveClient {
  private ws: WebSocket | null = null;
  private user: User | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;
  private activeLotBatchId: string | null = null;

  connect(user: User) {
    this.user = user;
    this.isIntentionalDisconnect = false;
    this.establishConnection();
  }

  private establishConnection() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const url = getWebSocketUrl();
    console.log(`Connecting to live WebSocket server at: ${url}`);
    
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('Failed to create WebSocket instance:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('WebSocket connection opened');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      // Register current user
      if (this.user) {
        this.send({
          type: 'register',
          userId: this.user.id,
          name: this.user.name,
          role: this.user.role,
        });
      }
      // If we reconnected and were previously viewing a lot batch, re-send that view
      if (this.activeLotBatchId) {
        this.send({
          type: 'view_product_sell',
          lotBatchId: this.activeLotBatchId,
        });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Error parsing message data:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.log('WebSocket error occurred:', error);
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      if (!this.isIntentionalDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'active_views':
        store.dispatch(setActiveViews(data.views));
        break;
      case 'notification_created': {
        const notif = data.notification;
        const appState = store.getState() as any;
        const role = appState.auth?.user?.role;
        // Sales users only receive order_created — matches backend listAdminNotifications filter
        if (role === 'sales' && notif?.type !== 'order_created') break;
        // New notifications are always unread when they first arrive
        store.dispatch(addNotification({ ...notif, unread: true }));

        if (notif?.type === 'order_created') {
          store.dispatch(fetchOrders());
          const currentUserId = appState.auth?.user?.id;
          const isCreator = notif.actorUserId && notif.actorUserId === currentUserId;
          if (!isCreator) {
            const locale = appState.ui?.locale ?? 'en';
            Vibration.vibrate([0, 120, 80, 180]);
            store.dispatch(showToast({
              title: locale === 'bn' ? 'নতুন অর্ডার 📋' : 'New Order 📋',
              message: notif.title ?? notif.body ?? '',
              type: 'info',
            }));
          }
        }
        break;
      }
      case 'notification_read': {
        const currentUserId = (store.getState() as any).auth?.user?.id ?? '';
        store.dispatch(markNotificationReadLocal({
          id: data.id,
          readerUserId: data.userId,
          currentUserId,
        }));
        break;
      }
      default:
        console.warn('Unknown live message type:', data.type);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    console.log('Scheduling reconnection in 3 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.establishConnection();
    }, 3000);
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.activeLotBatchId = null;
  }

  enterSellTab(lotBatchId: string) {
    this.activeLotBatchId = lotBatchId;
    this.send({
      type: 'view_product_sell',
      lotBatchId,
    });
  }

  leaveSellTab(lotBatchId: string) {
    if (this.activeLotBatchId === lotBatchId) {
      this.activeLotBatchId = null;
    }
    this.send({
      type: 'leave_product_sell',
      lotBatchId,
    });
  }

  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        console.error('Failed to send payload over WS:', e);
      }
    } else {
      console.warn('Cannot send message, WebSocket is not open');
    }
  }
}

export const liveClient = new LiveClient();
