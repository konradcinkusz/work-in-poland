import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from '@/lib/cookies';
import { authRequest, json, upstreamFailure } from '@/lib/bff';
import { refreshTokens, resolveAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Rehydrates client session state (client JS cannot read the httpOnly cookies). */
export async function GET(req: NextRequest) {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  const anonymous = (clear: boolean) => {
    const out = json({ authenticated: false });
    if (clear) clearSessionCookies(out);
    return out;
  };

  try {
    const resolved = await resolveAccess(at, rt);
    if (resolved.kind === 'anonymous') return anonymous(resolved.clear);
    if (resolved.kind === 'unavailable') return json({ authenticated: false, unavailable: true }, 503);

    let token = resolved.accessToken;
    let rotated = resolved.rotated;
    let me = await authRequest('/api/v1/auth/me', { token });
    if (me.status === 401 && !rotated && rt) {
      // A token that looked fine locally was refused (revoked, or clock skew): try once with a new one.
      const outcome = await refreshTokens(rt);
      if (outcome.kind === 'invalid') return anonymous(true);
      if (outcome.kind === 'unavailable') return json({ authenticated: false, unavailable: true }, 503);
      rotated = outcome.tokens;
      token = outcome.tokens.accessToken;
      me = await authRequest('/api/v1/auth/me', { token });
    }
    if (me.status === 401) return anonymous(true);
    if (me.status !== 200) return json({ authenticated: false, unavailable: true }, 503);

    const out = json({
      authenticated: true,
      userId: me.data.id ?? null,
      email: me.data.email ?? null,
      requiresConsent: me.data.requiresConsent === true,
      emailConfirmed: me.data.emailConfirmed !== false,
      hasPassword: me.data.hasPassword !== false,
    });
    if (rotated) setSessionCookies(out, rotated);
    return out;
  } catch (e) {
    return upstreamFailure(e);
  }
}
