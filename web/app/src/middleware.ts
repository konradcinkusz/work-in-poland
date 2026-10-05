import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_MARKER_COOKIE, clearSessionCookies } from '@/lib/cookies';
import { decodeExp, verifyAccessToken } from '@/lib/jwt';
import { loginUrl } from '@/lib/redirect';
import { isPublicPath } from '@/lib/routes';
import { buildCsp } from '@/lib/security-headers';

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function toLogin(req: NextRequest, clear: boolean): NextResponse {
  const intended = req.nextUrl.pathname + req.nextUrl.search;
  const res = NextResponse.redirect(new URL(loginUrl(intended), req.url));
  if (clear) clearSessionCookies(res);
  return res;
}

/**
 * Edge gate. VERIFIES the access token (signature, issuer, audience via authservice's JWKS) — a
 * decode-only check accepts any base64 payload with a future exp. Pages only: the API behind the
 * proxy enforces its own authorization. Also stamps the per-request CSP nonce.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const isProd = process.env.NODE_ENV === 'production';
  const n = nonce();
  const csp = buildCsp(n, isProd);

  const withCsp = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };
  const pass = () => {
    const headers = new Headers(req.headers);
    headers.set('x-nonce', n);
    headers.set('Content-Security-Policy', csp);
    return withCsp(NextResponse.next({ request: { headers } }));
  };

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return pass();

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) return toLogin(req, false);

  // The refresh route leaves a 10 s marker; if we still need a refresh right after one, the
  // new token does not verify (misconfiguration) and bouncing again would loop forever.
  const justRefreshed = req.cookies.has(REFRESH_MARKER_COOKIE);
  const refreshViaBff = () => {
    if (justRefreshed) return toLogin(req, true);
    const target = new URL('/api/auth/refresh', req.url);
    target.searchParams.set('redirect', pathname + req.nextUrl.search);
    return NextResponse.redirect(target);
  };

  if (!access) return refreshViaBff(); // only a refresh cookie left

  // Fast path: a token whose exp has passed needs a refresh, no crypto needed.
  const exp = decodeExp(access);
  if (exp === null) return toLogin(req, true);
  if (exp <= Math.floor(Date.now() / 1000)) return refresh ? refreshViaBff() : toLogin(req, true);

  const result = await verifyAccessToken(access);
  switch (result.status) {
    case 'valid':
      return pass();
    case 'expired':
      return refresh ? refreshViaBff() : toLogin(req, true);
    case 'unavailable':
      return new NextResponse('Usługa logowania jest chwilowo niedostępna. Odśwież stronę za chwilę.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '5' },
      });
    default:
      return toLogin(req, true);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
