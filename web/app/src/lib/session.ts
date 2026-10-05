import { authRequest, AuthUpstreamError, readTokens, type Tokens } from './authservice';
import { decodeExp } from './jwt';

export type RefreshOutcome =
  | { kind: 'ok'; tokens: Tokens }
  /** authservice rejected the refresh token: the user is signed out. */
  | { kind: 'invalid' }
  /** authservice could not be reached: keep the cookies, tell the caller to retry. */
  | { kind: 'unavailable' };

/** A request that still carries the old cookie may arrive after the rotation; keep the result briefly. */
const GRACE_MS = 15_000;

const inflight = new Map<string, Promise<RefreshOutcome>>();
const recent = new Map<string, { outcome: RefreshOutcome; at: number }>();

export function resetRefreshState(): void {
  inflight.clear();
  recent.clear();
}

async function callRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const res = await authRequest('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
    if (res.status === 200) {
      const tokens = readTokens(res.data);
      return tokens ? { kind: 'ok', tokens } : { kind: 'unavailable' };
    }
    if (res.status === 400 || res.status === 401) return { kind: 'invalid' };
    return { kind: 'unavailable' };
  } catch (e) {
    if (e instanceof AuthUpstreamError) return { kind: 'unavailable' };
    throw e;
  }
}

/**
 * Refresh tokens are single-use. Two parallel requests carrying the same old token would race:
 * the loser would be rejected and the user signed out. So refreshes are serialised per refresh
 * token IN-PROCESS: concurrent callers share one promise, and late callers within GRACE_MS get the
 * stored result. (Multiple web instances behind a load balancer need sticky sessions or a shared
 * lock; the web app runs as a single instance.)
 */
export function refreshTokens(refreshToken: string, now: number = Date.now()): Promise<RefreshOutcome> {
  for (const [key, entry] of recent) {
    if (now - entry.at > GRACE_MS) recent.delete(key);
  }
  const cached = recent.get(refreshToken);
  if (cached) return Promise.resolve(cached.outcome);
  const running = inflight.get(refreshToken);
  if (running) return running;

  const promise = callRefresh(refreshToken)
    .then((outcome) => {
      if (outcome.kind === 'ok') recent.set(refreshToken, { outcome, at: Date.now() });
      return outcome;
    })
    .finally(() => inflight.delete(refreshToken));
  inflight.set(refreshToken, promise);
  return promise;
}

export const EXPIRY_SKEW_SECONDS = 30;

export type ResolvedAccess =
  | { kind: 'token'; accessToken: string; rotated?: Tokens }
  | { kind: 'anonymous'; clear: boolean }
  | { kind: 'unavailable' };

/**
 * Returns a usable access token for a request: the cookie's token when it is not expired or about
 * to expire, otherwise a transparently refreshed one (`rotated` carries the new pair so the caller
 * can store it). A failed refresh means signed out (`clear`: the stale cookies should be removed).
 */
export async function resolveAccess(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<ResolvedAccess> {
  if (accessToken) {
    const exp = decodeExp(accessToken);
    if (exp !== null && exp - nowSeconds > EXPIRY_SKEW_SECONDS) return { kind: 'token', accessToken };
  }
  if (!refreshToken) return { kind: 'anonymous', clear: !!accessToken };
  const outcome = await refreshTokens(refreshToken);
  if (outcome.kind === 'ok') return { kind: 'token', accessToken: outcome.tokens.accessToken, rotated: outcome.tokens };
  if (outcome.kind === 'invalid') return { kind: 'anonymous', clear: true };
  return { kind: 'unavailable' };
}
