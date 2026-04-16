import { getJsonServerBaseUrl } from '../config/apiBase';
import type { StockRow } from '../types/models';

import { requestJson } from './http';

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
  return requestJson<StockRow[]>({
    method: 'GET',
    baseUrl,
    path: '/api/inventory/stock',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createPurchase(
  payload: CreatePurchaseRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<{ purchaseId: string; ok: boolean }>({
    method: 'POST',
    baseUrl,
    path: '/api/purchases',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
}

export async function createTransfer(
  payload: CreateTransferRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<{ transferId: string; ok: boolean }>({
    method: 'POST',
    baseUrl,
    path: '/api/inventory/transfers',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
}
