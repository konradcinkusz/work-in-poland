import { CATEGORIES, CONTRACT_TYPES, SENIORITIES, WORK_MODES, type Category, type ContractType, type Seniority, type WorkMode } from './types';

/** Search filters as they appear in the home page URL (shareable). */
export interface SearchFilters {
  q: string;
  city: string;
  workMode: WorkMode | '';
  seniority: Seniority | '';
  category: Category | '';
  salaryMin: string;
  contractType: ContractType | '';
  page: number;
}

export const DEFAULT_PAGE_SIZE = 20;

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(raw: Raw, key: string): string {
  const v = raw instanceof URLSearchParams ? raw.get(key) : raw[key];
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').trim();
}

function oneOf<T extends string>(values: readonly T[], v: string): T | '' {
  return (values as readonly string[]).includes(v) ? (v as T) : '';
}

export function parseFilters(raw: Raw): SearchFilters {
  const salary = pick(raw, 'salaryMin');
  const page = Number.parseInt(pick(raw, 'page'), 10);
  return {
    q: pick(raw, 'q').slice(0, 100),
    city: pick(raw, 'city').slice(0, 80),
    workMode: oneOf(WORK_MODES, pick(raw, 'workMode')),
    seniority: oneOf(SENIORITIES, pick(raw, 'seniority')),
    category: oneOf(CATEGORIES, pick(raw, 'category')),
    salaryMin: /^\d{1,8}$/.test(salary) ? salary : '',
    contractType: oneOf(CONTRACT_TYPES, pick(raw, 'contractType')),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Filters -> the page's own query string (empty values and page 1 are omitted). */
export function filtersToQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.city) p.set('city', f.city);
  if (f.workMode) p.set('workMode', f.workMode);
  if (f.seniority) p.set('seniority', f.seniority);
  if (f.category) p.set('category', f.category);
  if (f.salaryMin) p.set('salaryMin', f.salaryMin);
  if (f.contractType) p.set('contractType', f.contractType);
  if (f.page > 1) p.set('page', String(f.page));
  return p.toString();
}

/** Filters -> the API's `GET /api/v1/jobs` query string. */
export function filtersToApiQuery(f: SearchFilters, limit = DEFAULT_PAGE_SIZE): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.city) p.set('city', f.city);
  if (f.workMode) p.set('workMode', f.workMode);
  if (f.seniority) p.set('seniority', f.seniority);
  if (f.category) p.set('category', f.category);
  if (f.salaryMin) p.set('salaryMin', f.salaryMin);
  if (f.contractType) p.set('contractType', f.contractType);
  p.set('page', String(f.page));
  p.set('limit', String(limit));
  return p.toString();
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return !!(f.q || f.city || f.workMode || f.seniority || f.category || f.salaryMin || f.contractType);
}
