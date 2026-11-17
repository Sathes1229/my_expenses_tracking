import { extractReceipt } from '@/lib/ai/receipt';
import { localeFromRequest } from '@/i18n/request';
import { stateFromHeaders } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { errorText, say, ValidationError } from '@/lib/errors';
import { countBytes, declaredLength, fromThisApp, refuse } from '@/lib/request-guards';
import { MAX_RECEIPT_BYTES, readReceiptImage, saveReceiptImage } from '@/lib/uploads';

// Room for the multipart boundary and part headers around the photo.
const MAX_BODY_BYTES = MAX_RECEIPT_BYTES + 64 * 1024;

/**
 * Takes one receipt photo (multipart field `image`), stores it shrunk and stripped, and reads it
 * with the receipt model. Nothing becomes a transaction here: the scan page shows the draft in the
 * form, and only its Save creates one (and links this upload).
 */
export async function POST(request: Request): Promise<Response> {
  const browser = localeFromRequest(request, null);
  if (!fromThisApp(request)) return refuse(403, say(browser, 'uploadOtherSite'));
  const state = await stateFromHeaders(request.headers);
  if (!state) return refuse(401, say(browser, 'signedOutScan'));
  const locale = localeFromRequest(request, state.locale);
  if (state.mustChangePassword) return refuse(403, say(locale, 'newPasswordFirstScan'));
  const { viewer } = state;

  const declared = declaredLength(request);
  // Turned away before the body is read when the request says up front that it is too big. A body
  // sent in chunks, with no length (some proxies resend uploads that way), is counted as it arrives.
  if (declared !== null && declared > MAX_BODY_BYTES) return refuse(413, say(locale, 'photoTooLarge'));
  if (!request.body) return refuse(400, say(locale, 'choosePhoto'));

  const counted = countBytes(request.body, declared ?? MAX_BODY_BYTES);
  let image: FormDataEntryValue | null;
  try {
    const multipart = new Response(counted.body, { headers: { 'content-type': request.headers.get('content-type') ?? '' } });
    image = (await multipart.formData()).get('image');
  } catch {
    return counted.overLimit() ? refuse(413, say(locale, 'photoTooLarge')) : refuse(400, say(locale, 'choosePhoto'));
  }
  if (!(image instanceof File)) return refuse(400, say(locale, 'choosePhoto'));
  if (image.size > MAX_RECEIPT_BYTES) return refuse(413, say(locale, 'photoTooLarge'));

  let uploadId: string;
  try {
    ({ uploadId } = await saveReceiptImage(viewer, { bytes: Buffer.from(await image.arrayBuffer()), mime: image.type }));
  } catch (error) {
    if (error instanceof ValidationError) return refuse(400, errorText(error, locale));
    throw error;
  }

  // The stored copy goes to the AI: smaller than the original, and without its EXIF.
  const stored = await readReceiptImage(viewer, uploadId);
  if (!stored) throw new Error(say('en', 'receiptReadBack'));
  const result = await extractReceipt(stored, await listBudgetNames(viewer));
  return Response.json(result.ok ? { uploadId, draft: result.draft } : { uploadId, draft: null, reason: result.reason });
}
