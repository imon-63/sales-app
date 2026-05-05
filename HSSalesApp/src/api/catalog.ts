import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Currency, Unit } from '../types/models';

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
