import type { MetadataRoute } from 'next';
import { apiCandidates, publicSiteUrl } from '@/lib/env';
import { fetchLadder } from '@/lib/upstream';
import type { CompanyListItem, JobSummary, Page } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const MAX_PAGES = 100; // 10 000 URLs per list; the sitemap protocol allows 50 000 per file

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchLadder(apiCandidates(), `/api/v1${path}?page=${page}&limit=${PAGE_SIZE}`, {
      headers: { accept: 'application/json' },
      timeoutMs: 10_000,
    });
    if (!res.ok) break; // a sitemap with only static URLs beats a failing sitemap
    const data = (await res.json()) as Page<T>;
    out.push(...data.items);
    if (out.length >= data.total || data.items.length === 0) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicSiteUrl();
  const [jobs, companies] = await Promise.all([fetchAll<JobSummary>('/jobs'), fetchAll<CompanyListItem>('/companies')]);
  return [
    { url: `${site}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${site}/wynagrodzenia`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${site}/mcp`, changeFrequency: 'monthly', priority: 0.3 },
    ...jobs.map((j) => ({
      url: `${site}/oferty/${j.slug}`,
      lastModified: j.publishedAt ?? undefined,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...companies.map((c) => ({ url: `${site}/firmy/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
  ];
}
