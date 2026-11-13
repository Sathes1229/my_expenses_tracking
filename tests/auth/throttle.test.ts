import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginLoginAttempt,
  checkLoginAllowed,
  clientIp,
  markLoginSucceeded,
  recordLoginAttempt,
} from '@/lib/auth/throttle';
import { recordSocketAddresses } from '@/lib/socket-address';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);
afterEach(() => {
  vi.useRealTimers();
});

const allowed = async (username: string, ip: string) => (await checkLoginAllowed(username, ip)).allowed;

describe('login throttle', () => {
  it('locks a username after 5 failures, from any address', async () => {
    for (let i = 0; i < 5; i++) await recordLoginAttempt('siti', '1.1.1.1', false);
    expect((await checkLoginAllowed('siti', '2.2.2.2')).allowed).toBe(false);
    expect((await checkLoginAllowed('ali', '2.2.2.2')).allowed).toBe(true);
  });

  it('allows 4 failures and matches the username in any case', async () => {
    for (let i = 0; i < 4; i++) await recordLoginAttempt('Siti', '1.1.1.1', false);
    expect(await allowed('siti', '1.1.1.1')).toBe(true);
    await recordLoginAttempt('SITI', '9.9.9.9', false);
    expect(await allowed('siti', '1.1.1.1')).toBe(false);
  });

  it('locks an address after 20 failures across usernames', async () => {
    for (let i = 0; i < 19; i++) await recordLoginAttempt(`user${i}`, '3.3.3.3', false);
    expect(await allowed('someone', '3.3.3.3')).toBe(true);
    await recordLoginAttempt('user19', '3.3.3.3', false);
    expect(await allowed('someone', '3.3.3.3')).toBe(false);
    expect(await allowed('someone', '4.4.4.4')).toBe(true);
  });

  it('does not clear a lock early when a sign-in succeeds', async () => {
    for (let i = 0; i < 5; i++) await recordLoginAttempt('siti', '1.1.1.1', false);
    await recordLoginAttempt('siti', '1.1.1.1', true);
    expect(await allowed('siti', '1.1.1.1')).toBe(false);
  });

  it('ignores attempts older than 15 minutes and reports the wait', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    for (let i = 0; i < 5; i++) await recordLoginAttempt('siti', '1.1.1.1', false);

    vi.setSystemTime(new Date('2026-11-12T10:05:00Z'));
    expect(await checkLoginAllowed('siti', '1.1.1.1')).toEqual({ allowed: false, retryAfterSec: 600 });

    vi.setSystemTime(new Date('2026-11-12T10:15:00Z'));
    expect(await checkLoginAllowed('siti', '1.1.1.1')).toEqual({ allowed: true });
  });

  it('waits for the oldest failure that still counts toward the limit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    for (let i = 0; i < 3; i++) await recordLoginAttempt('siti', '1.1.1.1', false);
    vi.setSystemTime(new Date('2026-11-12T10:10:00Z'));
    for (let i = 0; i < 3; i++) await recordLoginAttempt('siti', '1.1.1.1', false);

    // Six failures: the lock lifts when the second one (10:00) leaves the window at 10:15.
    expect(await checkLoginAllowed('siti', '1.1.1.1')).toEqual({ allowed: false, retryAfterSec: 300 });
  });
});

describe('beginLoginAttempt', () => {
  it('reserves a failure in the same step as the check', async () => {
    for (let i = 0; i < 5; i++) expect((await beginLoginAttempt('siti', '1.1.1.1')).allowed).toBe(true);
    expect(await beginLoginAttempt('siti', '1.1.1.1')).toMatchObject({ allowed: false });
    expect(await allowed('siti', '1.1.1.1')).toBe(false);
  });

  it('stops counting an attempt once it is marked as a success', async () => {
    const first = await beginLoginAttempt('siti', '1.1.1.1');
    if (!first.allowed) throw new Error('expected the first attempt to be allowed');
    await markLoginSucceeded(first.attemptIds);
    for (let i = 0; i < 5; i++) expect((await beginLoginAttempt('siti', '1.1.1.1')).allowed).toBe(true);
    expect((await beginLoginAttempt('siti', '1.1.1.1')).allowed).toBe(false);
  });

  it('refuses without reserving anything while locked', async () => {
    for (let i = 0; i < 5; i++) await recordLoginAttempt('siti', '1.1.1.1', false);
    expect(await beginLoginAttempt('siti', '2.2.2.2')).toMatchObject({ allowed: false });
    // The address saw no failure of its own, so another username from it is still fine.
    expect(await allowed('ali', '2.2.2.2')).toBe(true);
  });
});

describe('clientIp', () => {
  const socketHeader = recordSocketAddresses();

  it('with TRUST_PROXY off, uses the socket address and ignores a forged x-forwarded-for', () => {
    const headers = new Headers({ [socketHeader]: '192.168.1.20', 'x-forwarded-for': '203.0.113.9' });
    expect(clientIp(headers, false)).toBe('192.168.1.20');
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' }), false)).toBe(
      'unknown',
    );
  });

  it('with TRUST_PROXY on, takes the address the proxy added: the last x-forwarded-for entry', () => {
    // The client sent 198.51.100.4 itself; the proxy appended the address it saw.
    const forged = new Headers({ [socketHeader]: '10.0.0.2', 'x-forwarded-for': '198.51.100.4, 203.0.113.7' });
    expect(clientIp(forged, true)).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7' }), true)).toBe('203.0.113.7');
    expect(clientIp(new Headers(), true)).toBe('unknown');
  });

  it('follows the TRUST_PROXY setting, off unless set', () => {
    const headers = new Headers({ [socketHeader]: '192.168.1.20', 'x-forwarded-for': '203.0.113.9' });
    expect(clientIp(headers)).toBe('192.168.1.20');
  });
});
