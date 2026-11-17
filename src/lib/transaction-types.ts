// Types and constants shared by the server code and the transaction form. No database import, so the
// client form can use them.

export type PaymentMethod = 'qr' | 'cash' | 'card' | 'other';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['qr', 'cash', 'card', 'other'];

export type ItemInput = { name: string; quantity: number; unitPriceSen: number; lineTotalSen: number };

export type TransactionInput = {
  merchant: string;
  occurredAt: Date;
  receiptNumber?: string;
  totalSen: number;
  paymentMethod: PaymentMethod;
  budgetId: string | null;
  note?: string;
  items: ItemInput[];
  receiptUploadId?: string;
};

// The budgetName rows get when they have no budget. Screens show common.uncategorised from the catalog instead.
export const UNCATEGORISED = 'Uncategorised';
