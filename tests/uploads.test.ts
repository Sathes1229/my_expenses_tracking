import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction, deleteTransaction, type TransactionInput } from '@/lib/transactions';
import { readReceiptImage, saveReceiptImage } from '@/lib/uploads';
import { POST } from '@/app/api/receipts/route';
import { GET } from '@/app/api/receipts/[id]/route';
import { resetDb } from './helpers/db';
import { sessionHeaders } from './helpers/session';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;
let input: TransactionInput;

// A 4000 x 3000 photo taken with the phone turned sideways (EXIF orientation 6), with camera EXIF.
let bigJpeg4000px: Buffer;
// A real HEIF container that sharp reads as HEIC (hevc), as an iPhone sends by default.
let heicFixture: Buffer;
let pngWithAlpha: Buffer;
let gif: Buffer;

beforeAll(async () => {
  bigJpeg4000px = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#e8e4dc' } })
    .withExif({ IFD0: { Make: 'TestPhone', Copyright: 'someone' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const avif = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } })
    .heif({ compression: 'av1' })
    .toBuffer();
  heicFixture = Buffer.from(avif.toString('latin1').replaceAll('avif', 'heic'), 'latin1');
  pngWithAlpha = await sharp({ create: { width: 300, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toBuffer();
  gif = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#fff' } }).gif().toBuffer();
});

async function person(username: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName: username, password: 'password1', role });
  return { id: a.id, role, displayName: username };
}

beforeEach(async () => {
  await resetDb();
  owner = await person('owner', 'owner');
  member = await person('siti', 'member');
  guest = await person('ali', 'guest');
  input = {
    merchant: 'KK Mart',
    occurredAt: fromLocalDateTime('2026-11-03', '12:00'),
    totalSen: 1250,
    paymentMethod: 'qr',
    budgetId: null,
    items: [],
  };
});

describe('saveReceiptImage', () => {
  it('turns away HEIC with a way out, more than 15 MB, and anything that is not JPEG, PNG or WebP', async () => {
    await expect(saveReceiptImage(owner, { bytes: heicFixture, mime: 'image/heic' })).rejects.toThrow(ValidationError);
    await expect(saveReceiptImage(owner, { bytes: heicFixture, mime: 'image/jpeg' })).rejects.toThrow(/Most compatible/i);
    await expect(saveReceiptImage(owner, { bytes: Buffer.alloc(16 * 1024 * 1024), mime: 'image/jpeg' })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveReceiptImage(owner, { bytes: gif, mime: 'image/jpeg' })).rejects.toThrow(ValidationError);
    await expect(saveReceiptImage(owner, { bytes: Buffer.from('not a photo'), mime: 'image/png' })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveReceiptImage(owner, { bytes: Buffer.alloc(0), mime: 'image/png' })).rejects.toThrow(ValidationError);
  });

  it('shrinks to 1600px on the longest edge, turns it upright and strips EXIF', async () => {
    const { uploadId } = await saveReceiptImage(owner, { bytes: bigJpeg4000px, mime: 'image/jpeg' });
    const meta = await sharp((await readReceiptImage(owner, uploadId))!).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(meta.height).toBeGreaterThan(meta.width); // orientation 6 was applied, not kept as a tag
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('stores a JPEG named by its id in the uploads folder, and accepts PNG with transparency', async () => {
    expect(resolve(env.UPLOADS_DIR)).not.toBe(resolve('./data/uploads'));
    const { uploadId } = await saveReceiptImage(member, { bytes: pngWithAlpha, mime: 'image/png' });
    expect(uploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(existsSync(join(env.UPLOADS_DIR, 'receipts', `${uploadId}.jpg`))).toBe(true);
    const meta = await sharp((await readReceiptImage(member, uploadId))!).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([300, 500]); // never enlarged
  });
});

describe('readReceiptImage', () => {
  it('lets only the uploader see a pending upload', async () => {
    const { uploadId } = await saveReceiptImage(owner, { bytes: bigJpeg4000px, mime: 'image/jpeg' });
    expect(await readReceiptImage(owner, uploadId)).not.toBeNull();
    expect(await readReceiptImage(guest, uploadId)).toBeNull(); // someone else's pending upload
    expect(await readReceiptImage(member, uploadId)).toBeNull();
  });

  it('once linked, follows who may see the transaction', async () => {
    const { uploadId } = await saveReceiptImage(owner, { bytes: bigJpeg4000px, mime: 'image/jpeg' });
    const { id } = await createTransaction(owner, { ...input, receiptUploadId: uploadId });
    expect(await readReceiptImage(member, uploadId)).not.toBeNull();
    expect(await readReceiptImage(guest, uploadId)).toBeNull();

    // Deleting the transaction unlinks the upload: back to the uploader only.
    await deleteTransaction(owner, id);
    expect(await readReceiptImage(member, uploadId)).toBeNull();
    expect(await readReceiptImage(owner, uploadId)).not.toBeNull();
  });

  it("lets a guest see their own saved receipt, and the owner see it too", async () => {
    const { uploadId } = await saveReceiptImage(guest, { bytes: pngWithAlpha, mime: 'image/png' });
    await createTransaction(guest, { ...input, receiptUploadId: uploadId });
    expect(await readReceiptImage(guest, uploadId)).not.toBeNull();
    expect(await readReceiptImage(owner, uploadId)).not.toBeNull();
  });

  it('returns null for an unknown id or a path', async () => {
    expect(await readReceiptImage(owner, crypto.randomUUID())).toBeNull();
    expect(await readReceiptImage(owner, '../../.env')).toBeNull();
    expect(await readReceiptImage(owner, '..\\app.db')).toBeNull();
  });
});

const APP = 'http://localhost:3100';

function headersFor(session: Headers, origin: string | null, host: string): Headers {
  const h = new Headers(session);
  h.set('host', host);
  if (origin) h.set('origin', origin);
  return h;
}

/** A multipart upload as a browser sends it: the body serialised, with its Content-Length. */
async function upload(
  session: Headers,
  bytes: Buffer,
  type: string,
  origin: string | null = APP,
  host = 'localhost:3100',
): Promise<Request> {
  const form = new FormData();
  form.append('image', new File([new Uint8Array(bytes)], 'receipt', { type }));
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const h = headersFor(session, origin, host);
  h.set('content-type', encoded.headers.get('content-type')!);
  h.set('content-length', String(body.byteLength));
  return new Request(`http://${host}/api/receipts`, { method: 'POST', headers: h, body });
}

/** A body that never ends, counting what was read from it. */
function endless() {
  const seen = { bytes: 0, cancelled: false };
  const chunk = new Uint8Array(64 * 1024);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      seen.bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      seen.cancelled = true;
    },
    // No read-ahead: a chunk is only made when someone reads, so `seen` counts what was read.
  }, { highWaterMark: 0 });
  return { stream, seen };
}

function streamed(session: Headers, body: ReadableStream<Uint8Array>, contentLength?: number): Request {
  const h = headersFor(session, APP, 'localhost:3100');
  h.set('content-type', 'multipart/form-data; boundary=x');
  if (contentLength !== undefined) h.set('content-length', String(contentLength));
  return new Request(`${APP}/api/receipts`, { method: 'POST', headers: h, body, duplex: 'half' } as RequestInit);
}

function image(headers: Headers, id: string) {
  return GET(new Request(`${APP}/api/receipts/${id}`, { headers }), { params: Promise.resolve({ id }) });
}

describe('POST /api/receipts', () => {
  it('refuses another site (403) and a signed-out request (401)', async () => {
    const ownerHeaders = await sessionHeaders('owner', 'password1');
    expect((await POST(await upload(ownerHeaders, pngWithAlpha, 'image/png', 'http://evil.example'))).status).toBe(403);
    expect((await POST(await upload(ownerHeaders, pngWithAlpha, 'image/png', 'null'))).status).toBe(403);
    expect((await POST(await upload(new Headers(), pngWithAlpha, 'image/png'))).status).toBe(401);
  });

  it('accepts the address the page was opened on, and a request with no Origin', async () => {
    const lan = 'http://192.168.10.86:3100';
    const ownerHeaders = await sessionHeaders('owner', 'password1');
    expect((await POST(await upload(ownerHeaders, pngWithAlpha, 'image/png', lan, '192.168.10.86:3100'))).status).toBe(200);
    expect((await POST(await upload(ownerHeaders, pngWithAlpha, 'image/png', lan, 'localhost:3100'))).status).toBe(403);
    expect((await POST(await upload(ownerHeaders, pngWithAlpha, 'image/png', null))).status).toBe(200);
  });

  it('answers 400 with a plain message for a bad file, and 413 for one over 15 MB', async () => {
    const headers = await sessionHeaders('owner', 'password1');
    const heic = await POST(await upload(headers, heicFixture, 'image/heic'));
    expect(heic.status).toBe(400);
    expect((await heic.json()).error).toMatch(/Most compatible/i);

    const big = await POST(await upload(headers, Buffer.alloc(16 * 1024 * 1024), 'image/jpeg'));
    expect(big.status).toBe(413);
    expect((await big.json()).error).toMatch(/15 MB/);
  });

  it('refuses a body with no size (411), and one declared over the limit before reading it (413)', async () => {
    const headers = await sessionHeaders('owner', 'password1');
    const unsized = endless();
    const noLength = await POST(streamed(headers, unsized.stream));
    expect(noLength.status).toBe(411);
    expect(unsized.seen.bytes).toBe(0);

    const huge = endless();
    const declaredHuge = await POST(streamed(headers, huge.stream, 20 * 1024 * 1024));
    expect(declaredHuge.status).toBe(413);
    expect((await declaredHuge.json()).error).toMatch(/15 MB/);
    expect(huge.seen.bytes).toBe(0);

    const nonsense = endless();
    expect((await POST(streamed(headers, nonsense.stream, Number.NaN))).status).toBe(411);
  });

  it('stops reading a body that runs past the size it declared (413), without buffering it all', async () => {
    const lying = endless();
    const res = await POST(streamed(await sessionHeaders('owner', 'password1'), lying.stream, 1000));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/15 MB/);
    expect(lying.seen.bytes).toBeLessThan(1024 * 1024); // an endless body: only a few chunks were read
    expect(lying.seen.cancelled).toBe(true);
  });

  it('stores the photo and returns no draft while no receipt model is set', async () => {
    const res = await POST(await upload(await sessionHeaders('siti', 'password1'), pngWithAlpha, 'image/png'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ uploadId: expect.any(String), draft: null, reason: 'not_configured' });
    expect(await readReceiptImage(member, body.uploadId)).not.toBeNull();
  });
});

describe('GET /api/receipts/[id]', () => {
  it('sends the JPEG privately to someone allowed, 404 to anyone else, 401 when signed out', async () => {
    const { uploadId } = await saveReceiptImage(owner, { bytes: pngWithAlpha, mime: 'image/png' });
    await createTransaction(owner, { ...input, receiptUploadId: uploadId });

    const ok = await image(await sessionHeaders('siti', 'password1'), uploadId);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/jpeg');
    expect(ok.headers.get('cache-control')).toBe('private, no-store');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await sharp(Buffer.from(await ok.arrayBuffer())).metadata()).format).toBe('jpeg');

    expect((await image(await sessionHeaders('ali', 'password1'), uploadId)).status).toBe(404);
    expect((await image(await sessionHeaders('ali', 'password1'), crypto.randomUUID())).status).toBe(404);
    expect((await image(new Headers(), uploadId)).status).toBe(401);
  });
});
