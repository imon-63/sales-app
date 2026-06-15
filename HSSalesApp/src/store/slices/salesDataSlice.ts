import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { requestGraphql } from '../../api/http';
import { getJsonServerBaseUrl } from '../../config/apiBase';
import type {
  Currency,
  Lot,
  LotBatch,
  LotPurchaseLog,
  Product,
  Sale,
  SalePayment,
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
  salePayments: SalePayment[];
  products: Product[];
  warehouses: Warehouse[];
  units: Unit[];
  currencies: Currency[];
  users: User[];
  lots: Lot[];
  lotBatches: LotBatch[];
  lotPurchaseLogs: LotPurchaseLog[];
  salesItemAllocations: SalesItemAllocation[];
  inventoryTransfers: InventoryTransfer[];
  inventoryTransferLines: InventoryTransferLine[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

const initialState: SalesDataState = {
  sales: [],
  salesItems: [],
  salePayments: [],
  products: [],
  warehouses: [],
  units: [],
  currencies: [],
  users: [],
  lots: [],
  lotBatches: [],
  lotPurchaseLogs: [],
  salesItemAllocations: [],
  inventoryTransfers: [],
  inventoryTransferLines: [],
  status: 'idle',
  error: null,
};

export const fetchSalesDataset = createAsyncThunk(
  'salesData/fetchAll',
  async (_, { getState, rejectWithValue }) => {
    const baseUrl = getJsonServerBaseUrl();
    const token = (getState() as any)?.auth?.token as string | null;
    try {
      const data = await requestGraphql<{
        sales: Sale[];
        salesItems: SalesItem[];
        salePayments: SalePayment[];
        products: Product[];
        warehouses: Warehouse[];
        units: Unit[];
        currencies: Currency[];
        users: User[];
        lots: Lot[];
        lotBatches: LotBatch[];
        lotPurchaseLogs: LotPurchaseLog[];
        salesItemAllocations: SalesItemAllocation[];
        inventoryTransfers: InventoryTransfer[];
        inventoryTransferLines: InventoryTransferLine[];
      }>({
        baseUrl,
        token: token ?? undefined,
        query: `
          query SalesDataset {
            sales { id saleDate warehouseId createdBy notes orderId status cancelledAt cancelReason paidAmount totalAmount paymentStatus extraCost }
            salesItems { id saleId productId quantity unitPrice currencyId unitId bottleBreakdown }
            salePayments { id saleId amount collectedBy collectedByName paidAt notes }
            products { id name unitId unit }
            warehouses { id name }
            units { id label globalFactor isWholeNumber }
            currencies { id code }
            users { id email name phone role }
            lots { id productId lotNumber }
            lotBatches {
              id lotId warehouseId acquiredAt unitCost baseUnitCost notes originalQuantity remainingQuantity
            }
            lotPurchaseLogs { id lotId acquiredAt quantity baseUnitCost extraCost effectiveUnitCost notes }
            salesItemAllocations { id salesItemId lotBatchId quantityAllocated unitCostAtTime }
            inventoryTransfers { id transferDate fromWarehouseId toWarehouseId createdBy notes }
            inventoryTransferLines { id transferId productId lotId quantity }
          }
        `,
      });
      return {
        sales: data.sales,
        salesItems: data.salesItems,
        salePayments: data.salePayments,
        products: data.products,
        warehouses: data.warehouses,
        units: data.units,
        currencies: data.currencies,
        users: data.users,
        lots: data.lots,
        lotBatches: data.lotBatches,
        lotPurchaseLogs: data.lotPurchaseLogs,
        salesItemAllocations: data.salesItemAllocations,
        inventoryTransfers: data.inventoryTransfers,
        inventoryTransferLines: data.inventoryTransferLines,
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
        state.salePayments = action.payload.salePayments;
        state.products = action.payload.products;
        state.warehouses = action.payload.warehouses;
        state.units = action.payload.units;
        state.currencies = action.payload.currencies;
        state.users = action.payload.users;
        state.lots = action.payload.lots;
        state.lotBatches = action.payload.lotBatches;
        state.lotPurchaseLogs = action.payload.lotPurchaseLogs;
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
