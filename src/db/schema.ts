import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// IDs are text UUIDs; timestamps are integer milliseconds; money is integer sen.
// Columns that point at users (createdBy, usedBy, uploadedBy, userId) have no foreign key
// until the user table arrives with auth.

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now());

export const invites = sqliteTable('invites', {
  id: id(),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: createdAt(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  usedBy: text('used_by'),
  revokedAt: integer('revoked_at'),
});

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: id(),
    key: text('key').notNull(),
    at: integer('at').notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
  },
  (t) => [index('login_attempts_key_at_idx').on(t.key, t.at)],
);

export const budgets = sqliteTable('budgets', {
  id: id(),
  name: text('name').notNull(),
  thresholdPct: integer('threshold_pct').notNull(),
  archivedAt: integer('archived_at'),
  createdAt: createdAt(),
});

export const budgetAllocations = sqliteTable(
  'budget_allocations',
  {
    budgetId: text('budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    fromMonth: text('from_month').notNull(),
    allocationSen: integer('allocation_sen').notNull(),
  },
  (t) => [primaryKey({ columns: [t.budgetId, t.fromMonth] })],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: id(),
    merchant: text('merchant').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    receiptNumber: text('receipt_number'),
    totalSen: integer('total_sen').notNull(),
    paymentMethod: text('payment_method').notNull(),
    // null means Uncategorised
    budgetId: text('budget_id').references(() => budgets.id, { onDelete: 'set null' }),
    note: text('note'),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    index('transactions_occurred_at_idx').on(t.occurredAt),
    index('transactions_budget_id_idx').on(t.budgetId),
  ],
);

export const transactionItems = sqliteTable(
  'transaction_items',
  {
    id: id(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    quantity: real('quantity').notNull(),
    unitPriceSen: integer('unit_price_sen').notNull(),
    lineTotalSen: integer('line_total_sen').notNull(),
  },
  (t) => [index('transaction_items_transaction_id_idx').on(t.transactionId)],
);

export const receiptUploads = sqliteTable('receipt_uploads', {
  id: id(),
  path: text('path').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: createdAt(),
  // null until the receipt is saved as a transaction
  transactionId: text('transaction_id').references(() => transactions.id, {
    onDelete: 'set null',
  }),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    budgetId: text('budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    level: text('level', { enum: ['threshold', 'over'] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('notifications_budget_month_level_uq').on(t.budgetId, t.month, t.level)],
);

export const notificationReads = sqliteTable(
  'notification_reads',
  {
    notificationId: text('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    readAt: integer('read_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
);

export const debts = sqliteTable('debts', {
  id: id(),
  personName: text('person_name').notNull(),
  amountSen: integer('amount_sen').notNull(),
  lentOn: text('lent_on').notNull(),
  dueOn: text('due_on'),
  note: text('note'),
  createdAt: createdAt(),
});

export const debtPayments = sqliteTable(
  'debt_payments',
  {
    id: id(),
    debtId: text('debt_id')
      .notNull()
      .references(() => debts.id, { onDelete: 'cascade' }),
    amountSen: integer('amount_sen').notNull(),
    paidOn: text('paid_on').notNull(),
  },
  (t) => [index('debt_payments_debt_id_idx').on(t.debtId)],
);

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: id(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('chat_messages_user_created_idx').on(t.userId, t.createdAt)],
);

export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: id(),
    userId: text('user_id').notNull(),
    day: text('day').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costMicroUsd: integer('cost_micro_usd').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_user_day_idx').on(t.userId, t.day)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON text
});
