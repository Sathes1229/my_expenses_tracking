import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Screens still to be moved into the message catalogs. Each translation task removes its files;
 * at the end this list is empty and every screen reads its copy from src/i18n.
 */
const PENDING: string[] = [
  'src/app/(app)/assistant/chat.tsx',
  'src/app/(app)/assistant/error.tsx',
  'src/app/(app)/assistant/page.tsx',
  'src/app/(app)/budgets/budget-forms.tsx',
  'src/app/(app)/budgets/budget-list.tsx',
  'src/app/(app)/budgets/error.tsx',
  'src/app/(app)/budgets/page.tsx',
  'src/app/(app)/debts/debt-forms.tsx',
  'src/app/(app)/debts/debt-list.tsx',
  'src/app/(app)/debts/error.tsx',
  'src/app/(app)/debts/not-found.tsx',
  'src/app/(app)/debts/page.tsx',
  'src/app/(app)/error.tsx',
  'src/app/(app)/layout.tsx',
  'src/app/(app)/main-nav.tsx',
  'src/app/(app)/notifications/error.tsx',
  'src/app/(app)/notifications/not-found.tsx',
  'src/app/(app)/notifications/notification-list.tsx',
  'src/app/(app)/notifications/page.tsx',
  'src/app/(app)/page.tsx',
  'src/app/(app)/settings/ai/ai-forms.tsx',
  'src/app/(app)/settings/ai/page.tsx',
  'src/app/(app)/settings/error.tsx',
  'src/app/(app)/settings/invite-section.tsx',
  'src/app/(app)/settings/page.tsx',
  'src/app/(app)/settings/people-list.tsx',
  'src/app/(app)/settings/profile/profile-forms.tsx',
  'src/app/(app)/transactions/[id]/not-found.tsx',
  'src/app/(app)/transactions/[id]/page.tsx',
  'src/app/(app)/transactions/delete-transaction.tsx',
  'src/app/(app)/transactions/error.tsx',
  'src/app/(app)/transactions/new/page.tsx',
  'src/app/(app)/transactions/page.tsx',
  'src/app/(app)/transactions/scan/page.tsx',
  'src/app/(app)/transactions/scan/receipt-scanner.tsx',
  'src/app/(app)/transactions/transaction-list.tsx',
  'src/components/copy-field.tsx',
  'src/components/dialog.tsx',
  'src/components/receipt-photo.tsx',
  'src/components/theme-toggle.tsx',
  'src/components/transaction-form.tsx',
];

/** Text that is the same in both languages. */
const ALLOWED = new Set(['My Expenses', 'RM', 'QR', 'Developed by Sathes']);

const ROOT = join(__dirname, '..', '..');
const SCAN = ['src/app', 'src/components'];
const SKIP = ['src/app/styleguide'];

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP.includes(path) ? [] : tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/** Comments out, line breaks kept so line numbers still match. */
function withoutComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`])\/\/.*$/gm, (match, before: string) => before + blank(match.slice(before.length)));
}

const hasWords = (text: string) => /[A-Za-z]{2,}/.test(text) && !ALLOWED.has(text.trim());

/** JSX text between tags, copy-carrying attributes, and label/title/message properties. */
const PATTERNS: RegExp[] = [
  />([^<>{}]*[A-Za-z][^<>{}]*)</g,
  /\b(?:aria-label|title|placeholder|alt|label|hint|description)="([^"]*)"/g,
  /\b(?:label|title|message|text):\s*'([^']*)'/g,
];

function hits(file: string): string[] {
  const source = withoutComments(readFileSync(join(ROOT, file), 'utf8'));
  const found: string[] = [];
  for (const pattern of PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1];
      // JSX text holds no code characters; anything with them is an expression, not copy.
      if (!hasWords(text) || /[=;()&|[\]]/.test(text)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      found.push(`${file}:${line} ${text.trim().slice(0, 60)}`);
    }
  }
  return found;
}

describe('screen copy', () => {
  it('lists only files that exist', () => {
    for (const file of PENDING) expect(existsSync(join(ROOT, file)), file).toBe(true);
  });

  it('comes from the message catalogs, not from the screens', () => {
    const files = SCAN.flatMap(tsxFiles).map((f) => relative(ROOT, join(ROOT, f)).replace(/\\/g, '/'));
    const found = files.filter((f) => !PENDING.includes(f)).flatMap(hits);
    expect(found).toEqual([]);
  });
});
