import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JobCard, VerifiedBadge } from '@/components/job-card';
import { Markdown } from '@/components/markdown';
import { getCompany } from '@/lib/api';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug).catch(() => null);
  if (!company) return { title: 'Firma niedostępna', robots: { index: false } };
  return {
    title: `${company.name} — oferty pracy`,
    description: `Otwarte oferty pracy w firmie ${company.name}${company.city ? ` (${company.city})` : ''}.`,
    alternates: { canonical: `/firmy/${company.slug}` },
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm"><Link href="/">← Wszystkie oferty</Link></p>
        <h1 className="mt-2 flex flex-wrap items-center gap-3">{company.name}{company.isVerified && <VerifiedBadge />}</h1>
        <p className="mt-2 text-slate-700">
          {company.city}
          {company.website && <>{company.city ? ' · ' : ''}<a href={company.website} rel="noopener nofollow ugc" target="_blank">{new URL(company.website).host}</a></>}
        </p>
      </header>
      {company.description && <section aria-labelledby="about"><h2 id="about" className="mb-3">O firmie</h2><Markdown source={company.description} /></section>}
      <section aria-labelledby="jobs">
        <h2 id="jobs" className="mb-4">Otwarte oferty ({company.openJobs.length})</h2>
        {company.openJobs.length === 0 ? (
          <p className="card text-slate-700">Ta firma nie ma teraz otwartych ofert.</p>
        ) : (
          <ul className="space-y-3">{company.openJobs.map((j) => <li key={j.id}><JobCard job={j} /></li>)}</ul>
        )}
      </section>
    </div>
  );
}
