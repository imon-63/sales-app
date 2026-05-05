import { getJsonServerBaseUrl } from '../config/apiBase';

import { requestGraphql } from './http';

export type CreatedSalesUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'sales';
};

export type CreateSalesUserResponse = {
  user: CreatedSalesUser;
};

export async function createSalesUser(
  payload: { name: string; phone?: string; email: string; password: string },
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<
    { createSalesUser: CreateSalesUserResponse },
    { input: { name: string; phone?: string; email: string; password: string } }
  >({
    baseUrl,
    token,
    query: `
      mutation CreateSalesUser($input: CreateSalesUserInput!) {
        createSalesUser(input: $input) {
          user {
            id
            email
            name
            phone
            role
          }
        }
      }
    `,
    variables: {
      input: {
        name: payload.name.trim(),
        phone: payload.phone?.trim() || undefined,
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      },
    },
  });
  return data.createSalesUser;
}
