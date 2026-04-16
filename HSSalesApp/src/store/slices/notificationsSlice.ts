import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

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
};

const initialState: NotificationsState = {
  items: [],
  status: 'idle',
  error: null,
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
  reducers: {},
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

export const notificationsReducer = notificationsSlice.reducer;

export function selectUnreadNotificationCount(state: {
  notifications: NotificationsState;
}) {
  return state.notifications.items.filter((n) => n.unread).length;
}
