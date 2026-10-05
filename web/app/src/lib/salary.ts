import {
  BASIS_LABELS, CONTRACT_LABELS, PERIOD_LABELS,
  type Benchmark, type SalaryOffer,
} from './types';

const NBSP = ' ';

/** 18000 -> "18 000" (non-breaking space as the thousands separator, deterministic across runtimes). */
export function formatAmount(n: number): string {
  const [int = '0', frac] = Math.abs(n).toFixed(2).replace(/\.00$/, '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${n < 0 ? '-' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}

/** "18 000 – 24 000 PLN netto / mies. (B2B)" */
export function formatSalary(s: SalaryOffer): string {
  const range = s.min === s.max ? formatAmount(s.min) : `${formatAmount(s.min)} – ${formatAmount(s.max)}`;
  return `${range} ${s.currency} ${BASIS_LABELS[s.basis]} / ${PERIOD_LABELS[s.period]} (${CONTRACT_LABELS[s.contractType]})`;
}

export function formatBenchmarkBasis(b: Pick<Benchmark, 'currency' | 'basis' | 'period'>): string {
  return `${b.currency} ${BASIS_LABELS[b.basis]} / ${PERIOD_LABELS[b.period]}`;
}

/** Relative publication date in Polish: "dzisiaj", "wczoraj", "3 dni temu", "2 tyg. temu". */
export function relativeDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'dzisiaj';
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  if (days < 30) return `${Math.floor(days / 7)} tyg. temu`;
  if (days < 365) return `${Math.floor(days / 30)} mies. temu`;
  return `${Math.floor(days / 365)} lat temu`;
}

/** Month-normalised conversion used by the API (hour x 168, day x 21), for client-side hints only. */
export function toMonthly(amount: number, period: SalaryOffer['period']): number {
  return period === 'hour' ? amount * 168 : period === 'day' ? amount * 21 : amount;
}
