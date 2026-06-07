import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as ordersApi from '../../api/orders';
import type { Order, OrderItem, OrderPayment } from '../../types/models';
import { clearSession } from './authSlice';

type ThunkState = { auth: { token: string | null } };

export type OrdersState = {
  orders: Order[];
  orderItems: OrderItem[];
  orderPayments: OrderPayment[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetchedAt: number | null;
};

const initialState: OrdersState = {
  orders: [],
  orderItems: [],
  orderPayments: [],
  status: 'idle',
  error: null,
  lastFetchedAt: null,
};

export const fetchOrders = createAsyncThunk<
  { orders: Order[]; orderItems: OrderItem[]; orderPayments: OrderPayment[] },
  void,
  { state: ThunkState }
>('orders/fetch', async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) return rejectWithValue('Not signed in');
  try { return await ordersApi.fetchOrders(token); }
  catch (e: any) { return rejectWithValue(e?.message ?? 'Failed to load orders'); }
});

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    upsertOrder(state, action) {
      const idx = state.orders.findIndex(o => o.id === action.payload.id);
      if (idx >= 0) state.orders[idx] = action.payload;
      else state.orders.unshift(action.payload);
    },
    removeOrder(state, action) {
      state.orders = state.orders.filter(o => o.id !== action.payload);
      state.orderItems = state.orderItems.filter(oi => oi.orderId !== action.payload);
      state.orderPayments = state.orderPayments.filter(p => p.orderId !== action.payload);
    },
    addPayment(state, action) {
      if (!state.orderPayments.some(p => p.id === action.payload.id)) {
        state.orderPayments.push(action.payload);
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(clearSession, () => ({ ...initialState }));
    builder
      .addCase(fetchOrders.pending, state => { state.status = 'loading'; state.error = null; })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.orders = action.payload.orders;
        state.orderItems = action.payload.orderItems;
        state.orderPayments = action.payload.orderPayments;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = String(action.payload ?? action.error.message ?? 'Error');
      });
  },
});

export const { upsertOrder, removeOrder, addPayment } = ordersSlice.actions;
export const ordersReducer = ordersSlice.reducer;
