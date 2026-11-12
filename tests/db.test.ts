import { describe, expect, it } from 'vitest';
import { getTableName, isTable } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { resetDb } from './helpers/db';

const expectedTables = [
  'invites', 'login_attempts', 'budgets', 'budget_allocations', 'transactions',
  'transaction_items', 'receipt_uploads', 'notifications', 'notification_reads',
  'debts', 'debt_payments', 'chat_messages', 'ai_usage', 'settings',
];

describe('database', () => {
  it('creates every table and tolerates running migrations twice', () => {
    expect(() => runMigrations()).not.toThrow();
    expect(() => runMigrations()).not.toThrow();
    const rows = db.$client
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    for (const t of expectedTables) expect(names).toContain(t);
  });

  it('declares a schema table for each expected table', () => {
    const declared = Object.values(schema).filter(isTable).map(getTableName).sort();
    expect(declared).toEqual([...expectedTables].sort());
  });

  it('resetDb empties tables', async () => {
    await db.insert(schema.settings).values({ key: 'k', value: '"v"' });
    await resetDb();
    expect(await db.select().from(schema.settings)).toEqual([]);
  });
});
