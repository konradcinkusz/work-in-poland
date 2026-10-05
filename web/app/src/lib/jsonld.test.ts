import { describe, expect, it } from 'vitest';
import { buildJobPosting, jsonLdString } from './jsonld';
import type { JobDetail } from './types';

const job: JobDetail = {
  id: 'id1', slug: 'senior-backend-acme-1a2b3c', title: 'Senior Backend Engineer',
  company: { id: 'c1', slug: 'acme', name: 'Acme sp. z o.o.', logoUrl: null, isVerified: true },
  category: 'backend', seniority: 'senior', workMode: 'remote', remoteScope: 'poland', city: 'Warszawa',
  salaries: [
    { contractType: 'b2b', min: 18000, max: 24000, currency: 'PLN', period: 'month', basis: 'net' },
    { contractType: 'uop', min: 15000, max: 20000, currency: 'PLN', period: 'month', basis: 'gross' },
  ],
  skills: ['c#'], isPromoted: false, publishedAt: '2026-10-01T08:00:00Z', expiresAt: '2026-10-31T08:00:00Z',
  description: '## Zadania\n\n- budowa API', applyUrl: 'https://acme.example/jobs/1',
};

describe('buildJobPosting', () => {
  const p = buildJobPosting(job, 'https://wip.example') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  it('is a Google JobPosting with the required fields', () => {
    expect(p['@type']).toBe('JobPosting');
    expect(p.title).toBe(job.title);
    expect(p.datePosted).toBe('2026-10-01');
    expect(p.validThrough).toBe('2026-10-31T08:00:00Z');
    expect(p.hiringOrganization.name).toBe('Acme sp. z o.o.');
    expect(p.description).toContain('<h2>Zadania</h2>');
    expect(p.directApply).toBe(true);
  });
  it('maps contract types to employmentType', () => {
    expect(p.employmentType).toEqual(['CONTRACTOR', 'FULL_TIME']);
  });
  it('selects baseSalary deterministically: highest PLN normalized max', () => {
    // Job has B2B (18-24k/mo net) and UoP (15-20k/mo gross); B2B max is higher in PLN/mo
    expect(p.baseSalary).toEqual({
      '@type': 'MonetaryAmount', currency: 'PLN',
      value: { '@type': 'QuantitativeValue', minValue: 18000, maxValue: 24000, unitText: 'MONTH' },
    });
  });
  it('marks remote Poland jobs as telecommute with PL country applicant requirement', () => {
    expect(p.jobLocationType).toBe('TELECOMMUTE');
    expect(p.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'PL' });
    expect(p.jobLocation.address).toMatchObject({ addressCountry: 'PL', addressLocality: 'Warszawa' });
  });
  it('uses EU applicant location for EU-scoped remote jobs', () => {
    const eu = buildJobPosting({ ...job, remoteScope: 'eu' }, 'https://wip.example') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(eu.applicantLocationRequirements).toEqual({ '@type': 'AdministrativeArea', name: 'European Union' });
  });
  it('omits applicant location for worldwide remote jobs', () => {
    const ww = buildJobPosting({ ...job, remoteScope: 'worldwide' }, 'https://wip.example') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ww.jobLocationType).toBe('TELECOMMUTE');
    expect(ww.applicantLocationRequirements).toBeUndefined();
  });
  it('omits telecommute for on-site jobs and uses HOUR/DAY units', () => {
    const q = buildJobPosting({ ...job, workMode: 'onsite', remoteScope: null, salaries: [{ ...job.salaries[0]!, period: 'hour' }] }, 'https://x') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(q.jobLocationType).toBeUndefined();
    expect(q.baseSalary.value.unitText).toBe('HOUR');
  });
  it('falls back to first offer when no PLN salaries exist', () => {
    const eur = buildJobPosting({ ...job, salaries: [{ contractType: 'b2b', min: 5000, max: 7000, currency: 'EUR', period: 'month', basis: 'net' }] }, 'https://x') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(eur.baseSalary.currency).toBe('EUR');
  });
});

describe('jsonLdString', () => {
  it('cannot break out of a script element', () => {
    const s = jsonLdString({ a: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(JSON.parse(s).a).toBe('</script><script>alert(1)</script>');
  });
});
