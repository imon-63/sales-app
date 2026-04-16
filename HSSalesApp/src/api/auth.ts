import { requestJson } from './http';
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
  return requestJson<LoginResponse>({
    method: 'POST',
    baseUrl,
    path: '/api/login',
    body: payload,
  });
}
