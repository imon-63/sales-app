import { getJsonServerBaseUrl } from '../config/apiBase';
import type { Production } from '../types/models';
import { requestGraphql } from './http';

const PROD_FIELDS = `id productionNumber status orderDate startDate completedDate cancelDate inputLotBatchId inputQuantity inputLots processingCostPerUnit extraCosts outputProductId expectedOutputQty actualOutputQty effectiveCostPerOutputUnit outputLotBatchId cancelReason bottlePrices notes createdBy`;

export async function fetchProductions(token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ productions: Production[] }>({
    baseUrl, token,
    query: `query FetchProductions { productions { ${PROD_FIELDS} } }`,
  });
  return data.productions;
}

export type ExtraCostInput = { label: string; amount: number };
export type ProductionInputLotInput = { lotBatchId: string; quantity: number };

export type CreateProductionInput = {
  inputLots: ProductionInputLotInput[];
  processingCostPerUnit?: number;
  extraCosts?: ExtraCostInput[];
  outputProductId: string;
  expectedOutputQty?: number;
  notes?: string;
  orderDate?: string;
};

export async function createProduction(input: CreateProductionInput, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ createProduction: Production }, { input: CreateProductionInput }>({
    baseUrl, token,
    query: `mutation CreateProduction($input: CreateProductionInput!) { createProduction(input: $input) { ${PROD_FIELDS} } }`,
    variables: { input },
  });
  return data.createProduction;
}

export async function updateProduction(id: string, input: Partial<CreateProductionInput>, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ updateProduction: Production }, { id: string; input: Partial<CreateProductionInput> }>({
    baseUrl, token,
    query: `mutation UpdateProduction($id: ID!, $input: UpdateProductionInput!) { updateProduction(id: $id, input: $input) { ${PROD_FIELDS} } }`,
    variables: { id, input },
  });
  return data.updateProduction;
}

export async function updateProductionStatus(
  id: string,
  status: string,
  actualOutputQty?: number,
  cancelReasonOrBottlePrices?: string,
  token = '',
  baseUrl = getJsonServerBaseUrl(),
) {
  const variables: Record<string, unknown> = { id, status, actualOutputQty };
  if (status === 'cancelled') variables.cancelReason = cancelReasonOrBottlePrices;
  if (status === 'completed') variables.bottlePrices = cancelReasonOrBottlePrices;

  const data = await requestGraphql<{ updateProductionStatus: Production }, typeof variables>({
    baseUrl, token,
    query: `mutation UpdateProductionStatus($id: ID!, $status: String!, $actualOutputQty: Float, $cancelReason: String, $bottlePrices: String) { updateProductionStatus(id: $id, status: $status, actualOutputQty: $actualOutputQty, cancelReason: $cancelReason, bottlePrices: $bottlePrices) { ${PROD_FIELDS} } }`,
    variables,
  });
  return data.updateProductionStatus;
}

export async function deleteProduction(id: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ deleteProduction: boolean }, { id: string }>({
    baseUrl, token,
    query: `mutation DeleteProduction($id: ID!) { deleteProduction(id: $id) }`,
    variables: { id },
  });
  return data.deleteProduction;
}

export async function fetchConsumptionsForLot(lotId: string, token: string, baseUrl = getJsonServerBaseUrl()) {
  const data = await requestGraphql<{ productionConsumptionsForLot: import('../types/models').ProductionConsumption[] }, { lotId: string }>({
    baseUrl, token,
    query: `query FetchConsumptions($lotId: ID!) { productionConsumptionsForLot(lotId: $lotId) { id productionId productionNumber lotBatchId quantity consumedAt createdBy } }`,
    variables: { lotId },
  });
  return data.productionConsumptionsForLot;
}
