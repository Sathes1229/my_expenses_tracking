import { randomUUID } from 'node:crypto';
import { subscribe } from 'node:diagnostics_channel';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

// Shared through globalThis: instrumentation and the routes are bundled separately.
const HEADER_NAME = Symbol.for('my-expenses.socket-address-header');
const shared = globalThis as typeof globalThis & { [HEADER_NAME]?: string };

/**
 * Copies each request's socket address into a request header before Next sees the request, and
 * returns the header's name. The name is random per process, so no client can send that header.
 */
export function recordSocketAddresses(): string {
  if (shared[HEADER_NAME]) return shared[HEADER_NAME];
  const name = `x-socket-address-${randomUUID()}`;
  shared[HEADER_NAME] = name;
  subscribe('http.server.request.start', (message) => {
    const { request, socket } = message as { request: IncomingMessage; socket: Socket };
    if (socket.remoteAddress) request.headers[name] = socket.remoteAddress;
  });
  return name;
}

/** The address recorded for this request, or null when recording had not started. */
export function socketAddress(headers: Headers): string | null {
  const name = shared[HEADER_NAME];
  return name ? headers.get(name) : null;
}
