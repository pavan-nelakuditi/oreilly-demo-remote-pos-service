import { Router, type Request, type Response } from 'express';

import {
  buildInvoiceSnapshot,
  createRemoteInvoice,
  type CustomerValidationStatus,
  getRemoteInvoice,
  type InvoiceCustomerSnapshot,
  type LineItemQuantityWithPrice,
  type NotificationStatus,
  type RemoteInvoiceCreateRequest,
  type StockTransferResponse
} from '../data/store.js';

import type { CustomersClient } from '../clients/customers-client.js';
import type { OrderNotificationsClient } from '../clients/order-notifications-client.js';

function createRemoteInvoicesRouter(dependencies: {
  customersClient?: CustomersClient;
  orderNotificationsClient?: OrderNotificationsClient;
  enableCustomerValidation?: boolean;
  enableOrderNotification?: boolean;
}) {
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

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringArrayItem(item: unknown): item is { line: string; item: string; quantity: number } {
  return (
    isObject(item) &&
    typeof item.line === 'string' &&
    typeof item.item === 'string' &&
    isPositiveInteger(item.quantity)
  );
}

function isPricedItem(item: unknown): item is LineItemQuantityWithPrice {
  return (
    isObject(item) &&
    typeof item.line === 'string' &&
    typeof item.item === 'string' &&
    isPositiveInteger(item.quantity) &&
    isNonNegativeNumber(item.price)
  );
}

function isStockTransferResponse(item: unknown): item is StockTransferResponse {
  return (
    isObject(item) &&
    typeof item.transferId === 'string' &&
    typeof item.status === 'string' &&
    typeof item.location === 'string' &&
    typeof item.locationCityState === 'string' &&
    Array.isArray(item.items) &&
    item.items.every(isStringArrayItem)
  );
}

function isRemoteInvoiceCreateRequest(payload: unknown): payload is RemoteInvoiceCreateRequest {
  return (
    isObject(payload) &&
    isPositiveInteger(payload.storeNumber) &&
    isPositiveInteger(payload.counterNumber) &&
    isObject(payload.customer) &&
    isPositiveInteger(payload.customer.customerNumber) &&
    typeof payload.delivery === 'boolean' &&
    Array.isArray(payload.items) &&
    payload.items.length > 0 &&
    payload.items.every(isPricedItem) &&
    (payload.freight === undefined || isNonNegativeNumber(payload.freight)) &&
    (payload.serviceCharges === undefined || isNonNegativeNumber(payload.serviceCharges)) &&
    (payload.stockTransfers === undefined ||
      (Array.isArray(payload.stockTransfers) &&
        payload.stockTransfers.every(isStockTransferResponse)))
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

  router.post('/', async (request: Request, response: Response) => {
    if (!isRemoteInvoiceCreateRequest(request.body)) {
      return response.status(400).json(
        buildErrorResponse(
          'INVALID_REQUEST',
          'Remote invoice request body did not match the expected contract.',
          correlationIdFrom(response)
        )
      );
    }

    let customerValidationStatus: CustomerValidationStatus = 'skipped';
    let customerSnapshot: InvoiceCustomerSnapshot | undefined;
    if (dependencies.enableCustomerValidation) {
      try {
        customerSnapshot = await dependencies.customersClient?.getCustomerSnapshot(
          request.body.customer.customerNumber
        ) ?? undefined;
        customerValidationStatus = customerSnapshot ? 'validated' : 'not-found';
      } catch {
        customerValidationStatus = 'not-found';
      }
    }

    let notificationStatus: NotificationStatus = 'skipped';
    const created = createRemoteInvoice(request.body, {
      customerValidationStatus,
      notificationStatus
    });

    if (dependencies.enableOrderNotification) {
      try {
        notificationStatus =
          await dependencies.orderNotificationsClient?.publishInvoiceSnapshot(
            buildInvoiceSnapshot(created, customerSnapshot)
          ) ?? 'failed';
      } catch {
        notificationStatus = 'failed';
      }
      created.notificationStatus = notificationStatus;
    }

    return response.status(201).json({
      invoiceNumber: created.invoiceNumber,
      invoiceTotal: created.invoiceTotal,
      transferResponses: created.transferResponses,
      customerValidationStatus: created.customerValidationStatus,
      notificationStatus: created.notificationStatus
    });
  });

  router.get('/:invoiceNumber', (request: Request, response: Response) => {
    const invoiceNumber = readRouteParam(request.params.invoiceNumber);
    const invoice = getRemoteInvoice(invoiceNumber);

    if (!invoice) {
      return response.status(404).json(
        buildErrorResponse(
          'NOT_FOUND',
          `Remote invoice ${invoiceNumber} was not found.`,
          correlationIdFrom(response)
        )
      );
    }

    return response.json(invoice);
  });

  return router;
}

export { createRemoteInvoicesRouter };
