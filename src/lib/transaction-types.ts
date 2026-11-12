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

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  qr: 'QR',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

export const UNCATEGORISED = 'Uncategorised';
