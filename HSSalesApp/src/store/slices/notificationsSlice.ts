import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import * as notificationsApi from '../../api/notifications';
import type { AdminNotification } from '../../types/models';

import { clearSession } from './authSlice';

type NotificationsThunkState = {
  auth: { token: string | null };
};

export type NotificationsState = {
  items: AdminNotification[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetchedAt: number | null;
  activeViews: Array<{ lotBatchId: string; users: Array<{ id: string; name: string }> }>;
};

const initialState: NotificationsState = {
  items: [],
  status: 'idle',
  error: null,
  lastFetchedAt: null,
  activeViews: [],
};

export const fetchNotifications = createAsyncThunk<
  AdminNotification[],
  void,
  { state: NotificationsThunkState }
>('notifications/fetch', async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) {
    return rejectWithValue('Not signed in');
  }
  try {
    return await notificationsApi.fetchNotifications(token);
  } catch (e: any) {
    return rejectWithValue(e?.message ?? 'Failed to load notifications');
  }
});

export const markNotificationReadThunk = createAsyncThunk<
  string,
  string,
  { state: NotificationsThunkState }
>('notifications/markRead', async (notificationId, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) {
    return rejectWithValue('Not signed in');
  }
  try {
    await notificationsApi.markNotificationRead(notificationId, token);
    return notificationId;
  } catch (e: any) {
    return rejectWithValue(e?.message ?? 'Failed to mark read');
  }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<AdminNotification>) => {
      if (!state.items.some((n) => n.id === action.payload.id)) {
        state.items.unshift(action.payload);
      }
    },
    markNotificationReadLocal: (
      state,
      action: PayloadAction<{ id: string; readerUserId: string; currentUserId: string }>,
    ) => {
      const { id, readerUserId, currentUserId } = action.payload;
      state.items = state.items.map((n) => {
        if (n.id !== id) return n;
        const readers = new Set(n.readByUserIds ?? []);
        readers.add(readerUserId);
        return {
          ...n,
          readByUserIds: Array.from(readers),
          // Only mark as read for the current device's user
          unread: !readers.has(currentUserId),
        };
      });
    },
    setActiveViews: (
      state,
      action: PayloadAction<
        Array<{ lotBatchId: string; users: Array<{ id: string; name: string }> }>
      >,
    ) => {
      state.activeViews = action.payload;
    },
    markProductNotificationsReadLocal: (
      state,
      action: PayloadAction<{ productId: string; userId: string }>,
    ) => {
      const { productId, userId } = action.payload;
      state.items = state.items.map((n) => {
        if (n.type === 'sell_viewing' && n.productId === productId) {
          const readList = n.readByUserIds || [];
          if (!readList.includes(userId)) {
            return {
              ...n,
              readByUserIds: [...readList, userId],
              unread: false,
            };
          }
        }
        return n;
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(clearSession, () => ({ ...initialState }));
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = String(action.payload ?? action.error.message ?? 'Error');
      });
    builder.addCase(markNotificationReadThunk.fulfilled, (state, action) => {
      const id = action.payload;
      state.items = state.items.map((n) =>
        n.id === id ? { ...n, unread: false } : n,
      );
    });
  },
});

export const {
  addNotification,
  markNotificationReadLocal,
  setActiveViews,
  markProductNotificationsReadLocal,
} = notificationsSlice.actions;

export const notificationsReducer = notificationsSlice.reducer;

export function selectUnreadNotificationCount(state: {
  notifications: NotificationsState;
}) {
  return state.notifications.items.filter((n) => n.unread).length;
}
