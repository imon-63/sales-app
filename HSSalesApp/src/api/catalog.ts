import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Currency, Product, Unit, Warehouse } from '../types/models';

import { requestGraphql } from './http';

export async function createUnit(
  payload: { label: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<{ createUnit: Unit }, { label: string }>({
    baseUrl,
    token,
    query: `
      mutation CreateUnit($label: String!) {
        createUnit(label: $label) {
          id
          label
          globalFactor
          isWholeNumber
        }
      }
    `,
    variables: payload,
  });
  return data.createUnit;
}

export async function createCurrency(
  payload: { code: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<{ createCurrency: Currency }, { code: string }>({
    baseUrl,
    token,
    query: `
      mutation CreateCurrency($code: String!) {
        createCurrency(code: $code) {
          id
          code
        }
      }
    `,
    variables: payload,
  });
  return data.createCurrency;
}

const GQL = (q: string) => q;

export async function updateUnit(id: string, label: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateUnit: Unit }, { id: string; label: string }>({
    baseUrl, token,
    query: GQL(`mutation UpdateUnit($id: ID!, $label: String!) { updateUnit(id: $id, label: $label) { id label globalFactor isWholeNumber } }`),
    variables: { id, label },
  });
  return data.updateUnit;
}

export async function deleteUnit(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteUnit: boolean }, { id: string }>({
    baseUrl, token,
    query: GQL(`mutation DeleteUnit($id: ID!) { deleteUnit(id: $id) }`),
    variables: { id },
  });
  return data.deleteUnit;
}

export async function updateCurrency(id: string, code: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateCurrency: Currency }, { id: string; code: string }>({
    baseUrl, token,
    query: GQL(`mutation UpdateCurrency($id: ID!, $code: String!) { updateCurrency(id: $id, code: $code) { id code } }`),
    variables: { id, code },
  });
  return data.updateCurrency;
}

export async function deleteCurrency(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteCurrency: boolean }, { id: string }>({
    baseUrl, token,
    query: GQL(`mutation DeleteCurrency($id: ID!) { deleteCurrency(id: $id) }`),
    variables: { id },
  });
  return data.deleteCurrency;
}

export async function createWarehouse(name: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ createWarehouse: Warehouse }, { name: string }>({
    baseUrl, token,
    query: GQL(`mutation CreateWarehouse($name: String!) { createWarehouse(name: $name) { id name } }`),
    variables: { name },
  });
  return data.createWarehouse;
}

export async function updateWarehouse(id: string, name: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateWarehouse: Warehouse }, { id: string; name: string }>({
    baseUrl, token,
    query: GQL(`mutation UpdateWarehouse($id: ID!, $name: String!) { updateWarehouse(id: $id, name: $name) { id name } }`),
    variables: { id, name },
  });
  return data.updateWarehouse;
}

export async function deleteWarehouse(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteWarehouse: boolean }, { id: string }>({
    baseUrl, token,
    query: GQL(`mutation DeleteWarehouse($id: ID!) { deleteWarehouse(id: $id) }`),
    variables: { id },
  });
  return data.deleteWarehouse;
}

export async function createProduct(name: string, unitId: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ createProduct: Product }, { name: string; unitId: string }>({
    baseUrl, token,
    query: GQL(`mutation CreateProduct($name: String!, $unitId: ID!) { createProduct(name: $name, unitId: $unitId) { id name unitId } }`),
    variables: { name, unitId },
  });
  return data.createProduct;
}

export async function updateProduct(id: string, name: string, unitId: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateProduct: Product }, { id: string; name: string; unitId: string }>({
    baseUrl, token,
    query: GQL(`mutation UpdateProduct($id: ID!, $name: String!, $unitId: ID!) { updateProduct(id: $id, name: $name, unitId: $unitId) { id name unitId } }`),
    variables: { id, name, unitId },
  });
  return data.updateProduct;
}

export async function deleteProduct(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteProduct: boolean }, { id: string }>({
    baseUrl, token,
    query: GQL(`mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }`),
    variables: { id },
  });
  return data.deleteProduct;
}
