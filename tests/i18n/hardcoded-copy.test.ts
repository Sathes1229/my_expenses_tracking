import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Screens still to be moved into the message catalogs. The translation tasks emptied it: every
 * screen reads its copy from src/i18n, and a file added here again fails the check below.
 */
const PENDING: string[] = [];

/** Text that is the same in both languages. */
const ALLOWED = new Set(['My Expenses', 'RM', 'QR', 'Developed by Sathes', '.env']);

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
  // Not after "=": the arrow in a type such as `(prev: FormState) => Promise<FormState>` is not a tag.
  /(?<!=)>([^<>{}]*[A-Za-z][^<>{}]*)</g,
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

  it('has no screens left to move', () => {
    expect(PENDING).toEqual([]);
  });

  it('comes from the message catalogs, not from the screens', () => {
    const files = SCAN.flatMap(tsxFiles).map((f) => relative(ROOT, join(ROOT, f)).replace(/\\/g, '/'));
    const found = files.filter((f) => !PENDING.includes(f)).flatMap(hits);
    expect(found).toEqual([]);
  });
});
