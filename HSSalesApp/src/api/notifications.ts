import { getJsonServerBaseUrl } from '../config/apiBase';
import type { AdminNotification } from '../types/models';

import { requestJson } from './http';

export async function fetchNotifications(token: string, baseUrl = getJsonServerBaseUrl()) {
  return requestJson<AdminNotification[]>({
    method: 'GET',
    baseUrl,
    path: '/api/notifications',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markNotificationRead(
  notificationId: string,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  return requestJson<{ ok: boolean }>({
    method: 'POST',
    baseUrl,
    path: `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    headers: { Authorization: `Bearer ${token}` },
  });
}
