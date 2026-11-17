import ExcelJS from 'exceljs';
import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';
import type { Viewer } from '@/lib/auth/viewer';
import { dayKey, timeKey } from './time';
import { extrasFor, listTransactions, type TransactionFilter } from './transactions';

const RM_FORMAT = '"RM" #,##0.00';

/** Sen to ringgit as a number, so Excel can add it up. */
const ringgit = (sen: number) => sen / 100;

/**
 * The transactions a person can see for a month and filter, as an .xlsx file: one sheet of
 * transactions with a total row, one of items. Every value from the household is written as a
 * plain string or number, never a formula, so text such as "=HYPERLINK(...)" stays text.
 * Dates and times are text on the Malaysia clock, so Excel never shifts them by time zone.
 */
export async function buildTransactionsWorkbook(viewer: Viewer, filter: TransactionFilter, locale: Locale): Promise<Buffer> {
  const t = messages[locale];
  const rows = await listTransactions(viewer, filter);
  const extras = await extrasFor(rows.map((row) => row.id));

  const book = new ExcelJS.Workbook();
  book.creator = 'My Expenses';

  const sheet = book.addWorksheet(t.export.sheetTransactions);
  sheet.columns = [
    { header: t.export.date, width: 12 },
    { header: t.export.time, width: 8 },
    { header: t.export.merchant, width: 30 },
    { header: t.export.total, width: 14, style: { numFmt: RM_FORMAT } },
    { header: t.export.budget, width: 20 },
    { header: t.export.paidWith, width: 14 },
    { header: t.export.addedBy, width: 18 },
    { header: t.export.receiptNumber, width: 16 },
    { header: t.export.note, width: 40 },
  ];
  for (const row of rows) {
    const extra = extras.get(row.id);
    sheet.addRow([
      dayKey(row.occurredAt),
      timeKey(row.occurredAt),
      row.merchant,
      ringgit(row.totalSen),
      row.budgetId === null ? t.common.uncategorised : row.budgetName,
      t.common.payment[row.paymentMethod],
      row.createdByName,
      extra?.receiptNumber ?? '',
      extra?.note ?? '',
    ]);
  }
  const total = sheet.addRow(['', '', t.export.totalRow, ringgit(rows.reduce((sum, row) => sum + row.totalSen, 0))]);
  total.font = { bold: true };
  sheet.getRow(1).font = { bold: true };

  const items = book.addWorksheet(t.export.sheetItems);
  items.columns = [
    { header: t.export.date, width: 12 },
    { header: t.export.merchant, width: 30 },
    { header: t.export.item, width: 30 },
    { header: t.export.quantity, width: 10 },
    { header: t.export.unitPrice, width: 16, style: { numFmt: RM_FORMAT } },
    { header: t.export.lineTotal, width: 16, style: { numFmt: RM_FORMAT } },
  ];
  items.getRow(1).font = { bold: true };
  for (const row of rows) {
    for (const item of extras.get(row.id)?.items ?? []) {
      items.addRow([dayKey(row.occurredAt), row.merchant, item.name, item.quantity, ringgit(item.unitPriceSen), ringgit(item.lineTotalSen)]);
    }
  }

  return Buffer.from(await book.xlsx.writeBuffer());
}
