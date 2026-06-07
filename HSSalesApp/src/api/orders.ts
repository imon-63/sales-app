import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Order, OrderItem, OrderPayment } from '../types/models';
import { requestGraphql } from './http';

const ORDER_FIELDS = `id orderNumber status customerName customerPhone customerAddress orderDate expectedDelivery confirmedDate processingDate outForDeliveryDate deliveredDate warehouseId advancePaid notes createdBy cancelReason stockReserved`;
const ITEM_FIELDS = `id orderId productId quantity unitPrice currencyId lotIds lotAllocations`;
const PMT_FIELDS = `id orderId amount notes paidAt recordedBy orderStep`;

export async function fetchOrders(token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ orders: Order[]; orderItems: OrderItem[]; orderPayments: OrderPayment[] }>({
    baseUrl, token,
    query: `query FetchOrders { orders { ${ORDER_FIELDS} } orderItems { ${ITEM_FIELDS} } orderPayments { ${PMT_FIELDS} } }`,
  });
  return data;
}

export type LotAllocation = { lotId: string; quantity: number };
export type CreateOrderLine = { productId: string; quantity: number; unitPrice: number; currencyId?: string; lotIds?: string[]; lotAllocations?: string };
export type CreateOrderPayload = {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  orderDate: string;
  expectedDelivery?: string;
  warehouseId?: string;
  advancePaid?: number;
  notes?: string;
  items: CreateOrderLine[];
};

export async function createOrder(input: CreateOrderPayload, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ createOrder: Order }, { input: CreateOrderPayload }>({
    baseUrl, token,
    query: `mutation CreateOrder($input: CreateOrderInput!) { createOrder(input: $input) { ${ORDER_FIELDS} } }`,
    variables: { input },
  });
  return data.createOrder;
}

export async function updateOrder(id: string, input: Partial<CreateOrderPayload>, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateOrder: Order }, { id: string; input: Partial<CreateOrderPayload> }>({
    baseUrl, token,
    query: `mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) { updateOrder(id: $id, input: $input) { ${ORDER_FIELDS} } }`,
    variables: { id, input },
  });
  return data.updateOrder;
}

export async function updateOrderStatus(id: string, status: string, cancelReason?: string, token = '', baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateOrderStatus: Order }, { id: string; status: string; cancelReason?: string }>({
    baseUrl, token,
    query: `mutation UpdateOrderStatus($id: ID!, $status: String!, $cancelReason: String) { updateOrderStatus(id: $id, status: $status, cancelReason: $cancelReason) { ${ORDER_FIELDS} } }`,
    variables: { id, status, cancelReason },
  });
  return data.updateOrderStatus;
}

export async function deleteOrder(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteOrder: boolean }, { id: string }>({
    baseUrl, token,
    query: `mutation DeleteOrder($id: ID!) { deleteOrder(id: $id) }`,
    variables: { id },
  });
  return data.deleteOrder;
}

export async function fetchOrderPayments(orderId: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ orderPayments: OrderPayment[] }, { orderId: string }>({
    baseUrl, token,
    query: `query FetchOrderPayments($orderId: ID!) { orderPayments(orderId: $orderId) { ${PMT_FIELDS} } }`,
    variables: { orderId },
  });
  return data.orderPayments;
}

export type AddPaymentInput = { orderId: string; amount: number; notes?: string; paidAt?: string };

export async function addOrderPayment(input: AddPaymentInput, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ addOrderPayment: OrderPayment }, { input: AddPaymentInput }>({
    baseUrl, token,
    query: `mutation AddOrderPayment($input: AddOrderPaymentInput!) { addOrderPayment(input: $input) { ${PMT_FIELDS} } }`,
    variables: { input },
  });
  return data.addOrderPayment;
}
