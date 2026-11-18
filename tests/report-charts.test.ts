import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PairedBars } from '@/app/(app)/reports/report-charts';
import { messages } from '@/i18n/messages';

describe('PairedBars', () => {
  it("writes last month's amount for each budget as text, not only as a bar", () => {
    const html = renderToStaticMarkup(
      createElement(PairedBars, {
        rows: [{ id: 'b1', name: 'Groceries', archived: false, thisSen: 52500, lastSen: 48000 }],
        t: messages.ms.reports,
        nameOf: (row: { name: string }) => row.name,
        lastLabel: 'Oktober 2026',
      }),
    );
    expect(html).toContain('Oktober 2026: RM 480.00');
  });
});
