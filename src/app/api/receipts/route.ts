import { extractReceipt } from '@/lib/ai/receipt';
import { viewerFromHeaders } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { MAX_RECEIPT_BYTES, readReceiptImage, RECEIPT_TOO_LARGE, saveReceiptImage } from '@/lib/uploads';

// Room for the multipart boundary and part headers around the photo.
const MAX_BODY_BYTES = MAX_RECEIPT_BYTES + 64 * 1024;
const NO_PHOTO = 'Choose a photo of the receipt.';

const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Browsers send Origin with every POST a page makes. One naming another site is refused, on top of
 * the SameSite session cookie. "This app" is the host the request was sent to (as Next's own server
 * action check reads it) or APP_URL.
 */
function fromThisApp(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  if (!URL.canParse(origin)) return false; // includes "null", sent from sandboxed and opaque pages
  if (env.APP_URL && URL.canParse(env.APP_URL) && new URL(env.APP_URL).origin === origin) return true;
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host');
  return new URL(origin).host === host;
}

/**
 * Takes one receipt photo (multipart field `image`), stores it shrunk and stripped, and reads it
 * with the receipt model. Nothing becomes a transaction here: the scan page shows the draft in the
 * form, and only its Save creates one (and links this upload).
 */
export async function POST(request: Request): Promise<Response> {
  if (!fromThisApp(request)) return refuse(403, 'This upload came from another site, so it was not accepted.');
  const viewer = await viewerFromHeaders(request.headers);
  if (!viewer) return refuse(401, 'You are signed out. Sign in again, then scan the receipt.');

  // Turned away before the body is read when the browser says up front that it is too big.
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return refuse(400, RECEIPT_TOO_LARGE);
  let image: FormDataEntryValue | null;
  try {
    image = (await request.formData()).get('image');
  } catch {
    return refuse(400, NO_PHOTO);
  }
  if (!(image instanceof File)) return refuse(400, NO_PHOTO);
  if (image.size > MAX_RECEIPT_BYTES) return refuse(400, RECEIPT_TOO_LARGE);

  let uploadId: string;
  try {
    ({ uploadId } = await saveReceiptImage(viewer, { bytes: Buffer.from(await image.arrayBuffer()), mime: image.type }));
  } catch (error) {
    if (error instanceof ValidationError) return refuse(400, error.message);
    throw error;
  }

  // The stored copy goes to the AI: smaller than the original, and without its EXIF.
  const stored = await readReceiptImage(viewer, uploadId);
  if (!stored) throw new Error('A receipt photo just saved could not be read back.');
  const result = await extractReceipt(stored, await listBudgetNames(viewer));
  return Response.json(result.ok ? { uploadId, draft: result.draft } : { uploadId, draft: null, reason: result.reason });
}
