/** API contract types (docs/api/API.md §2-§5). Enumerations are lowercase strings. */

export const CATEGORIES = ['backend', 'frontend', 'fullstack', 'mobile', 'devops', 'data', 'ai-ml', 'qa', 'security', 'design', 'product', 'project-management', 'support', 'other'] as const;
export const SENIORITIES = ['intern', 'junior', 'mid', 'senior', 'lead'] as const;
export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export const REMOTE_SCOPES = ['poland', 'eu', 'worldwide'] as const;
export const CONTRACT_TYPES = ['uop', 'b2b', 'zlecenie', 'dzielo'] as const;
export const SALARY_BASES = ['gross', 'net'] as const;
export const SALARY_PERIODS = ['month', 'hour', 'day'] as const;
export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CHF'] as const;
export const JOB_STATUSES = ['draft', 'published', 'closed', 'expired'] as const;
export const APPLICATION_STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Seniority = (typeof SENIORITIES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type RemoteScope = (typeof REMOTE_SCOPES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type SalaryBasis = (typeof SALARY_BASES)[number];
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export type Currency = (typeof CURRENCIES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface SalaryOffer {
  contractType: ContractType;
  min: number;
  max: number;
  currency: Currency;
  period: SalaryPeriod;
  basis: SalaryBasis;
}

export interface CompanyRef {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isVerified: boolean;
}

export interface JobSummary {
  id: string;
  slug: string;
  title: string;
  company: CompanyRef;
  category: Category;
  seniority: Seniority;
  workMode: WorkMode;
  remoteScope: RemoteScope | null;
  city: string | null;
  salaries: SalaryOffer[];
  skills: string[];
  isPromoted: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
}

export interface JobDetail extends JobSummary {
  description: string;
  applyUrl: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CompanyListItem extends CompanyRef {
  openJobs: number;
}

export interface CompanyPublic extends CompanyRef {
  website: string | null;
  description: string | null;
  city: string | null;
  openJobs: JobSummary[];
}

export interface CompanyInput {
  name: string;
  website: string;
  description: string;
  city: string;
  logoUrl: string | null;
  nip: string | null;
}

export interface CompanyDetail extends CompanyRef, CompanyInput {
  createdAt: string;
}

export interface JobInput {
  companyId: string;
  title: string;
  description: string;
  category: Category;
  seniority: Seniority;
  workMode: WorkMode;
  remoteScope: RemoteScope | null;
  city: string | null;
  salaries: SalaryOffer[];
  skills: string[];
  applyUrl: string;
}

export interface EmployerJob extends JobDetail {
  status: JobStatus;
  views: number;
  applyClicks: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedJob {
  job: JobSummary;
  status: ApplicationStatus;
  notes: string;
  appliedAt: string | null;
  updatedAt: string;
}

export interface Benchmark {
  sampleSize: number;
  minimumSample: number;
  currency: Currency;
  contractType: ContractType;
  basis: SalaryBasis;
  period: SalaryPeriod;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
}

export interface FilterMeta {
  cities: string[];
}

export interface Stats {
  publishedJobs: number;
  companies: number;
}

/** RFC 9457 problem details as the API emits them. */
export interface Problem {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

// ---- Polish labels -------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<Category, string> = {
  backend: 'Backend', frontend: 'Frontend', fullstack: 'Fullstack', mobile: 'Mobile', devops: 'DevOps',
  data: 'Dane', 'ai-ml': 'AI / ML', qa: 'QA / testy', security: 'Bezpieczeństwo', design: 'Design',
  product: 'Produkt', 'project-management': 'Zarządzanie projektami', support: 'Wsparcie', other: 'Inne',
};
export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Stażysta', junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead',
};
export const WORK_MODE_LABELS: Record<WorkMode, string> = { remote: 'Zdalnie', hybrid: 'Hybrydowo', onsite: 'Stacjonarnie' };
export const REMOTE_SCOPE_LABELS: Record<RemoteScope, string> = { poland: 'z Polski', eu: 'z UE', worldwide: 'z całego świata' };
export const CONTRACT_LABELS: Record<ContractType, string> = { uop: 'UoP', b2b: 'B2B', zlecenie: 'zlecenie', dzielo: 'dzieło' };
export const CONTRACT_LONG_LABELS: Record<ContractType, string> = {
  uop: 'Umowa o pracę (UoP)', b2b: 'B2B (działalność gospodarcza)', zlecenie: 'Umowa zlecenie', dzielo: 'Umowa o dzieło',
};
export const BASIS_LABELS: Record<SalaryBasis, string> = { gross: 'brutto', net: 'netto' };
export const PERIOD_LABELS: Record<SalaryPeriod, string> = { month: 'mies.', hour: 'godz.', day: 'dzień' };
export const JOB_STATUS_LABELS: Record<JobStatus, string> = { draft: 'Szkic', published: 'Opublikowana', closed: 'Zamknięta', expired: 'Wygasła' };
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Zapisane', applied: 'Aplikowano', interviewing: 'Rozmowy', offer: 'Oferta', rejected: 'Odrzucone', archived: 'Archiwum',
};
