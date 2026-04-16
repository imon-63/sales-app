import { getJsonServerBaseUrl } from '../config/apiBase';

import { requestJson } from './http';

export type CreatedSalesUser = {
  id: string;
  email: string;
  role: 'sales';
};

export type CreateSalesUserResponse = {
  user: CreatedSalesUser;
};

export async function createSalesUser(
  payload: { email: string; password: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<CreateSalesUserResponse>({
    method: 'POST',
    baseUrl,
    path: '/api/users',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    },
  });
}
