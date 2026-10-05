import { authRequest, AuthUpstreamError, json } from '@/lib/bff';

export const dynamic = 'force-dynamic';

/** Current document versions as published by authservice (the register form shows them; it never hard-codes them). */
export async function GET() {
  try {
    const res = await authRequest('/api/v1/auth/consents/versions', { timeoutMs: 5000 });
    const { terms, privacy } = res.data;
    if (res.status !== 200 || typeof terms !== 'string' || typeof privacy !== 'string') {
      return json({ status: 'unavailable' }, 503);
    }
    return json({ terms, privacy }, 200, { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
  } catch (e) {
    if (e instanceof AuthUpstreamError) return json({ status: 'unavailable' }, 503);
    throw e;
  }
}
