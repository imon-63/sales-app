import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Sale, SalePayment, SalesItem } from '../types/models';

import { requestGraphql } from './http';

export type CreateSaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId: string;
  lotIds?: string[];
  bottleBreakdown?: string;
};

export type CreateSaleRequest = {
  warehouseId: string;
  saleDate?: string;
  notes?: string;
  items: CreateSaleLine[];
  paidAmount?: number;
  extraCost?: number;
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
            id saleDate warehouseId createdBy notes
            paidAmount totalAmount paymentStatus extraCost
          }
          items {
            id saleId productId quantity unitPrice currencyId unitId bottleBreakdown
          }
        }
      }
    `,
    variables: { input: payload },
  });
  return data.createSale;
}

export type AddSalePaymentRequest = {
  saleId: string;
  amount: number;
  notes?: string;
  paidAt?: string;
};

export async function addSalePayment(
  payload: AddSalePaymentRequest,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
): Promise<SalePayment> {
  const data = await requestGraphql<{ addSalePayment: SalePayment }, { input: AddSalePaymentRequest }>({
    baseUrl,
    token,
    query: `
      mutation AddSalePayment($input: AddSalePaymentInput!) {
        addSalePayment(input: $input) {
          id saleId amount collectedBy collectedByName paidAt notes
        }
      }
    `,
    variables: { input: payload },
  });
  return data.addSalePayment;
}
