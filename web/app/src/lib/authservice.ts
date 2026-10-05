import { headers as requestHeaders } from 'next/headers';
import { authBaseUrl } from './env';

export const AUTH_TIMEOUT_MS = 10_000;

/**
 * The browser's IP (Fly-Client-IP / X-Forwarded-For), so authservice's per-IP limiter and audit
 * records see the user rather than this one web container. Empty outside a request scope.
 */
async function clientIpHeader(): Promise<string | null> {
  try {
    const h = await requestHeaders();
    return h.get('fly-client-ip') ?? h.get('x-forwarded-for');
  } catch {
    return null;
  }
}

export class AuthUpstreamError extends Error {
  constructor(
    public readonly kind: 'redirect' | 'unavailable' | 'timeout',
    message: string,
  ) {
    super(message);
  }
}

export interface AuthResponse {
  status: number;
  // authservice bodies are small ad-hoc JSON objects; callers narrow what they read.
  data: Record<string, unknown>;
}

export interface AuthRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Server-side call to authservice (`AUTH_BASE_URL`). Explicit timeout, `redirect: 'manual'`:
 * a 3xx between services is a configuration bug and surfaces as AuthUpstreamError('redirect').
 */
export async function authRequest(path: string, opts: AuthRequestOptions = {}): Promise<AuthResponse> {
  const { method = 'GET', body, token, timeoutMs = AUTH_TIMEOUT_MS, fetchImpl = fetch } = opts;
  const url = `${authBaseUrl()}${path}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const forwarded = await clientIpHeader();
  if (forwarded) headers['x-forwarded-for'] = forwarded;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') ?? '(no Location)';
      console.error(`[authservice] ${url} answered ${res.status} redirecting to ${location}; configuration bug`);
      throw new AuthUpstreamError('redirect', `${url} -> ${location}`);
    }
    let data: Record<string, unknown> = {};
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      // empty or non-JSON body
    }
    const ra = Number(res.headers.get('retry-after'));
    if (res.status === 429 && data.retryAfter === undefined && Number.isFinite(ra) && ra > 0) data.retryAfter = ra;
    return { status: res.status, data };
  } catch (e) {
    if (e instanceof AuthUpstreamError) throw e;
    if (controller.signal.aborted) {
      console.error(`[authservice] timeout after ${timeoutMs}ms calling ${url}`);
      throw new AuthUpstreamError('timeout', url);
    }
    console.error(`[authservice] ${url} unreachable: ${e instanceof Error ? e.message : String(e)}`);
    throw new AuthUpstreamError('unavailable', url);
  } finally {
    clearTimeout(timer);
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function readTokens(data: Record<string, unknown>): Tokens | null {
  const { accessToken, refreshToken } = data;
  if (typeof accessToken === 'string' && typeof refreshToken === 'string' && accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}
