// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JobCard } from './job-card';
import { passwordStrength } from './register-form';
import { SalaryRange } from './salary-range';
import type { JobSummary } from '@/lib/types';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const job: JobSummary = {
  id: 'j1', slug: 'senior-backend-acme', title: 'Senior Backend Engineer',
  company: { id: 'c1', slug: 'acme', name: 'Acme', logoUrl: null, isVerified: true },
  category: 'backend', seniority: 'senior', workMode: 'remote', remoteScope: 'poland', city: null,
  salaries: [
    { contractType: 'b2b', min: 18000, max: 24000, currency: 'PLN', period: 'month', basis: 'net' },
    { contractType: 'uop', min: 15000, max: 20000, currency: 'PLN', period: 'month', basis: 'gross' },
  ],
  skills: ['c#', 'postgresql'], isPromoted: true, publishedAt: '2026-10-04T10:00:00Z', expiresAt: null,
};

describe('JobCard', () => {
  it('shows title, verified company, one salary line per contract type, skills and the promoted marker', () => {
    render(<JobCard job={job} now={new Date('2026-10-05T12:00:00Z')} />);
    expect(screen.getByRole('link', { name: 'Senior Backend Engineer' })).toHaveAttribute('href', '/oferty/senior-backend-acme');
    expect(screen.getByText('Zweryfikowana firma')).toBeInTheDocument();
    expect(screen.getByText('Promowane')).toBeInTheDocument();
    expect(screen.getByText(/18\s000 – 24\s000 PLN netto \/ mies\. \(B2B\)/)).toBeInTheDocument();
    expect(screen.getByText(/15\s000 – 20\s000 PLN brutto \/ mies\. \(UoP\)/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Umiejętności' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('wczoraj')).toBeInTheDocument();
  });
});

describe('SalaryRange', () => {
  it('exposes the five statistics as an accessible image', () => {
    render(<SalaryRange values={{ min: 12000, p25: 17000, median: 21000, p75: 25000, max: 32000 }} unit="PLN netto / mies." />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/minimum 12\s000.*mediana 21\s000.*maksimum 32\s000/);
  });
});

describe('passwordStrength', () => {
  it('grades length and variety', () => {
    expect(passwordStrength('').level).toBe(0);
    expect(passwordStrength('abc').label).toMatch(/Za krótkie/);
    expect(passwordStrength('abcdefgh').level).toBe(1);
    expect(passwordStrength('Abcdefgh1!xyz').level).toBe(3);
  });
});
