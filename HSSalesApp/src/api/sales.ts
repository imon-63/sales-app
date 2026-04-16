import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Sale, SalesItem } from '../types/models';

import { requestJson } from './http';

export type CreateSaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId: string;
};

export type CreateSaleRequest = {
  warehouseId: string;
  saleDate?: string;
  notes?: string;
  items: CreateSaleLine[];
};

export type CreateSaleResponse = {
  sale: Sale;
  items: SalesItem[];
};

export async function createSale(
  payload: CreateSaleRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<CreateSaleResponse>({
    method: 'POST',
    baseUrl,
    path: '/api/sales',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
}
