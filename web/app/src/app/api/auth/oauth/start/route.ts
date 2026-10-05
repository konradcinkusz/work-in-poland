import { NextResponse, type NextRequest } from 'next/server';
import { authPublicUrl, publicSiteUrl } from '@/lib/env';
import { authRequest, AuthUpstreamError } from '@/lib/bff';
import { POST_LOGIN_COOKIE, cookieAttributes } from '@/lib/cookies';
import { loginUrl, safeRedirect } from '@/lib/redirect';

/**
 * Starts social login: validates the provider against authservice's configured list, remembers
 * where to land afterwards, and redirects the browser to authservice, which returns to
 * `<site>/oauth/callback?code=...`.
 */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') ?? '';
  const redirect = safeRedirect(req.nextUrl.searchParams.get('redirect'), '/');
  try {
    const res = await authRequest('/api/v1/external-auth/providers', { timeoutMs: 5000 });
    const list = Array.isArray(res.data.providers) ? (res.data.providers as Record<string, unknown>[]) : [];
    if (!list.some((p) => p.provider === provider)) {
      return NextResponse.redirect(new URL(`${loginUrl(redirect)}&error=provider`, req.url));
    }
  } catch (e) {
    if (e instanceof AuthUpstreamError) return NextResponse.redirect(new URL(`${loginUrl(redirect)}&error=unavailable`, req.url));
    throw e;
  }
  const target = new URL(`${authPublicUrl()}/api/v1/external-auth/login`);
  target.searchParams.set('provider', provider);
  target.searchParams.set('returnUrl', `${publicSiteUrl()}/oauth/callback`);
  const out = NextResponse.redirect(target);
  // Lax, not strict: the cookie must come back on the cross-site navigation from the provider.
  out.cookies.set(POST_LOGIN_COOKIE, redirect, cookieAttributes(600, undefined, 'lax'));
  return out;
}
