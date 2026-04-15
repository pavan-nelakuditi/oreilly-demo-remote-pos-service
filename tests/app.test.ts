import inject from 'light-my-request';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { CustomersClient } from '../src/clients/customers-client.js';
import type { OrderNotificationsClient } from '../src/clients/order-notifications-client.js';
import { resetStore } from '../src/data/store.js';

describe('remote-pos-service', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates and retrieves a remote invoice', async () => {
    const app = createApp();
    const createResponse = await inject(app, {
      method: 'POST',
      url: '/remote-invoices',
      payload: {
        storeNumber: 221,
        counterNumber: 4,
        customer: { customerNumber: 90001234 },
        delivery: true,
        items: [
          { line: 'IGN', item: 'PLUG-001', quantity: 2, price: 12.99 },
          { line: 'FLT', item: 'OIL-445', quantity: 1, price: 8.5 }
        ],
        freight: 5,
        serviceCharges: 2.5
      }
    });
    const createBody = createResponse.json();

    expect(createResponse.statusCode).toBe(201);
    expect(createBody.invoiceNumber).toBe('INV-1001');
    expect(createBody.invoiceTotal).toBe(41.98);
    expect(createBody.transferResponses).toEqual([]);
    expect(createBody.customerValidationStatus).toBe('skipped');
    expect(createBody.notificationStatus).toBe('skipped');

    const getResponse = await inject(app, {
      method: 'GET',
      url: '/remote-invoices/INV-1001'
    });
    const getBody = getResponse.json();
    expect(getResponse.statusCode).toBe(200);
    expect(getBody.invoiceNumber).toBe('INV-1001');
    expect(getBody.customer.customerNumber).toBe(90001234);
    expect(getBody.invoiceTotal).toBe(41.98);
    expect(getBody.customerValidationStatus).toBe('skipped');
    expect(getBody.notificationStatus).toBe('skipped');
  });

  it('creates and retrieves a stock transfer', async () => {
    const app = createApp();
    const createResponse = await inject(app, {
      method: 'POST',
      url: '/stock-transfers',
      payload: {
        counterNumber: 4,
        receivingStoreNumber: 118,
        customer: { customerNumber: 90001234 },
        orderType: 'stock-transfer',
        itemDetails: [
          { line: 'IGN', item: 'PLUG-001', quantity: 2 }
        ]
      }
    });
    const createBody = createResponse.json();

    expect(createResponse.statusCode).toBe(201);
    expect(createBody.transferId).toBe('ST-2001');
    expect(createBody.status).toBe('success');
    expect(createBody.locationCityState).toBe('Tulsa, OK');

    const getResponse = await inject(app, {
      method: 'GET',
      url: '/stock-transfers/ST-2001'
    });
    const getBody = getResponse.json();
    expect(getResponse.statusCode).toBe(200);
    expect(getBody.transferId).toBe('ST-2001');
    expect(getBody.items).toHaveLength(1);
  });

  it('returns a contract-shaped error for missing resources', async () => {
    const app = createApp();
    const invoiceResponse = await inject(app, {
      method: 'GET',
      url: '/remote-invoices/INV-9999'
    });
    const invoiceBody = invoiceResponse.json();
    expect(invoiceResponse.statusCode).toBe(404);
    expect(invoiceBody.code).toBe('NOT_FOUND');
    expect(typeof invoiceBody.correlationId).toBe('string');

    const transferResponse = await inject(app, {
      method: 'GET',
      url: '/stock-transfers/ST-9999'
    });
    const transferBody = transferResponse.json();
    expect(transferResponse.statusCode).toBe(404);
    expect(transferBody.code).toBe('NOT_FOUND');
    expect(typeof transferBody.correlationId).toBe('string');
  });

  it('rejects invalid request bodies at the API boundary', async () => {
    const app = createApp();
    const response = await inject(app, {
      method: 'POST',
      url: '/remote-invoices',
      payload: {
        storeNumber: 221,
        counterNumber: 4,
        customer: { customerNumber: 'not-a-number' },
        delivery: true,
        items: []
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(typeof body.correlationId).toBe('string');
  });

  it('validates customer references and publishes invoice snapshots when integrations are enabled', async () => {
    const customersClient: CustomersClient = {
      async getCustomerSnapshot(customerNumber) {
        return {
          customerNumber,
          customerName: 'OReilly Test Garage',
          customerAddress1: '123 Pilot Way',
          customerCity: 'Springfield',
          customerState: 'MO',
          customerZipCode: '65807',
          customerPhone: '417-555-0188',
          customerType: 'pro'
        };
      }
    };
    const orderNotificationsClient: OrderNotificationsClient = {
      async publishInvoiceSnapshot(snapshot) {
        expect(snapshot.customerInfo.customerName).toBe('OReilly Test Garage');
        return 'accepted';
      }
    };
    const app = createApp({
      customersClient,
      orderNotificationsClient,
      enableCustomerValidation: true,
      enableOrderNotification: true
    });

    const response = await inject(app, {
      method: 'POST',
      url: '/remote-invoices',
      payload: {
        storeNumber: 221,
        counterNumber: 4,
        customer: { customerNumber: 90001234 },
        delivery: true,
        items: [
          { line: 'IGN', item: 'PLUG-001', quantity: 2, price: 12.99 }
        ]
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.customerValidationStatus).toBe('validated');
    expect(body.notificationStatus).toBe('accepted');

    const getResponse = await inject(app, {
      method: 'GET',
      url: '/remote-invoices/INV-1001'
    });
    const getBody = getResponse.json();
    expect(getBody.customerValidationStatus).toBe('validated');
    expect(getBody.notificationStatus).toBe('accepted');
  });

  it('marks customer validation as not-found when the customer lookup misses', async () => {
    const customersClient: CustomersClient = {
      async getCustomerSnapshot() {
        return null;
      }
    };
    const app = createApp({
      customersClient,
      enableCustomerValidation: true,
      enableOrderNotification: false
    });

    const response = await inject(app, {
      method: 'POST',
      url: '/remote-invoices',
      payload: {
        storeNumber: 221,
        counterNumber: 4,
        customer: { customerNumber: 12345 },
        delivery: true,
        items: [
          { line: 'IGN', item: 'PLUG-001', quantity: 1, price: 10 }
        ]
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.customerValidationStatus).toBe('not-found');
    expect(body.notificationStatus).toBe('skipped');
  });
});
