import type { InvoiceCustomerSnapshot } from '../data/store.js';
import { fetchJson } from './fetch-json.js';

export interface CustomersClient {
  getCustomerSnapshot(customerNumber: number): Promise<InvoiceCustomerSnapshot | null>;
}

export function createCustomersClient(options: {
  baseUrl?: string;
  enabled?: boolean;
  timeoutMs?: number;
}): CustomersClient {
  const enabled = options.enabled ?? false;
  const baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 2_000;

  return {
    async getCustomerSnapshot(customerNumber: number): Promise<InvoiceCustomerSnapshot | null> {
      if (!enabled || !baseUrl) {
        return null;
      }

      const response = await fetchJson(
        `${baseUrl}/customers/pro/${customerNumber}`,
        { timeoutMs }
      );
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
