import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getTableName, isTable } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { resetDb } from './helpers/db';

const expectedTables = [
  'invites', 'login_attempts', 'budgets', 'budget_allocations', 'transactions',
  'transaction_items', 'receipt_uploads', 'notifications', 'notification_reads',
  'debts', 'debt_payments', 'chat_messages', 'ai_usage', 'settings',
  'user', 'session', 'account', 'verification',
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

describe('opening the database', () => {
  it('creates no folder or file on import, only on first use', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'my-expenses-lazy-'));
    const path = join(dir, 'nested', 'app.db');
    const previous = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = path;
    vi.resetModules();
    let fresh: typeof db | undefined;
    try {
      fresh = (await import('@/db/client')).db;
      expect(existsSync(join(dir, 'nested'))).toBe(false);

      expect(fresh.$client.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(fresh.$client.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(existsSync(path)).toBe(true);
    } finally {
      if (existsSync(path)) fresh?.$client.close();
      process.env.DATABASE_PATH = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
