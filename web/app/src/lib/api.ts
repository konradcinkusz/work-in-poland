import 'server-only';
import { apiCandidates } from './env';
import { fetchLadder } from './upstream';
import type { Benchmark, CompanyPublic, FilterMeta, JobDetail, JobSummary, Page, Stats, CompanyListItem } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Server-side anonymous read of the public API with the candidate ladder. `null` for 404. */
async function getPublic<T>(path: string, revalidate = 30): Promise<T | null> {
  const res = await fetchLadder(apiCandidates(), `/api/v1${path}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    // Next's fetch cache: revalidated pages, shared by all visitors.
    ...({ next: { revalidate } } as object),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, `API ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

export const getStats = () => getPublic<Stats>('/stats', 60);
export const getFilterMeta = () => getPublic<FilterMeta>('/meta/filters', 300);
export const searchJobs = (query: string) => getPublic<Page<JobSummary>>(`/jobs?${query}`, 15);
export const getJob = (slug: string) => getPublic<JobDetail>(`/jobs/${encodeURIComponent(slug)}`, 30);
export const getCompany = (slug: string) => getPublic<CompanyPublic>(`/companies/${encodeURIComponent(slug)}`, 60);
export const listCompanies = (page: number, limit: number) =>
  getPublic<Page<CompanyListItem>>(`/companies?page=${page}&limit=${limit}`, 300);
export const getBenchmark = (query: string) => getPublic<Benchmark>(`/salaries/benchmarks?${query}`, 60);
