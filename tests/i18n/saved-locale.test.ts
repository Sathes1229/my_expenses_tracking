import { describe, expect, it } from 'vitest';
import { savedLocaleOf } from '@/i18n/saved-locale';

describe('savedLocaleOf', () => {
  it("gives the person's saved language", async () => {
    expect(await savedLocaleOf(async () => ({ locale: 'ms' }))).toBe('ms');
    expect(await savedLocaleOf(async () => ({ locale: null }))).toBeNull();
    expect(await savedLocaleOf(async () => null)).toBeNull();
  });

  it('falls back to no saved language when the session read fails, so the page can still choose one', async () => {
    expect(await savedLocaleOf(async () => Promise.reject(new Error('database locked')))).toBeNull();
  });
});
