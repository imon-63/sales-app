import { requestJson } from './http';

// Demo endpoint you can later replace with your real API.
// reqres accepts:
//  email: "eve.holt@reqres.in"
//  password: "cityslicka"
const DEMO_BASE_URL = 'https://reqres.in';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export async function login(payload: LoginRequest, baseUrl = DEMO_BASE_URL) {
  return requestJson<LoginResponse>({
    method: 'POST',
    baseUrl,
    path: '/api/login',
    body: payload,
  });
}

