import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Currency, Unit } from '../types/models';

import { requestJson } from './http';

export async function createUnit(
  payload: { label: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<Unit>({
    method: 'POST',
    baseUrl,
    path: '/api/units',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
}

export async function createCurrency(
  payload: { code: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<Currency>({
    method: 'POST',
    baseUrl,
    path: '/api/currencies',
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
}
