import { stateFromHeaders } from '@/lib/auth/viewer';
import { localeFromRequest } from '@/i18n/request';
import { readReceiptImage } from '@/lib/uploads';
import { say } from '@/lib/errors';

/**
 * A stored receipt photo, for whoever readReceiptImage allows. Anyone else gets 404, the same as
 * for an id that does not exist, so a guest cannot find out which receipts there are. So does
 * someone on a temporary password, whom the pages send to /change-password first.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/receipts/[id]'>): Promise<Response> {
  const state = await stateFromHeaders(request.headers);
  if (!state) return new Response(say(localeFromRequest(request, null), 'signInToSeeReceipt'), { status: 401 });
  const { id } = await ctx.params;
  const image = state.mustChangePassword ? null : await readReceiptImage(state.viewer, id);
  if (!image) return new Response('Not Found', { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(image.length),
      // Private household data: never kept by a shared cache, nor by the browser after the page.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
