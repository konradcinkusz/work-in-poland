import type { Metadata } from 'next';
import { SalaryRange } from '@/components/salary-range';
import { getBenchmark } from '@/lib/api';
import { formatAmount, formatBenchmarkBasis } from '@/lib/salary';
import {
  CATEGORIES, CATEGORY_LABELS, CONTRACT_LABELS, CONTRACT_TYPES, CURRENCIES, SENIORITIES, SENIORITY_LABELS,
  type Benchmark, type ContractType, type Currency,
} from '@/lib/types';

export const metadata: Metadata = {
  title: 'Wynagrodzenia — benchmark widełek',
  description: 'Sprawdź, ile zarabia się na danym stanowisku: minimum, kwartyle, mediana i maksimum z aktualnych ofert pracy.',
  alternates: { canonical: '/wynagrodzenia' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim();
}

export default async function SalariesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const title = one(sp.title).slice(0, 100);
  const category = (CATEGORIES as readonly string[]).includes(one(sp.category)) ? one(sp.category) : '';
  const seniority = (SENIORITIES as readonly string[]).includes(one(sp.seniority)) ? one(sp.seniority) : '';
  const contractType = ((CONTRACT_TYPES as readonly string[]).includes(one(sp.contractType)) ? one(sp.contractType) : 'b2b') as ContractType;
  const currency = ((CURRENCIES as readonly string[]).includes(one(sp.currency)) ? one(sp.currency) : 'PLN') as Currency;
  const city = one(sp.city).slice(0, 80);

  const submitted = Object.keys(sp).length > 0;
  let benchmark: Benchmark | null = null;
  let failed = false;
  if (submitted) {
    const q = new URLSearchParams({ contractType, currency });
    if (title) q.set('title', title);
    if (category) q.set('category', category);
    if (seniority) q.set('seniority', seniority);
    if (city) q.set('city', city);
    try {
      benchmark = await getBenchmark(q.toString());
    } catch {
      failed = true;
    }
  }

  const enough = benchmark && benchmark.median !== null && benchmark.min !== null && benchmark.p25 !== null && benchmark.p75 !== null && benchmark.max !== null;

  return (
    <div className="space-y-8">
      <header>
        <h1>Wynagrodzenia</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Zestawienie z widełek w aktualnych ofertach (środek każdej widełki, przeliczony na miesiąc). Brutto i netto nigdy się nie mieszają:
          UoP porównujemy brutto, pozostałe umowy netto.
        </p>
      </header>

      <form method="get" className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Parametry benchmarku">
        <div>
          <label htmlFor="title" className="label">Stanowisko (fragment tytułu)</label>
          <input id="title" name="title" defaultValue={title} className="input" placeholder="np. backend" maxLength={100} />
        </div>
        <div>
          <label htmlFor="category" className="label">Kategoria</label>
          <select id="category" name="category" defaultValue={category} className="input">
            <option value="">Wszystkie</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="seniority" className="label">Poziom</label>
          <select id="seniority" name="seniority" defaultValue={seniority} className="input">
            <option value="">Dowolny</option>
            {SENIORITIES.map((c) => <option key={c} value={c}>{SENIORITY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="contractType" className="label">Rodzaj umowy</label>
          <select id="contractType" name="contractType" defaultValue={contractType} className="input">
            {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{CONTRACT_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="city" className="label">Miasto</label>
          <input id="city" name="city" defaultValue={city} className="input" maxLength={80} />
        </div>
        <div>
          <label htmlFor="currency" className="label">Waluta</label>
          <select id="currency" name="currency" defaultValue={currency} className="input">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn btn-primary">Pokaż benchmark</button>
        </div>
      </form>

      <section aria-labelledby="result" aria-live="polite">
        <h2 id="result" className="mb-3">Wynik</h2>
        {!submitted && <p className="text-slate-700">Wybierz parametry i kliknij „Pokaż benchmark”.</p>}
        {failed && <div role="alert" className="alert alert-error">Nie udało się pobrać danych. Spróbuj ponownie za chwilę.</div>}
        {benchmark && !enough && (
          <div className="alert alert-info">
            <p className="font-semibold">Za mało danych (min. {benchmark.minimumSample} oferty)</p>
            <p className="mt-1">
              Dla tej kombinacji mamy {benchmark.sampleSize} {benchmark.sampleSize === 1 ? 'ofertę' : 'ofert(y)'}. Statystyk nie pokazujemy,
              bo benchmark z dwóch ogłoszeń pozwalałby je zidentyfikować. Poszerz kryteria (np. usuń miasto lub poziom).
            </p>
          </div>
        )}
        {benchmark && enough && benchmark.min !== null && benchmark.p25 !== null && benchmark.median !== null && benchmark.p75 !== null && benchmark.max !== null && (
          <div className="card space-y-4">
            <p className="text-sm text-slate-700">
              Próba: <strong>{benchmark.sampleSize}</strong> ofert · {formatBenchmarkBasis(benchmark)}
            </p>
            <p className="text-3xl font-bold">
              Mediana: {formatAmount(benchmark.median)} <span className="text-lg font-medium">{formatBenchmarkBasis(benchmark)}</span>
            </p>
            <SalaryRange values={{ min: benchmark.min, p25: benchmark.p25, median: benchmark.median, p75: benchmark.p75, max: benchmark.max }} unit={formatBenchmarkBasis(benchmark)} />
            <table className="w-full max-w-md text-left text-sm">
              <caption className="sr-only">Statystyki widełek</caption>
              <tbody>
                {([['Minimum', benchmark.min], ['25. percentyl', benchmark.p25], ['Mediana', benchmark.median], ['75. percentyl', benchmark.p75], ['Maksimum', benchmark.max]] as const).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-200">
                    <th scope="row" className="py-1.5 pr-4 font-medium">{k}</th>
                    <td className="py-1.5">{formatAmount(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
