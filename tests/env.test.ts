import { describe, expect, it } from 'vitest';
import { authEnv, loadEnv } from '@/lib/env';

const from = (vars: Record<string, string>) => loadEnv(vars as NodeJS.ProcessEnv);
const secret = 'a-long-random-secret-for-this-test-0123456789';

describe('TRUST_PROXY', () => {
  it('is off unless set to 1', () => {
    expect(from({}).TRUST_PROXY).toBe(false);
    expect(from({ TRUST_PROXY: '' }).TRUST_PROXY).toBe(false);
    expect(from({ TRUST_PROXY: '0' }).TRUST_PROXY).toBe(false);
    expect(from({ TRUST_PROXY: '1' }).TRUST_PROXY).toBe(true);
  });

  it('refuses any other value rather than guessing', () => {
    expect(() => from({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });
});

describe('authEnv', () => {
  it('returns the secret and address when both are set', () => {
    expect(authEnv(from({ BETTER_AUTH_SECRET: secret, APP_URL: 'http://192.168.1.10:3100' }))).toEqual({
      secret,
      appUrl: 'http://192.168.1.10:3100',
    });
  });

  it('names the missing or bad setting without printing the secret', () => {
    expect(() => authEnv(from({ APP_URL: 'http://localhost:3100' }))).toThrow(/BETTER_AUTH_SECRET is not set/);
    expect(() => authEnv(from({ BETTER_AUTH_SECRET: '', APP_URL: 'http://localhost:3100' }))).toThrow(
      /BETTER_AUTH_SECRET is not set/,
    );
    expect(() => authEnv(from({ BETTER_AUTH_SECRET: 'short-secret-value' }))).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('short-secret-value') }),
    );
    expect(() => authEnv(from({ BETTER_AUTH_SECRET: secret }))).toThrow(/APP_URL is not set/);
    expect(() => authEnv(from({ BETTER_AUTH_SECRET: secret, APP_URL: 'localhost' }))).toThrow(/APP_URL is not a valid/);
  });
});
