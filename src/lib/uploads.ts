import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '@/db/client';
import { receiptUploads } from '@/db/schema';
import type { Viewer } from '@/lib/auth/viewer';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { getTransaction } from '@/lib/transactions';

/** The largest photo taken in, before it is shrunk. Phone photos are usually 2 to 8 MB. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

// Long enough edge to read small print on a long receipt, small enough to keep and to send to the AI.
const LONGEST_EDGE = 1600;
// A small file can unpack into a huge image. 100 million pixels is above any phone camera in normal use.
const MAX_PIXELS = 100_000_000;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The file on disk is named by the upload's random id, never by anything the browser sent.
const relativePath = (uploadId: string) => `receipts/${uploadId}.jpg`;

/** Format from the bytes themselves. The browser's type is only used to explain a HEIC photo sharp cannot open. */
async function checkImage(bytes: Buffer, mime: string): Promise<void> {
  if (bytes.length === 0) throw new ValidationError('image', 'choosePhoto');
  if (bytes.length > MAX_RECEIPT_BYTES) throw new ValidationError('image', 'photoTooLarge');
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta && ACCEPTED.has(meta.format)) {
    if (meta.width * meta.height > MAX_PIXELS) {
      throw new ValidationError('image', 'photoTooManyPixels');
    }
    return;
  }
  if (meta?.format === 'heif' || /^image\/hei[cf]/i.test(mime)) throw new ValidationError('image', 'photoHeic');
  throw new ValidationError('image', 'photoFormat');
}

/**
 * Keeps a receipt photo as a JPEG at most 1600px on its longest edge, turned the way the camera
 * held it. sharp writes no metadata unless asked, so EXIF (location, phone model) is dropped.
 */
export async function saveReceiptImage(viewer: Viewer, file: { bytes: Buffer; mime: string }): Promise<{ uploadId: string }> {
  await checkImage(file.bytes, file.mime);
  let jpeg: Buffer;
  try {
    jpeg = await sharp(file.bytes, { autoOrient: true, limitInputPixels: MAX_PIXELS })
      .resize({ width: LONGEST_EDGE, height: LONGEST_EDGE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ValidationError('image', 'photoUnreadable');
  }

  const uploadId = crypto.randomUUID();
  const path = relativePath(uploadId);
  const onDisk = join(env.UPLOADS_DIR, path);
  await mkdir(join(env.UPLOADS_DIR, 'receipts'), { recursive: true });
  await writeFile(onDisk, jpeg, { flag: 'wx' });
  try {
    db.insert(receiptUploads).values({ id: uploadId, path, uploadedBy: viewer.id }).run();
  } catch (error) {
    await unlink(onDisk).catch(() => {});
    throw error;
  }
  return { uploadId };
}

/**
 * The stored JPEG, or null. Before it is saved with a transaction only the person who uploaded it
 * may see it; after, whoever may see that transaction. Missing and not allowed look the same.
 */
export async function readReceiptImage(viewer: Viewer, uploadId: string): Promise<Buffer | null> {
  if (!UUID.test(uploadId)) return null;
  const row = db
    .select({ path: receiptUploads.path, uploadedBy: receiptUploads.uploadedBy, transactionId: receiptUploads.transactionId })
    .from(receiptUploads)
    .where(eq(receiptUploads.id, uploadId))
    .get();
  if (!row) return null;
  const allowed =
    row.transactionId === null ? row.uploadedBy === viewer.id : (await getTransaction(viewer, row.transactionId)) !== null;
  if (!allowed) return null;
  try {
    return await readFile(join(env.UPLOADS_DIR, row.path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
