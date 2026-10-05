import { NextResponse, type NextRequest } from 'next/server';
import { sessionFor, json } from '@/lib/bff';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/cookies';
import { apiCandidates } from '@/lib/env';
import { refreshTokens } from '@/lib/session';
import { fetchLadder } from '@/lib/upstream';

export const dynamic = 'force-dynamic';

const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'if-none-match', 'fly-client-ip', 'x-forwarded-for'];
const FORWARD_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-length', 'retry-after', 'etag', 'cache-control'];

/**
 * The one catch-all BFF route: `/api/proxy/<x>` -> API `/api/v1/<x>`. The bearer is injected
 * server-side from the cookie (refreshed transparently when expired or near expiry); the browser
 * never sees a token or a backend address. Response bodies are streamed.
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  if (path.some((s) => s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    return json({ title: 'Nieprawidłowa ścieżka', status: 400 }, 400);
  }
  const target = `/api/v1/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const session = await sessionFor(req);
  if (session.resolved.kind === 'unavailable') {
    return json({ title: 'Usługa logowania niedostępna', status: 503 }, 503);
  }

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const call = (token: string | null) => {
    const h = new Headers(headers);
    if (token) h.set('authorization', `Bearer ${token}`);
    return fetchLadder(apiCandidates(), target, { method: req.method, headers: h, body });
  };

  let token = session.accessToken;
  let rotated = session.resolved.kind === 'token' ? session.resolved.rotated : undefined;
  let clear = session.resolved.kind === 'anonymous' && session.resolved.clear;
  let upstream = await call(token);

  // A token that looked valid locally was refused: try once with a freshly refreshed one.
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (upstream.status === 401 && token && !rotated && rt) {
    void upstream.body?.cancel().catch(() => undefined);
    const outcome = await refreshTokens(rt);
    if (outcome.kind === 'ok') {
      rotated = outcome.tokens;
      token = outcome.tokens.accessToken;
      upstream = await call(token);
    } else if (outcome.kind === 'invalid') {
      clear = true;
      upstream = await call(null);
    }
  }

  const out = new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, { status: upstream.status });
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.headers.set(name, v);
  }
  // Authenticated and mutable data must never be cached by a shared cache.
  out.headers.set('cache-control', 'no-store');
  if (rotated) setSessionCookies(out, rotated);
  else if (clear) clearSessionCookies(out);
  return out;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
