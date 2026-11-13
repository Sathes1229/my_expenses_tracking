import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/auth/throttle';
import { recordSocketAddresses, socketAddress } from '@/lib/socket-address';

// Request headers as Next hands them to server actions through headers().
function webHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

let server: Server | undefined;
afterAll(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

/** Sends one request with the given headers to a plain Node server and returns what it received. */
async function receivedHeaders(sent: Record<string, string>): Promise<Headers> {
  let received: Headers | undefined;
  server = createServer((request, response) => {
    received = webHeaders(request);
    response.end();
  });
  await new Promise<void>((ready) => server!.listen(0, '127.0.0.1', ready));
  const { port } = server.address() as AddressInfo;
  await fetch(`http://127.0.0.1:${port}/`, { headers: sent });
  await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
  return received!;
}

describe('socket addresses', () => {
  it('knows no address before recording starts', () => {
    expect(socketAddress(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBeNull();
  });

  it('records the socket address in a header the client cannot set', async () => {
    const name = recordSocketAddresses();
    expect(recordSocketAddresses()).toBe(name);

    const received = await receivedHeaders({ 'x-forwarded-for': '203.0.113.9', [name]: '198.51.100.4' });
    expect(socketAddress(received)).toBe('127.0.0.1');
    expect(clientIp(received, false)).toBe('127.0.0.1');
    // With TRUST_PROXY on, the sender stands where the proxy would.
    expect(clientIp(received, true)).toBe('203.0.113.9');
  });
});
