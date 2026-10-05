import { publicApiUrl, publicSiteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Client-safe runtime config: addresses and flags only, read at request time. No secrets. */
export function GET(): Response {
  return Response.json(
    { publicApiUrl: publicApiUrl(), siteUrl: publicSiteUrl() },
    { headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=300' } },
  );
}
