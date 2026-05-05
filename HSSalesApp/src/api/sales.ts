import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Sale, SalesItem } from '../types/models';

import { requestGraphql } from './http';

export type CreateSaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId: string;
  lotIds?: string[];
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
  const data = await requestGraphql<{ createSale: CreateSaleResponse }, { input: CreateSaleRequest }>({
    baseUrl,
    token,
    query: `
      mutation CreateSale($input: CreateSaleInput!) {
        createSale(input: $input) {
          sale {
            id
            saleDate
            warehouseId
            createdBy
            notes
          }
          items {
            id
            saleId
            productId
            quantity
            unitPrice
            currencyId
            unitId
          }
        }
      }
    `,
    variables: { input: payload },
  });
  return data.createSale;
}
