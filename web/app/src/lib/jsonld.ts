import { renderMarkdown } from './markdown';
import { toMonthly } from './salary';
import type { ContractType, JobDetail, SalaryOffer } from './types';

const EMPLOYMENT_TYPE: Record<ContractType, string> = {
  uop: 'FULL_TIME',
  b2b: 'CONTRACTOR',
  zlecenie: 'CONTRACTOR',
  dzielo: 'CONTRACTOR',
};

const UNIT_TEXT: Record<SalaryOffer['period'], string> = { month: 'MONTH', hour: 'HOUR', day: 'DAY' };

function monetary(s: SalaryOffer) {
  return {
    '@type': 'MonetaryAmount',
    currency: s.currency,
    value: { '@type': 'QuantitativeValue', minValue: s.min, maxValue: s.max, unitText: UNIT_TEXT[s.period] },
  };
}

/**
 * Select the salary offer for JSON-LD baseSalary. Google accepts one; we choose deterministically:
 * highest max salary normalized to PLN monthly. If no PLN offers exist, fall back to the first offer.
 */
function selectBaseSalaryOffer(salaries: SalaryOffer[]): SalaryOffer | undefined {
  if (!salaries.length) return undefined;
  const pln = salaries.filter((s) => s.currency === 'PLN');
  if (!pln.length) return salaries[0];
  return pln.reduce((best, current) => {
    const bestMax = toMonthly(best.max, best.period);
    const currentMax = toMonthly(current.max, current.period);
    return currentMax > bestMax ? current : best;
  });
}

/**
 * Google for Jobs `JobPosting`. Google accepts one `baseSalary`; we select deterministically
 * (the PLN offer with the highest normalized monthly max; if none, the first offer).
 * Remote jobs carry `jobLocationType: TELECOMMUTE` plus `applicantLocationRequirements`
 * (countries/area for Poland/EU; worldwide remote has none to declare).
 */
export function buildJobPosting(job: JobDetail, siteUrl: string): Record<string, unknown> {
  const employmentType = [...new Set(job.salaries.map((s) => EMPLOYMENT_TYPE[s.contractType]))];
  const address: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: 'PL' };
  if (job.city) address.addressLocality = job.city;

  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: renderMarkdown(job.description),
    datePosted: (job.publishedAt ?? new Date().toISOString()).slice(0, 10),
    directApply: true,
    url: `${siteUrl}/oferty/${job.slug}`,
    identifier: { '@type': 'PropertyValue', name: job.company.name, value: job.id },
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company.name,
      sameAs: `${siteUrl}/firmy/${job.company.slug}`,
      ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
    },
    jobLocation: { '@type': 'Place', address },
  };
  if (job.expiresAt) posting.validThrough = job.expiresAt;
  if (employmentType.length > 0) posting.employmentType = employmentType.length === 1 ? employmentType[0] : employmentType;
  const selected = selectBaseSalaryOffer(job.salaries);
  if (selected) posting.baseSalary = monetary(selected);

  if (job.workMode === 'remote') {
    posting.jobLocationType = 'TELECOMMUTE';
    if (job.remoteScope === 'poland') {
      posting.applicantLocationRequirements = { '@type': 'Country', name: 'PL' };
    } else if (job.remoteScope === 'eu') {
      posting.applicantLocationRequirements = { '@type': 'AdministrativeArea', name: 'European Union' };
    }
    // worldwide remote: no applicantLocationRequirements
  }
  return posting;
}

/** Serialises JSON for an inline `<script type="application/ld+json">` without allowing `</script>` breakouts. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
