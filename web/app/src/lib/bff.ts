import { NextResponse, type NextRequest } from 'next/server';
import { AuthUpstreamError, authRequest, type AuthResponse } from './authservice';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
  type CookieWriter,
} from './cookies';
import { resolveAccess, type ResolvedAccess } from './session';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/** Maps an authservice transport failure to a user-safe response. Details are only in the log. */
export function upstreamFailure(e: unknown): NextResponse {
  if (e instanceof AuthUpstreamError) {
    const status = e.kind === 'redirect' ? 502 : e.kind === 'timeout' ? 504 : 503;
    return json({ status: 'unavailable', error: 'Usługa logowania jest chwilowo niedostępna.' }, status);
  }
  throw e;
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await req.json();
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(v: unknown, max = 2000): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

/** authservice error bodies are `{ error }` or `{ errors: [...] }`; normalise to a string list. */
export function errorList(data: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (Array.isArray(data.errors)) for (const e of data.errors) if (typeof e === 'string') out.push(e);
  if (typeof data.error === 'string') out.push(data.error);
  return out;
}

export function rateLimited(res: AuthResponse): NextResponse {
  const retry = typeof res.data.retryAfter === 'number' ? res.data.retryAfter : undefined;
  return json(
    { status: 'rate_limited', retryAfter: retry, error: 'Zbyt wiele prób, spróbuj za chwilę.' },
    429,
    retry === undefined ? {} : { 'retry-after': String(retry) },
  );
}

export interface RequestSession {
  resolved: ResolvedAccess;
  accessToken: string | null;
  /** Writes rotated or cleared cookies onto the outgoing response. */
  apply<T extends CookieWriter>(res: T): T;
}

/** Resolves the caller's access token from cookies, refreshing transparently when needed. */
export async function sessionFor(req: NextRequest): Promise<RequestSession> {
  const resolved = await resolveAccess(req.cookies.get(ACCESS_COOKIE)?.value, req.cookies.get(REFRESH_COOKIE)?.value);
  return {
    resolved,
    accessToken: resolved.kind === 'token' ? resolved.accessToken : null,
    apply(res) {
      if (resolved.kind === 'token' && resolved.rotated) setSessionCookies(res, resolved.rotated);
      else if (resolved.kind === 'anonymous' && resolved.clear) clearSessionCookies(res);
      return res;
    },
  };
}

export { authRequest, AuthUpstreamError, setSessionCookies };
