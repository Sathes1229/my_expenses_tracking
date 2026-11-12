import { getAuth } from '@/lib/auth/auth';

// Pages sign in, sign up and change passwords through server actions that call auth.api with
// the app's rules (throttle, createAccount). Over HTTP those endpoints would skip the rules,
// so only these two are passed to Better Auth; everything else is a 404.
const OPEN = new Set(['GET /api/auth/get-session', 'POST /api/auth/sign-out']);

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!OPEN.has(`${request.method} ${pathname}`)) {
    return new Response('Not Found', { status: 404 });
  }
  return getAuth().handler(request);
}

export const GET = handle;
export const POST = handle;
