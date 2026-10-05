import { describe, expect, it } from 'vitest';
import { formatAmount, formatSalary, relativeDate, toMonthly } from './salary';
import type { SalaryOffer } from './types';

const nb = (s: string) => s.replace(/ /g, ' ');
const offer = (o: Partial<SalaryOffer>): SalaryOffer => ({ contractType: 'b2b', min: 18000, max: 24000, currency: 'PLN', period: 'month', basis: 'net', ...o });

describe('formatSalary', () => {
  it('renders B2B net monthly', () => {
    expect(nb(formatSalary(offer({})))).toBe('18 000 – 24 000 PLN netto / mies. (B2B)');
  });
  it('renders UoP gross monthly', () => {
    expect(nb(formatSalary(offer({ contractType: 'uop', basis: 'gross', min: 15000, max: 20000 })))).toBe('15 000 – 20 000 PLN brutto / mies. (UoP)');
  });
  it('renders hourly and daily periods and other contract types', () => {
    expect(nb(formatSalary(offer({ period: 'hour', min: 120, max: 180, contractType: 'zlecenie' })))).toBe('120 – 180 PLN netto / godz. (zlecenie)');
    expect(nb(formatSalary(offer({ period: 'day', min: 900, max: 1200, currency: 'EUR', contractType: 'dzielo' })))).toBe('900 – 1 200 EUR netto / dzień (dzieło)');
  });
  it('collapses an equal range', () => {
    expect(nb(formatSalary(offer({ min: 10000, max: 10000 })))).toBe('10 000 PLN netto / mies. (B2B)');
  });
});

describe('formatAmount', () => {
  it('groups thousands and keeps decimals', () => {
    expect(nb(formatAmount(999))).toBe('999');
    expect(nb(formatAmount(1234567))).toBe('1 234 567');
    expect(nb(formatAmount(1234.5))).toBe('1 234,50');
  });
});

describe('relativeDate', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  it('speaks Polish', () => {
    expect(relativeDate('2026-10-05T01:00:00Z', now)).toBe('dzisiaj');
    expect(relativeDate('2026-10-04T10:00:00Z', now)).toBe('wczoraj');
    expect(relativeDate('2026-10-01T10:00:00Z', now)).toBe('4 dni temu');
    expect(relativeDate('2026-09-20T10:00:00Z', now)).toBe('2 tyg. temu');
    expect(relativeDate(null, now)).toBe('');
  });
});

describe('toMonthly', () => {
  it('mirrors the API normalisation', () => {
    expect(toMonthly(100, 'hour')).toBe(16800);
    expect(toMonthly(100, 'day')).toBe(2100);
    expect(toMonthly(100, 'month')).toBe(100);
  });
});
