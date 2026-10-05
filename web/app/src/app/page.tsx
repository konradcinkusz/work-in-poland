import type { Metadata } from 'next';
import Link from 'next/link';
import { JobCard } from '@/components/job-card';
import { Pagination } from '@/components/pagination';
import { SearchForm } from '@/components/search-form';
import { getFilterMeta, getStats, searchJobs } from '@/lib/api';
import { DEFAULT_PAGE_SIZE, filtersToApiQuery, filtersToQuery, hasActiveFilters, parseFilters } from '@/lib/filters';
import type { JobSummary, Page } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Oferty pracy z widełkami wynagrodzenia',
  description: 'Przeszukuj polskie oferty pracy, w których każde ogłoszenie ma jawne widełki wynagrodzenia — brutto/netto, UoP i B2B.',
  alternates: { canonical: '/' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;


export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const accountDeleted = sp.konto === 'usuniete';

  const [stats, meta, results] = await Promise.all([
    getStats().catch(() => null),
    getFilterMeta().catch(() => null),
    searchJobs(filtersToApiQuery(filters)).then(
      (page): { page: Page<JobSummary> | null; error: false } => ({ page, error: false }),
      () => ({ page: null, error: true as const }),
    ),
  ]);

  const hrefFor = (page: number) => {
    const q = filtersToQuery({ ...filters, page });
    return q ? `/?${q}` : '/';
  };

  return (
    <div className="space-y-8">
      {accountDeleted && <div role="status" className="alert alert-success">Twoje dane i konto zostały usunięte.</div>}
      <section aria-labelledby="hero" className="rounded-xl bg-slate-900 px-6 py-10 text-white sm:px-10">
        <h1 id="hero" className="max-w-3xl">Praca w Polsce — zawsze z widełkami wynagrodzenia</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-200">
          Każda oferta pokazuje stawkę, a nie „do uzgodnienia”. Szukaj tutaj albo poproś swojego asystenta AI —{' '}
          <Link href="/mcp" className="text-white underline">to działa przez MCP</Link>.
        </p>
        {stats && (
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-2" aria-label="Statystyki serwisu">
            <div><dt className="text-sm text-slate-300">Aktywne oferty</dt><dd className="text-2xl font-bold">{stats.publishedJobs}</dd></div>
            <div><dt className="text-sm text-slate-300">Firmy</dt><dd className="text-2xl font-bold">{stats.companies}</dd></div>
          </dl>
        )}
      </section>

      <SearchForm filters={filters} cities={meta?.cities ?? []} />

      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="mb-4">
          {results.page ? `Wyniki: ${results.page.total}` : 'Wyniki'}
        </h2>
        {results.error && (
          <div role="alert" className="alert alert-error">
            Nie udało się pobrać ofert. Odśwież stronę za chwilę.
          </div>
        )}
        {results.page && results.page.items.length === 0 && (
          <div className="card text-center">
            <p className="font-medium">Brak ofert spełniających kryteria.</p>
            <p className="mt-1 text-sm text-slate-700">
              {hasActiveFilters(filters) ? 'Spróbuj zmienić lub wyczyścić filtry.' : 'Wróć wkrótce — nowe oferty pojawiają się na bieżąco.'}
            </p>
            {hasActiveFilters(filters) && <Link href="/" className="btn btn-secondary mt-4">Wyczyść filtry</Link>}
          </div>
        )}
        {results.page && results.page.items.length > 0 && (
          <>
            <ul className="space-y-3">
              {results.page.items.map((job) => (
                <li key={job.id}><JobCard job={job} /></li>
              ))}
            </ul>
            <Pagination page={results.page.page} total={results.page.total} limit={results.page.limit || DEFAULT_PAGE_SIZE} hrefFor={hrefFor} />
          </>
        )}
      </section>
    </div>
  );
}
