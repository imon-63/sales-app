import { requestGraphql } from './http';
import { getJsonServerBaseUrl } from '../config/apiBase';
import type { User } from '../types/models';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export async function login(payload: LoginRequest, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ login: LoginResponse }, LoginRequest>({
    baseUrl,
    query: `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
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
    variables: payload,
  });
  return data.login;
}
