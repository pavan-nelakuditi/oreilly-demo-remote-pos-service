import type { InvoiceCustomerSnapshot } from '../data/store.js';

export interface CustomersClient {
  getCustomerSnapshot(customerNumber: number): Promise<InvoiceCustomerSnapshot | null>;
}

export function createCustomersClient(options: {
  baseUrl?: string;
  enabled?: boolean;
}): CustomersClient {
  const enabled = options.enabled ?? false;
  const baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');

  return {
    async getCustomerSnapshot(customerNumber: number): Promise<InvoiceCustomerSnapshot | null> {
      if (!enabled || !baseUrl) {
        return null;
      }

      const response = await fetch(`${baseUrl}/customers/pro/${customerNumber}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Customer lookup failed with status ${response.status}`);
      }

      const customer = await response.json() as {
        customerNumber: number;
        customerName: string;
        customerAddress?: string;
        customerCity?: string;
        customerState?: string;
        customerZipCode?: string;
        customerPhone?: string;
        customerType?: string;
      };

      return {
        customerNumber: customer.customerNumber,
        customerName: customer.customerName,
        customerAddress1: customer.customerAddress,
        customerCity: customer.customerCity,
        customerState: customer.customerState,
        customerZipCode: customer.customerZipCode,
        customerPhone: customer.customerPhone,
        customerType: customer.customerType ?? 'pro'
      };
    }
  };
}

