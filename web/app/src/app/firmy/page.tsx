import type { Metadata } from 'next';
import Link from 'next/link';
import { Pagination } from '@/components/pagination';
import { fetchLadder } from '@/lib/upstream';
import { plural } from '@/lib/plural';
import type { CompanyListItem, Page } from '@/lib/types';
import { apiCandidates } from '@/lib/env';

type Props = {
  searchParams: Promise<{ q?: string; verified?: string; page?: string }>;
};

export const metadata: Metadata = {
  title: 'Firmy',
  description: 'Przeglądaj polskie firmy publikujące oferty pracy z widełkami wynagrodzenia.',
  alternates: { canonical: '/firmy' },
};

export default async function CompaniesPage({ searchParams }: Props) {
  const { q = '', verified = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 20;
  const verifiedOnly = verified === 'true';

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (verifiedOnly) params.set('verifiedOnly', 'true');
  params.set('page', String(pageNum));
  params.set('limit', String(limit));

  const res = await fetchLadder(apiCandidates(), `/api/v1/companies?${params}`, {
    headers: { accept: 'application/json' },
    timeoutMs: 10_000,
  });

  const data = (await res.json()) as Page<CompanyListItem>;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (verifiedOnly) sp.set('verified', 'true');
    if (p !== 1) sp.set('page', String(p));
    const qs = sp.toString();
    return `/firmy${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1>Firmy</h1>
        <p className="mt-2 text-slate-700">Przeglądaj polskie firmy publikujące oferty pracy. Liczba obok nazwy to liczba otwartych ofert.</p>
      </header>

      <form className="card space-y-4">
        <div>
          <label htmlFor="q" className="label">Szukaj</label>
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nazwa firmy"
            className="input"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="verified"
            value="true"
            defaultChecked={verifiedOnly}
            className="h-4 w-4 cursor-pointer"
          />
          <span>Tylko zweryfikowane</span>
        </label>
        <button type="submit" className="btn btn-primary">Szukaj</button>
      </form>

      {data.items.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium">Nie znaleziono firm.</p>
          <p className="mt-1 text-sm text-slate-700">Spróbuj zmienić parametry wyszukiwania.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((c) => (
              <li key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">
                      <Link href={`/firmy/${c.slug}`} className="hover:underline">{c.name}</Link>
                      {c.isVerified && <span className="ml-2 badge bg-green-100 text-green-900">Zweryfikowana</span>}
                    </h2>
                  </div>
                  <div className="whitespace-nowrap text-right">
                    <p className="text-sm font-semibold">{c.openJobs} {plural(c.openJobs, ['oferta', 'oferty', 'ofert'])}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={pageNum}
            total={data.total}
            limit={limit}
            hrefFor={href}
          />
        </>
      )}
    </div>
  );
}
