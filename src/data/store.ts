export interface CustomerRef {
  customerNumber: number;
}

export interface LineItemQuantity {
  line: string;
  item: string;
  quantity: number;
}

export interface LineItemQuantityWithPrice extends LineItemQuantity {
  price: number;
  corePrice?: number;
}

export interface StockTransferCreateRequest {
  counterNumber: number;
  receivingStoreNumber: number;
  customer: CustomerRef;
  orderType: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToCity?: string;
  shipToState?: string;
  itemDetails: LineItemQuantity[];
}

export type StockTransferStatus = 'success' | 'failure' | 'pending';

export interface StockTransferResponse {
  transferId: string;
  status: StockTransferStatus;
  location: string;
  locationCityState: string;
  items: LineItemQuantity[];
}

export interface RemoteInvoiceCreateRequest {
  storeNumber: number;
  counterNumber: number;
  customer: CustomerRef;
  delivery: boolean;
  shippingInstructions?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToCity?: string;
  shipToState?: string;
  poNumber?: string;
  items: LineItemQuantityWithPrice[];
  freight?: number;
  serviceCharges?: number;
  stockTransfers?: StockTransferResponse[];
}

export interface RemoteInvoiceCreateResponse {
  invoiceNumber: string;
  invoiceTotal: number;
  transferResponses: StockTransferResponse[];
  customerValidationStatus: CustomerValidationStatus;
  notificationStatus: NotificationStatus;
}

export interface RemoteInvoice extends RemoteInvoiceCreateRequest {
  invoiceNumber: string;
  invoiceTotal: number;
  transferResponses: StockTransferResponse[];
  customerValidationStatus: CustomerValidationStatus;
  notificationStatus: NotificationStatus;
  createdAt: string;
}

export type CustomerValidationStatus = 'skipped' | 'validated' | 'not-found';
export type NotificationStatus = 'skipped' | 'accepted' | 'duplicate' | 'failed';

export interface InvoiceCustomerSnapshot {
  customerNumber: number;
  customerName: string;
  customerAddress1?: string;
  customerCity?: string;
  customerState?: string;
  customerZipCode?: string;
  customerPhone?: string;
  customerType?: string;
}

export interface OReillyInvoiceSnapshot {
  invoiceNumber: string;
  legacyId?: string;
  enactorId?: string;
  counterNumber: number;
  customerInfo: InvoiceCustomerSnapshot;
  delivery: boolean;
  items: LineItemQuantity[];
  invoiceTotal: number;
  createdAt: string;
  sourceSystem: 'remote-pos' | 'posrest' | 'electronicordering';
}

const locationDirectory: Record<number, { location: string; locationCityState: string }> = {
  118: { location: 'Store 118', locationCityState: 'Tulsa, OK' },
  221: { location: 'Store 221', locationCityState: 'Springfield, MO' }
};

let invoiceCounter = 1001;
let transferCounter = 2001;
const invoices = new Map<string, RemoteInvoice>();
const stockTransfers = new Map<string, StockTransferResponse>();

function seedWorkshopRecords(): void {
  const seededTransfer: StockTransferResponse = {
    transferId: 'ST-2001',
    status: 'success',
    location: 'Store 118',
    locationCityState: 'Tulsa, OK',
    items: [{ line: 'IGN', item: 'PLUG-001', quantity: 2 }]
  };

  const seededInvoice: RemoteInvoice = {
    invoiceNumber: 'INV-1001',
    storeNumber: 221,
    counterNumber: 4,
    customer: { customerNumber: 90001234 },
    delivery: true,
    items: [{ line: 'IGN', item: 'PLUG-001', quantity: 2, price: 12.99 }],
    freight: 5,
    serviceCharges: 2.5,
    transferResponses: [],
    invoiceTotal: 33.48,
    customerValidationStatus: 'validated',
    notificationStatus: 'accepted',
    createdAt: '2026-04-10T12:00:00.000Z'
  };

  stockTransfers.set(seededTransfer.transferId, seededTransfer);
  invoices.set(seededInvoice.invoiceNumber, seededInvoice);
  transferCounter = 2002;
  invoiceCounter = 1002;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTransferLocation(receivingStoreNumber: number) {
  return (
    locationDirectory[receivingStoreNumber] ?? {
      location: `Store ${receivingStoreNumber}`,
      locationCityState: 'Unknown City, NA'
    }
  );
}

export function createStockTransfer(
  payload: StockTransferCreateRequest
): StockTransferResponse {
  const transferId = `ST-${transferCounter}`;
  transferCounter += 1;

  const location = getTransferLocation(payload.receivingStoreNumber);
  const response: StockTransferResponse = {
    transferId,
    status: 'success',
    location: location.location,
    locationCityState: location.locationCityState,
    items: payload.itemDetails
  };

  stockTransfers.set(transferId, response);
  return response;
}

export function getStockTransfer(transferId: string): StockTransferResponse | undefined {
  return stockTransfers.get(transferId);
}

export function createRemoteInvoice(
  payload: RemoteInvoiceCreateRequest,
  metadata: {
    customerValidationStatus: CustomerValidationStatus;
    notificationStatus: NotificationStatus;
  }
): RemoteInvoice {
  const invoiceNumber = `INV-${invoiceCounter}`;
  invoiceCounter += 1;

  const invoiceTotal = roundMoney(
    payload.items.reduce((sum, item) => sum + item.quantity * item.price, 0) +
      (payload.freight ?? 0) +
      (payload.serviceCharges ?? 0)
  );

  const invoice: RemoteInvoice = {
    ...payload,
    invoiceNumber,
    invoiceTotal,
    transferResponses: payload.stockTransfers ?? [],
    customerValidationStatus: metadata.customerValidationStatus,
    notificationStatus: metadata.notificationStatus,
    createdAt: new Date().toISOString()
  };

  invoices.set(invoiceNumber, invoice);
  return invoice;
}

export function getRemoteInvoice(invoiceNumber: string): RemoteInvoice | undefined {
  return invoices.get(invoiceNumber);
}

export function buildInvoiceSnapshot(invoice: RemoteInvoice, customerSnapshot?: InvoiceCustomerSnapshot): OReillyInvoiceSnapshot {
  return {
    invoiceNumber: invoice.invoiceNumber,
    legacyId: `LEG-${invoice.invoiceNumber.slice(4)}`,
    enactorId: `EN-${invoice.counterNumber}`,
    counterNumber: invoice.counterNumber,
    customerInfo: customerSnapshot ?? {
      customerNumber: invoice.customer.customerNumber,
      customerName: `Customer ${invoice.customer.customerNumber}`
    },
    delivery: invoice.delivery,
    items: invoice.items.map((item) => ({
      line: item.line,
      item: item.item,
      quantity: item.quantity
    })),
    invoiceTotal: invoice.invoiceTotal,
    createdAt: invoice.createdAt,
    sourceSystem: 'remote-pos'
  };
}

export function resetStore(): void {
  invoiceCounter = 1001;
  transferCounter = 2001;
  invoices.clear();
  stockTransfers.clear();
}

seedWorkshopRecords();
