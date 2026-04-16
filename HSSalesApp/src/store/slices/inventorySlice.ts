import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as inventoryApi from '../../api/inventory';
import type { StockRow } from '../../types/models';

import { clearSession } from './authSlice';

type InventoryThunkState = {
  auth: { token: string | null };
};

export type InventoryState = {
  stockRows: StockRow[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

const initialState: InventoryState = {
  stockRows: [],
  status: 'idle',
  error: null,
};

export const fetchInventoryStock = createAsyncThunk<
  StockRow[],
  void,
  { state: InventoryThunkState }
>('inventory/fetchStock', async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.token;
  if (!token) {
    return rejectWithValue('Not signed in');
  }
  try {
    return await inventoryApi.fetchStockRows(token);
  } catch (e: any) {
    return rejectWithValue(e?.message ?? 'Failed to load stock');
  }
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(clearSession, () => ({ ...initialState }));
    builder
      .addCase(fetchInventoryStock.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchInventoryStock.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.stockRows = action.payload;
      })
      .addCase(fetchInventoryStock.rejected, (state, action) => {
        state.status = 'failed';
        state.error = String(action.payload ?? action.error.message ?? 'Error');
      });
  },
});

export const inventoryReducer = inventorySlice.reducer;
