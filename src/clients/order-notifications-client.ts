import type {
  NotificationStatus,
  OReillyInvoiceSnapshot
} from '../data/store.js';
import { fetchJson } from './fetch-json.js';

export interface OrderNotificationsClient {
  publishInvoiceSnapshot(snapshot: OReillyInvoiceSnapshot): Promise<Exclude<NotificationStatus, 'skipped' | 'failed'>>;
}

export function createOrderNotificationsClient(options: {
  baseUrl?: string;
  enabled?: boolean;
  timeoutMs?: number;
}): OrderNotificationsClient {
  const enabled = options.enabled ?? false;
  const baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 2_000;

  return {
    async publishInvoiceSnapshot(
      snapshot: OReillyInvoiceSnapshot
    ): Promise<'accepted' | 'duplicate'> {
      if (!enabled || !baseUrl) {
        throw new Error('Notifications client is disabled');
      }

      const response = await fetchJson(
        `${baseUrl}/stock-transfer-orders/notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(snapshot),
          timeoutMs
        }
      );

      if (!response.ok) {
        throw new Error(`Notification publish failed with status ${response.status}`);
      }

      const receipt = await response.json() as { status: 'accepted' | 'duplicate' };
      return receipt.status;
    }
  };
}
