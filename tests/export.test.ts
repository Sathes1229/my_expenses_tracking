import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { createBudget } from '@/lib/budgets';
import { buildTransactionsWorkbook } from '@/lib/export';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction, type TransactionInput } from '@/lib/transactions';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

function spend(who: Viewer, input: Partial<TransactionInput> & { merchant: string; totalSen: number; day: string; time: string }) {
  const { day, time, ...rest } = input;
  return createTransaction(who, { paymentMethod: 'qr', budgetId: null, items: [], ...rest, occurredAt: fromLocalDateTime(day, time) });
}

async function read(buffer: Buffer) {
  const book = new ExcelJS.Workbook();
  // exceljs declares its own Buffer type; the bytes are the same.
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
  const rows = (index: number) => {
    const sheet = book.worksheets[index];
    const out: unknown[][] = [];
    sheet.eachRow((row) => out.push((row.values as unknown[]).slice(1)));
    return out;
  };
  return { book, names: book.worksheets.map((s) => s.name), transactions: rows(0), items: rows(1) };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T04:00:00Z') });
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('ali', 'Ali', 'guest');
  const groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 80000 })).id;
  await spend(member, {
    merchant: 'Tesco',
    totalSen: 1250,
    budgetId: groceries,
    paymentMethod: 'card',
    day: '2026-11-03',
    time: '10:00',
    receiptNumber: 'R-1',
    note: 'weekly',
    items: [
      { name: 'Rice', quantity: 2, unitPriceSen: 500, lineTotalSen: 1000 },
      { name: 'Eggs', quantity: 1, unitPriceSen: 250, lineTotalSen: 250 },
    ],
  });
  await spend(guest, { merchant: 'Mamak', totalSen: 800, day: '2026-11-04', time: '12:00' });
  await spend(owner, { merchant: '=HYPERLINK("http://x","y")', totalSen: 300, paymentMethod: 'cash', day: '2026-11-05', time: '09:00', note: '+cmd' });
});

afterEach(() => vi.useRealTimers());

describe('buildTransactionsWorkbook', () => {
  it('names the sheets and headings in the chosen language', async () => {
    const en = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'en'));
    expect(en.names).toEqual(['Transactions', 'Items']);
    expect(en.transactions[0]).toEqual(['Date', 'Time', 'Merchant', 'Total (RM)', 'Budget', 'Paid with', 'Added by', 'Receipt number', 'Note']);
    expect(en.items[0]).toEqual(['Date', 'Merchant', 'Item', 'Quantity', 'Unit price (RM)', 'Line total (RM)']);

    const ms = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'ms'));
    expect(ms.names).toEqual(['Transaksi', 'Item']);
    expect(ms.transactions[0]).toEqual(['Tarikh', 'Masa', 'Kedai', 'Jumlah (RM)', 'Bajet', 'Dibayar dengan', 'Ditambah oleh', 'Nombor resit', 'Nota']);
  });

  it('writes one row per transaction, newest first, with numbers for totals and a total row', async () => {
    const { book, transactions } = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'en'));
    expect(transactions.slice(1, 4).map((row) => row[2])).toEqual(['=HYPERLINK("http://x","y")', 'Mamak', 'Tesco']);
    expect(transactions[3]).toEqual(['2026-11-03', '10:00', 'Tesco', 12.5, 'Groceries', 'Card', 'Siti', 'R-1', 'weekly']);
    expect(transactions[4].slice(2, 4)).toEqual(['Total', 23.5]);
    expect(book.worksheets[0].getCell('D4').numFmt).toContain('RM');
  });

  it('translates Uncategorised and the payment method', async () => {
    const en = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'en'));
    expect(en.transactions[2].slice(4, 6)).toEqual(['Uncategorised', 'QR']);
    const ms = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'ms'));
    expect(ms.transactions[2].slice(4, 6)).toEqual(['Tanpa kategori', 'QR']);
    expect(ms.transactions[1][5]).toBe('Tunai');
    expect(ms.transactions[4][2]).toBe('Jumlah');
  });

  it('lists every item of every transaction', async () => {
    const { items } = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'en'));
    expect(items.slice(1)).toEqual([
      ['2026-11-03', 'Tesco', 'Rice', 2, 5, 10],
      ['2026-11-03', 'Tesco', 'Eggs', 1, 2.5, 2.5],
    ]);
  });

  it("holds only a guest's own transactions in a guest's export", async () => {
    const { transactions, items } = await read(await buildTransactionsWorkbook(guest, { month: '2026-11' }, 'en'));
    expect(transactions.slice(1).map((row) => row[2])).toEqual(['Mamak', 'Total']);
    expect(items).toHaveLength(1);
  });

  it('writes formula-like text as text, never as a formula', async () => {
    const { book } = await read(await buildTransactionsWorkbook(member, { month: '2026-11' }, 'en'));
    const merchant = book.worksheets[0].getCell('C2');
    const note = book.worksheets[0].getCell('I2');
    expect(merchant.type).toBe(ExcelJS.ValueType.String);
    expect(merchant.value).toBe('=HYPERLINK("http://x","y")');
    expect(note.type).toBe(ExcelJS.ValueType.String);
    expect(note.value).toBe('+cmd');
  });

  it('gives a valid workbook with a zero total for a month with no transactions', async () => {
    const { transactions, items } = await read(await buildTransactionsWorkbook(member, { month: '2026-09' }, 'en'));
    expect(transactions).toHaveLength(2);
    expect(transactions[1].slice(2, 4)).toEqual(['Total', 0]);
    expect(items).toHaveLength(1);
  });
});

describe('GET /api/export', () => {
  it('refuses a signed-out request and sends a member the file for the month in the address', async () => {
    const { GET } = await import('@/app/api/export/route');
    const { sessionHeaders } = await import('./helpers/session');
    const signedOut = await GET(new Request('http://localhost/api/export?month=2026-11'));
    expect(signedOut.status).toBe(401);

    const res = await GET(new Request('http://localhost/api/export?month=2026-11&method=card', { headers: await sessionHeaders('siti', 'password1') }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="my-expenses-2026-11.xlsx"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { transactions } = await read(Buffer.from(await res.arrayBuffer()));
    expect(transactions.slice(1).map((row) => row[2])).toEqual(['Tesco', 'Total']);
  });
});
