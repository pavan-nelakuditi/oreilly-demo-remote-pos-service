import { app } from './app.js';

const port = Number(process.env.PORT || 3000);
const customerValidationEnabled = process.env.ENABLE_CUSTOMER_VALIDATION === 'true';
const notificationsEnabled = process.env.ENABLE_ORDER_NOTIFICATION === 'true';
const customersServiceBaseUrl = process.env.CUSTOMERS_SERVICE_BASE_URL || '(not configured)';
const orderNotificationsServiceBaseUrl =
  process.env.ORDER_NOTIFICATIONS_SERVICE_BASE_URL || '(not configured)';

const server = app.listen(port, () => {
  console.log(`remote-pos-service listening on http://localhost:${port}`);
  console.log(
    `customer validation: ${customerValidationEnabled ? 'enabled' : 'disabled'} -> ${customersServiceBaseUrl}`
  );
  console.log(
    `order notifications: ${notificationsEnabled ? 'enabled' : 'disabled'} -> ${orderNotificationsServiceBaseUrl}`
  );
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`remote-pos-service received ${signal}; shutting down`);
  server.close((error) => {
    if (error) {
      console.error('remote-pos-service failed to shut down cleanly', error);
      process.exitCode = 1;
    }
    process.exit();
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(signal));
}
