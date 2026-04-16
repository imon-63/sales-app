import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { requestJson } from '../../api/http';
import { getJsonServerBaseUrl } from '../../config/apiBase';
import type {
  Currency,
  Product,
  Sale,
  SalesItem,
  Unit,
  Warehouse,
} from '../../types/models';

import { clearSession } from './authSlice';

export type SalesDataState = {
  sales: Sale[];
  salesItems: SalesItem[];
  products: Product[];
  warehouses: Warehouse[];
  units: Unit[];
  currencies: Currency[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

const initialState: SalesDataState = {
  sales: [],
  salesItems: [],
  products: [],
  warehouses: [],
  units: [],
  currencies: [],
  status: 'idle',
  error: null,
};

export const fetchSalesDataset = createAsyncThunk(
  'salesData/fetchAll',
  async (_, { rejectWithValue }) => {
    const baseUrl = getJsonServerBaseUrl();
    try {
      const [sales, salesItems, products, warehouses, units, currencies] =
        await Promise.all([
          requestJson<Sale[]>({ method: 'GET', baseUrl, path: '/api/sales' }),
          requestJson<SalesItem[]>({
            method: 'GET',
            baseUrl,
            path: '/api/salesItems',
          }),
          requestJson<Product[]>({ method: 'GET', baseUrl, path: '/api/products' }),
          requestJson<Warehouse[]>({
            method: 'GET',
            baseUrl,
            path: '/api/warehouses',
          }),
          requestJson<Unit[]>({ method: 'GET', baseUrl, path: '/api/units' }),
          requestJson<Currency[]>({
            method: 'GET',
            baseUrl,
            path: '/api/currencies',
          }),
        ]);
      return { sales, salesItems, products, warehouses, units, currencies };
    } catch (e: any) {
      return rejectWithValue(e?.message ?? 'Failed to load data');
    }
  },
);

const salesDataSlice = createSlice({
  name: 'salesData',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(clearSession, () => ({ ...initialState }));
    builder
      .addCase(fetchSalesDataset.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSalesDataset.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.sales = action.payload.sales;
        state.salesItems = action.payload.salesItems;
        state.products = action.payload.products;
        state.warehouses = action.payload.warehouses;
        state.units = action.payload.units;
        state.currencies = action.payload.currencies;
      })
      .addCase(fetchSalesDataset.rejected, (state, action) => {
        state.status = 'failed';
        state.error = String(action.payload ?? action.error.message ?? 'Error');
      });
  },
});

export const salesDataReducer = salesDataSlice.reducer;
