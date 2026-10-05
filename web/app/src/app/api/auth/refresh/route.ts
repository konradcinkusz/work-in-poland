import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE, clearSessionCookies, setRefreshMarker, setSessionCookies } from '@/lib/cookies';
import { json } from '@/lib/bff';
import { loginUrl, safeRedirect } from '@/lib/redirect';
import { refreshTokens } from '@/lib/session';

/**
 * Refreshes the session with the single-use refresh token (serialised in-process; see session.ts).
 * GET ?redirect= is the edge gate's way to renew an expired session mid-navigation: it stores the
 * new pair and redirects back. POST is for client code. A failed refresh means signed out.
 */
export async function GET(req: NextRequest) {
  const target = safeRedirect(req.nextUrl.searchParams.get('redirect'), '/');
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!rt) return NextResponse.redirect(new URL(loginUrl(target), req.url));

  const outcome = await refreshTokens(rt);
  if (outcome.kind === 'ok') {
    const out = NextResponse.redirect(new URL(target, req.url));
    setSessionCookies(out, outcome.tokens);
    setRefreshMarker(out);
    return out;
  }
  if (outcome.kind === 'invalid') {
    const out = NextResponse.redirect(new URL(loginUrl(target), req.url));
    clearSessionCookies(out);
    return out;
  }
  return new NextResponse('Usługa logowania jest chwilowo niedostępna. Odśwież stronę za chwilę.', { status: 503 });
}

export async function POST(req: NextRequest) {
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!rt) return json({ status: 'signed_out' }, 401);
  const outcome = await refreshTokens(rt);
  if (outcome.kind === 'ok') {
    const out = json({ status: 'ok' });
    setSessionCookies(out, outcome.tokens);
    return out;
  }
  if (outcome.kind === 'invalid') {
    const out = json({ status: 'signed_out' }, 401);
    clearSessionCookies(out);
    return out;
  }
  return json({ status: 'unavailable' }, 503);
}
