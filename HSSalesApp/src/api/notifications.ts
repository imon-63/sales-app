import { getJsonServerBaseUrl } from '../config/apiBase';
import type { AdminNotification } from '../types/models';
import { requestGraphql } from './http';

export async function createNotification(
  payload: Omit<AdminNotification, 'id' | 'createdAt'>,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<
    { createNotification: AdminNotification },
    {
      input: {
        type: string;
        saleId?: string;
        lotId?: string;
        title: string;
        body: string;
        actorUserId: string;
        readByUserIds?: string[];
      };
    }
  >({
    baseUrl,
    token,
    query: `
      mutation CreateNotification($input: CreateNotificationInput!) {
        createNotification(input: $input) {
          id
          type
          saleId
          lotId
          title
          body
          createdAt
          actorUserId
          unread
        }
      }
    `,
    variables: {
      input: {
        type: payload.type,
        saleId: payload.saleId,
        lotId: payload.lotId,
        title: payload.title,
        body: payload.body,
        actorUserId: payload.actorUserId,
        readByUserIds: payload.readByUserIds,
      },
    },
  });
  return data.createNotification;
}

export async function fetchNotifications(
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<{ notifications: AdminNotification[] }>({
    baseUrl,
    token,
    query: `
      query Notifications {
        notifications {
          id
          type
          saleId
          lotId
          title
          body
          createdAt
          actorUserId
          unread
        }
      }
    `,
  });
  return data.notifications;
}

export async function markNotificationRead(
  id: string,
  token: string,
  baseUrl = getJsonServerBaseUrl(),
) {
  const data = await requestGraphql<{ markNotificationRead: boolean }, { id: string }>({
    baseUrl,
    token,
    query: `
      mutation MarkNotificationRead($id: ID!) {
        markNotificationRead(id: $id)
      }
    `,
    variables: { id },
  });
  return { ok: data.markNotificationRead };
}
