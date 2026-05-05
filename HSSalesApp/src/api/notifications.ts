import { getJsonServerBaseUrl } from '../config/apiBase';
import type { AdminNotification } from '../types/models';
import { requestJson } from './http';

export async function createNotification(
  payload: Omit<AdminNotification, 'id' | 'createdAt'>,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<AdminNotification>({
    method: 'POST',
    baseUrl,
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      ...payload,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function fetchNotifications(
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<AdminNotification[]>({
    method: 'GET',
    baseUrl,
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markNotificationRead(
  id: string,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<{ ok: boolean }>({
    method: 'POST',
    baseUrl,
    path: `/api/notifications/${id}/read`,
    headers: { Authorization: `Bearer ${token}` },
  });
}
