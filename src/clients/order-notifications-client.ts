import type {
  NotificationStatus,
  OReillyInvoiceSnapshot
} from '../data/store.js';

export interface OrderNotificationsClient {
  publishInvoiceSnapshot(snapshot: OReillyInvoiceSnapshot): Promise<Exclude<NotificationStatus, 'skipped' | 'failed'>>;
}

export function createOrderNotificationsClient(options: {
  baseUrl?: string;
  enabled?: boolean;
}): OrderNotificationsClient {
  const enabled = options.enabled ?? false;
  const baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');

  return {
    async publishInvoiceSnapshot(
      snapshot: OReillyInvoiceSnapshot
    ): Promise<'accepted' | 'duplicate'> {
      if (!enabled || !baseUrl) {
        throw new Error('Notifications client is disabled');
      }

      const response = await fetch(`${baseUrl}/stock-transfer-orders/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapshot)
      });

      if (!response.ok) {
        throw new Error(`Notification publish failed with status ${response.status}`);
      }

      const receipt = await response.json() as { status: 'accepted' | 'duplicate' };
      return receipt.status;
    }
  };
}

