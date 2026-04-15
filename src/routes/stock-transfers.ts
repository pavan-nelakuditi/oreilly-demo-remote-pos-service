import { Router, type Request, type Response } from 'express';

import {
  createStockTransfer,
  getStockTransfer,
  type StockTransferCreateRequest
} from '../data/store.js';

const router = Router();

function buildErrorResponse(code: string, message: string, correlationId: string) {
  return { code, message, correlationId };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isLineItemQuantity(item: unknown): item is { line: string; item: string; quantity: number } {
  return (
    isObject(item) &&
    typeof item.line === 'string' &&
    typeof item.item === 'string' &&
    isPositiveInteger(item.quantity)
  );
}

function isStockTransferCreateRequest(payload: unknown): payload is StockTransferCreateRequest {
  return (
    isObject(payload) &&
    isPositiveInteger(payload.counterNumber) &&
    isPositiveInteger(payload.receivingStoreNumber) &&
    isObject(payload.customer) &&
    isPositiveInteger(payload.customer.customerNumber) &&
    typeof payload.orderType === 'string' &&
    Array.isArray(payload.itemDetails) &&
    payload.itemDetails.length > 0 &&
    payload.itemDetails.every(isLineItemQuantity)
  );
}

function correlationIdFrom(response: Response): string {
  return String(response.locals.correlationId);
}

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

router.post('/', (request: Request, response: Response) => {
  if (!isStockTransferCreateRequest(request.body)) {
    return response.status(400).json(
      buildErrorResponse(
        'INVALID_REQUEST',
        'Stock transfer request body did not match the expected contract.',
        correlationIdFrom(response)
      )
    );
  }

  const created = createStockTransfer(request.body);
  return response.status(201).json(created);
});

router.get('/:transferId', (request: Request, response: Response) => {
  const transferId = readRouteParam(request.params.transferId);
  const transfer = getStockTransfer(transferId);

  if (!transfer) {
    return response.status(404).json(
      buildErrorResponse(
        'NOT_FOUND',
        `Stock transfer ${transferId} was not found.`,
        correlationIdFrom(response)
      )
    );
  }

  return response.json(transfer);
});

export { router as stockTransfersRouter };
