import { answerChat, checkMessage, type ChatRefusal } from '@/lib/ai/chat';
import { viewerFromHeaders } from '@/lib/auth/viewer';
import { countBytes, declaredLength, fromThisApp, refuse } from '@/lib/request-guards';

// A 2000-character question in JSON is at most about 12 KB, even written as \u escapes.
const MAX_BODY_BYTES = 16 * 1024;

const STATUS: Record<ChatRefusal, number> = { not_configured: 409, budget_used: 429, provider_error: 502 };

/**
 * One question to the assistant, as JSON `{ message }`. The answer comes back as plain text, streamed
 * as it is written. Errors are JSON `{ error }` with a code the assistant page turns into words.
 */
export async function POST(request: Request): Promise<Response> {
  if (!fromThisApp(request)) return refuse(403, 'other_site');
  const viewer = await viewerFromHeaders(request.headers);
  if (!viewer) return refuse(401, 'signed_out');

  const declared = declaredLength(request);
  if (declared === null) return refuse(411, 'length_required');
  if (declared > MAX_BODY_BYTES) return refuse(413, 'too_large');
  if (!request.body) return refuse(400, 'invalid_message');

  const counted = countBytes(request.body, declared);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new Response(counted.body).text());
  } catch {
    return counted.overLimit() ? refuse(413, 'too_large') : refuse(400, 'invalid_message');
  }
  const message = checkMessage(typeof parsed === 'object' && parsed !== null ? (parsed as { message?: unknown }).message : null);
  if (message === null) return refuse(400, 'invalid_message');

  const answer = await answerChat(viewer, message, request.signal);
  if (!answer.ok) return refuse(STATUS[answer.reason], answer.reason);
  return new Response(answer.body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
