import { hasActiveFilters, type SearchFilters } from '@/lib/filters';
import {
  CATEGORIES, CATEGORY_LABELS, CONTRACT_LABELS, CONTRACT_TYPES, SENIORITIES, SENIORITY_LABELS, WORK_MODES, WORK_MODE_LABELS,
} from '@/lib/types';
import Link from 'next/link';

/** Plain GET form: filters live in the URL, so a search is shareable and works without JavaScript. */
export function SearchForm({ filters, cities }: { filters: SearchFilters; cities: string[] }) {
  return (
    <form method="get" action="/" role="search" aria-label="Wyszukiwarka ofert" className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <label htmlFor="q" className="label">Stanowisko, firma lub technologia</label>
        <input id="q" name="q" type="search" defaultValue={filters.q} className="input" placeholder="np. backend, React, Acme" maxLength={100} />
      </div>
      <div>
        <label htmlFor="city" className="label">Miasto</label>
        <input id="city" name="city" list="cities" defaultValue={filters.city} className="input" placeholder="np. Warszawa" maxLength={80} />
        <datalist id="cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div>
        <label htmlFor="workMode" className="label">Tryb pracy</label>
        <select id="workMode" name="workMode" defaultValue={filters.workMode} className="input">
          <option value="">Dowolny</option>
          {WORK_MODES.map((m) => <option key={m} value={m}>{WORK_MODE_LABELS[m]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="seniority" className="label">Poziom</label>
        <select id="seniority" name="seniority" defaultValue={filters.seniority} className="input">
          <option value="">Dowolny</option>
          {SENIORITIES.map((m) => <option key={m} value={m}>{SENIORITY_LABELS[m]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="category" className="label">Kategoria</label>
        <select id="category" name="category" defaultValue={filters.category} className="input">
          <option value="">Wszystkie</option>
          {CATEGORIES.map((m) => <option key={m} value={m}>{CATEGORY_LABELS[m]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="salaryMin" className="label">Minimalne wynagrodzenie (PLN / mies.)</label>
        <input id="salaryMin" name="salaryMin" type="number" inputMode="numeric" min={0} step={500} defaultValue={filters.salaryMin} className="input" placeholder="np. 15000" />
      </div>
      <div>
        <label htmlFor="contractType" className="label">Rodzaj umowy</label>
        <select id="contractType" name="contractType" defaultValue={filters.contractType} className="input">
          <option value="">Dowolny</option>
          {CONTRACT_TYPES.map((m) => <option key={m} value={m}>{CONTRACT_LABELS[m]}</option>)}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button type="submit" className="btn btn-primary flex-1">Szukaj</button>
        {hasActiveFilters(filters) && <Link href="/" className="btn btn-secondary">Wyczyść</Link>}
      </div>
    </form>
  );
}
