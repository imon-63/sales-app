import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { requestJson } from '../../api/http';
import { getJsonServerBaseUrl } from '../../config/apiBase';
import type {
  Currency,
  Lot,
  LotBatch,
  Product,
  Sale,
  SalesItem,
  SalesItemAllocation,
  Unit,
  User,
  Warehouse,
  InventoryTransfer,
  InventoryTransferLine,
} from '../../types/models';

import { clearSession } from './authSlice';

export type SalesDataState = {
  sales: Sale[];
  salesItems: SalesItem[];
  products: Product[];
  warehouses: Warehouse[];
  units: Unit[];
  currencies: Currency[];
  users: User[];
  lots: Lot[];
  lotBatches: LotBatch[];
  salesItemAllocations: SalesItemAllocation[];
  inventoryTransfers: InventoryTransfer[];
  inventoryTransferLines: InventoryTransferLine[];
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
  users: [],
  lots: [],
  lotBatches: [],
  salesItemAllocations: [],
  inventoryTransfers: [],
  inventoryTransferLines: [],
  status: 'idle',
  error: null,
};

export const fetchSalesDataset = createAsyncThunk(
  'salesData/fetchAll',
  async (_, { rejectWithValue }) => {
    const baseUrl = getJsonServerBaseUrl();
    try {
      const [
        sales,
        salesItems,
        products,
        warehouses,
        units,
        currencies,
        users,
        lots,
        lotBatches,
        salesItemAllocations,
        inventoryTransfers,
        inventoryTransferLines,
      ] = await Promise.all([
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
        requestJson<User[]>({ method: 'GET', baseUrl, path: '/api/users' }),
        requestJson<Lot[]>({ method: 'GET', baseUrl, path: '/api/lots' }),
        requestJson<LotBatch[]>({
          method: 'GET',
          baseUrl,
          path: '/api/lotBatches',
        }),
        requestJson<SalesItemAllocation[]>({
          method: 'GET',
          baseUrl,
          path: '/api/salesItemAllocations',
        }),
        requestJson<InventoryTransfer[]>({
          method: 'GET',
          baseUrl,
          path: '/api/inventoryTransfers',
        }),
        requestJson<InventoryTransferLine[]>({
          method: 'GET',
          baseUrl,
          path: '/api/inventoryTransferLines',
        }),
      ]);
      return {
        sales,
        salesItems,
        products,
        warehouses,
        units,
        currencies,
        users,
        lots,
        lotBatches,
        salesItemAllocations,
        inventoryTransfers,
        inventoryTransferLines,
      };
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
        state.users = action.payload.users;
        state.lots = action.payload.lots;
        state.lotBatches = action.payload.lotBatches;
        state.salesItemAllocations = action.payload.salesItemAllocations;
        state.inventoryTransfers = action.payload.inventoryTransfers;
        state.inventoryTransferLines = action.payload.inventoryTransferLines;
      })
      .addCase(fetchSalesDataset.rejected, (state, action) => {
        state.status = 'failed';
        state.error = String(action.payload ?? action.error.message ?? 'Error');
      });
  },
});

export const salesDataReducer = salesDataSlice.reducer;
