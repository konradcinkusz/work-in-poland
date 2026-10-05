import type { NextRequest } from 'next/server';
import { authRequest, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';

/** Re-sends the verification e-mail. Same answer for every address (no enumeration). */
export async function POST(req: NextRequest) {
  const email = str((await readJson(req))?.email, 256);
  if (!email) return json({ status: 'ok' });
  try {
    const res = await authRequest('/api/v1/auth/resend-verification', { method: 'POST', body: { email } });
    if (res.status === 429) return rateLimited(res);
    return json({ status: 'ok' });
  } catch (e) {
    return upstreamFailure(e);
  }
}
