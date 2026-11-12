import { env } from '@/lib/env';

// Checks shared by the route handlers that take a body (receipt upload, assistant chat).

export const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Browsers send Origin with every POST a page makes. One naming another site is refused, on top of
 * the SameSite session cookie. "This app" is the host the request was sent to (as Next's own server
 * action check reads it) or APP_URL.
 */
export function fromThisApp(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  if (!URL.canParse(origin)) return false; // includes "null", sent from sandboxed and opaque pages
  if (env.APP_URL && URL.canParse(env.APP_URL) && new URL(env.APP_URL).origin === origin) return true;
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host');
  return new URL(origin).host === host;
}

/**
 * The body as it arrives, failing as soon as it passes `limit` bytes. Content-Length is only what
 * the client claims, and route handlers have no body cap of their own: without this an endless body
 * would be buffered until the server ran out of memory. The failure also cancels the upload.
 */
export function countBytes(body: ReadableStream<Uint8Array>, limit: number) {
  let seen = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > limit) controller.error(new Error('The upload is larger than it said.'));
      else controller.enqueue(chunk);
    },
  });
  return { body: body.pipeThrough(counter), overLimit: () => seen > limit };
}

/** The declared Content-Length as a number, or null when it is missing or not a plain count. */
export function declaredLength(request: Request): number | null {
  const declared = request.headers.get('content-length');
  return declared !== null && /^\d+$/.test(declared) ? Number(declared) : null;
}
