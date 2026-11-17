import { describe, expect, it } from 'vitest';
import { fmt } from '@/i18n/format';
import { messages } from '@/i18n/messages';

/** Every leaf of a catalog as [path, text]. */
function leaves(node: unknown, path = ''): [string, unknown][] {
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  }
  return [[path, node]];
}

const placeholders = (text: string) => new Set(text.match(/\{\w+\}/g) ?? []);

describe('message catalogs', () => {
  const en = new Map(leaves(messages.en));
  const ms = new Map(leaves(messages.ms));

  it('hold a non-empty string at every leaf', () => {
    for (const [path, text] of [...en, ...ms]) {
      expect(typeof text, path).toBe('string');
      expect((text as string).trim().length, path).toBeGreaterThan(0);
    }
  });

  it('have the same keys in both languages', () => {
    expect([...ms.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const [path, text] of en) {
      expect(placeholders(ms.get(path) as string), path).toEqual(placeholders(text as string));
    }
  });

  it('use no em or en dashes', () => {
    for (const [path, text] of [...en, ...ms]) {
      expect(text as string, path).not.toMatch(/[–—]/);
    }
  });
});

describe('fmt', () => {
  it('fills placeholders', () => {
    expect(fmt('Hi {name}, {n} left', { name: 'Aminah', n: 3 })).toBe('Hi Aminah, 3 left');
  });

  it('leaves a placeholder in place when its value is missing', () => {
    expect(fmt('Hi {name}', {})).toBe('Hi {name}');
    expect(fmt('Hi {name}')).toBe('Hi {name}');
  });
});
