import { authRequest, AuthUpstreamError, json } from '@/lib/bff';

export const dynamic = 'force-dynamic';

export interface Provider {
  provider: string;
  displayName: string;
}

/** Social-login providers configured at authservice. Buttons are rendered ONLY from this list. */
export async function GET() {
  try {
    const res = await authRequest('/api/v1/external-auth/providers', { timeoutMs: 5000 });
    const raw = Array.isArray(res.data.providers) ? res.data.providers : [];
    const providers: Provider[] = [];
    for (const p of raw as unknown[]) {
      if (p && typeof p === 'object') {
        const { provider, displayName } = p as Record<string, unknown>;
        if (typeof provider === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(provider)) {
          providers.push({ provider, displayName: typeof displayName === 'string' ? displayName : provider });
        }
      }
    }
    return json({ providers: res.status === 200 ? providers : [] }, 200, { 'cache-control': 'public, max-age=30, stale-while-revalidate=300' });
  } catch (e) {
    if (e instanceof AuthUpstreamError) return json({ providers: [] });
    throw e;
  }
}
