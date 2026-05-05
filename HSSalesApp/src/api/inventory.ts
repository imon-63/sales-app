import { getJsonServerBaseUrl } from '../config/apiBase';
import type { StockRow } from '../types/models';

import { requestGraphql } from './http';

export type PurchaseLine = { productId: string; quantity: number; unitCost: number };

export type CreatePurchaseRequest = {
  warehouseId: string;
  purchaseDate?: string;
  notes?: string;
  items: PurchaseLine[];
};

export type TransferLine = { productId: string; quantity: number };

export type CreateTransferRequest = {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate?: string;
  notes?: string;
  lines: TransferLine[];
};

export async function fetchStockRows(token: string, baseUrl = getJsonServerBaseUrl()) {
  try {
    const data = await requestGraphql<{ inventoryStock: StockRow[] }>({
      baseUrl,
      token,
      query: `
        query InventoryStock {
          inventoryStock {
            id
            batchLotId
            lotId
            lotNumber
            productId
            productName
            unit
            warehouseId
            warehouseName
            quantityOnHand
            unitCost
            acquiredAt
          }
        }
      `,
    });
    return data.inventoryStock;
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    const schemaMismatch =
      msg.includes('Cannot query field "id" on type "StockRow"') ||
      msg.includes('Cannot query field "batchLotId" on type "StockRow"') ||
      msg.includes('Cannot query field "lotNumber" on type "StockRow"');
    if (!schemaMismatch) throw e;

    // Backward-compatible fallback while backend process is still on old schema.
    const fallback = await requestGraphql<{ inventoryStock: StockRow[] }>({
      baseUrl,
      token,
      query: `
        query InventoryStockLegacy {
          inventoryStock {
            productId
            productName
            unit
            warehouseId
            warehouseName
            quantityOnHand
            unitCost
          }
        }
      `,
    });
    return fallback.inventoryStock;
  }
}

export async function createPurchase(
  payload: CreatePurchaseRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<
    { createPurchase: { purchaseId: string; ok: boolean } },
    { input: CreatePurchaseRequest }
  >({
    baseUrl,
    token,
    query: `
      mutation CreatePurchase($input: CreatePurchaseInput!) {
        createPurchase(input: $input) {
          purchaseId
          ok
        }
      }
    `,
    variables: { input: payload },
  });
  return data.createPurchase;
}

export async function createTransfer(
  payload: CreateTransferRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<
    { createInventoryTransfer: { transferId: string; ok: boolean } },
    { input: CreateTransferRequest }
  >({
    baseUrl,
    token,
    query: `
      mutation CreateInventoryTransfer($input: CreateTransferInput!) {
        createInventoryTransfer(input: $input) {
          transferId
          ok
        }
      }
    `,
    variables: { input: payload },
  });
  return data.createInventoryTransfer;
}
