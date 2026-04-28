import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';

import {
  createCustomersClient,
  type CustomersClient
} from './clients/customers-client.js';
import {
  createOrderNotificationsClient,
  type OrderNotificationsClient
} from './clients/order-notifications-client.js';
import { createRemoteInvoicesRouter } from './routes/remote-invoices.js';
import { stockTransfersRouter } from './routes/stock-transfers.js';

export function createApp(options?: {
  customersClient?: CustomersClient;
  orderNotificationsClient?: OrderNotificationsClient;
  enableCustomerValidation?: boolean;
  enableOrderNotification?: boolean;
}) {
  const app = express();

  app.use(express.json());

  app.use((request: Request, response: Response, next: NextFunction) => {
    response.locals.correlationId =
      request.header('x-correlation-id') ?? crypto.randomUUID();
    next();
  });

  app.get('/health', (_request: Request, response: Response) => {
    response.json({ status: 'ok' });
  });

  app.use('/remote-invoices', createRemoteInvoicesRouter({
    customersClient: options?.customersClient ?? createCustomersClient({
      baseUrl: process.env.CUSTOMERS_SERVICE_BASE_URL,
      enabled: process.env.ENABLE_CUSTOMER_VALIDATION === 'true',
      timeoutMs: Number(process.env.CUSTOMERS_SERVICE_TIMEOUT_MS || 2000)
    }),
    orderNotificationsClient:
      options?.orderNotificationsClient ?? createOrderNotificationsClient({
        baseUrl: process.env.ORDER_NOTIFICATIONS_SERVICE_BASE_URL,
        enabled: process.env.ENABLE_ORDER_NOTIFICATION === 'true',
        timeoutMs: Number(process.env.ORDER_NOTIFICATIONS_SERVICE_TIMEOUT_MS || 2000)
      }),
    enableCustomerValidation:
      options?.enableCustomerValidation ?? process.env.ENABLE_CUSTOMER_VALIDATION === 'true',
    enableOrderNotification:
      options?.enableOrderNotification ?? process.env.ENABLE_ORDER_NOTIFICATION === 'true'
  }));
  app.use('/stock-transfers', stockTransfersRouter);

  app.use((request: Request, response: Response) => {
    response.status(404).json({
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.path} was not found.`,
      correlationId: String(response.locals.correlationId)
    });
  });

  return app;
}

export const app = createApp();
