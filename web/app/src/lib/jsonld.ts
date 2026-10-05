import { renderMarkdown } from './markdown';
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
 * Google for Jobs `JobPosting`. Google accepts one `baseSalary`; the job's first offer is used
 * (the page shows all of them). Remote jobs carry `jobLocationType: TELECOMMUTE` plus
 * `applicantLocationRequirements`; a worldwide remote job has no applicant restriction to declare.
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
    directApply: false,
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
  const first = job.salaries[0];
  if (first) posting.baseSalary = monetary(first);

  if (job.workMode === 'remote') {
    posting.jobLocationType = 'TELECOMMUTE';
    if (job.remoteScope === 'poland') {
      posting.applicantLocationRequirements = { '@type': 'Country', name: 'PL' };
    } else if (job.remoteScope === 'eu') {
      posting.applicantLocationRequirements = { '@type': 'AdministrativeArea', name: 'European Union' };
    }
  }
  return posting;
}

/** Serialises JSON for an inline `<script type="application/ld+json">` without allowing `</script>` breakouts. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
