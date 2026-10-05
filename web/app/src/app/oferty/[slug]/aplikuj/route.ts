import { NextResponse, type NextRequest } from 'next/server';
import { apiCandidates } from '@/lib/env';
import { fetchLadder } from '@/lib/upstream';

export const dynamic = 'force-dynamic';

/**
 * "Aplikuj": counts the click at the API (best-effort statistics) and redirects to the employer's
 * own https apply URL. Nothing about the applicant is stored or sent (ADR 0004). Only an https URL
 * returned by the API is ever followed.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const res = await fetchLadder(apiCandidates(), `/api/v1/jobs/${encodeURIComponent(slug)}/apply-click`, {
    method: 'POST',
    headers: { accept: 'application/json' },
  });
  if (res.status === 404) return new NextResponse('Oferta nie istnieje lub została zamknięta.', { status: 404 });
  if (!res.ok) return new NextResponse('Nie udało się otworzyć ogłoszenia. Spróbuj ponownie.', { status: 502 });

  const data = (await res.json().catch(() => null)) as { applyUrl?: unknown } | null;
  let url: URL | null = null;
  try {
    url = typeof data?.applyUrl === 'string' ? new URL(data.applyUrl) : null;
  } catch {
    url = null;
  }
  if (!url || url.protocol !== 'https:') return new NextResponse('Ogłoszenie nie ma poprawnego adresu aplikacji.', { status: 502 });

  return new NextResponse(null, {
    status: 302,
    headers: { location: url.toString(), 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' },
  });
}
