import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { locationLabel, SalaryList, VerifiedBadge } from '@/components/job-card';
import { Markdown } from '@/components/markdown';
import { ReportJobButton } from '@/components/report-job-button';
import { SaveJobButton } from '@/components/save-job-button';
import { getJob } from '@/lib/api';
import { publicSiteUrl } from '@/lib/env';
import { buildJobPosting, jsonLdString } from '@/lib/jsonld';
import { formatSalary, relativeDate } from '@/lib/salary';
import { CATEGORY_LABELS, CONTRACT_LONG_LABELS, SENIORITY_LABELS } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug).catch(() => null);
  if (!job) return { title: 'Oferta niedostępna', robots: { index: false } };
  const salary = job.salaries[0] ? ` — ${formatSalary(job.salaries[0])}` : '';
  return {
    title: `${job.title} — ${job.company.name}`,
    description: `${job.title} w ${job.company.name}${salary}. ${locationLabel(job)}.`.slice(0, 200),
    alternates: { canonical: `/oferty/${job.slug}` },
  };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await getJob(slug); // a backend outage reaches the error boundary; only a real 404 is notFound()
  if (!job) notFound();

  const jsonLd = jsonLdString(buildJobPosting(job, publicSiteUrl()));

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div>
        <p className="text-sm"><Link href="/">← Wszystkie oferty</Link></p>
        <h1 className="mt-2">{job.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-800">
          <Link href={`/firmy/${job.company.slug}`} className="font-medium">{job.company.name}</Link>
          {job.company.isVerified && <VerifiedBadge />}
          {job.isPromoted && <span className="badge bg-amber-100 text-amber-950">Promowane</span>}
        </p>
        <p className="mt-2 text-slate-700">
          {locationLabel(job)} · {SENIORITY_LABELS[job.seniority]} · {CATEGORY_LABELS[job.category]}
          {job.publishedAt && <> · opublikowano {relativeDate(job.publishedAt)}</>}
        </p>
        {job.skills.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Umiejętności">
            {job.skills.map((s) => <li key={s} className="badge">{s}</li>)}
          </ul>
        )}
        <section className="mt-8" aria-labelledby="desc"><h2 id="desc" className="mb-3">Opis oferty</h2><Markdown source={job.description} /></section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Wynagrodzenie i aplikowanie">
        <section className="card" aria-labelledby="pay">
          <h2 id="pay" className="mb-3 text-base">Wynagrodzenie</h2>
          <ul className="space-y-3">
            {job.salaries.map((s) => (
              <li key={s.contractType}>
                <p className="text-sm text-slate-700">{CONTRACT_LONG_LABELS[s.contractType]}</p>
                <p className="font-semibold">{formatSalary(s)}</p>
              </li>
            ))}
          </ul>
          {job.salaries.length === 0 && <SalaryList salaries={[]} />}
        </section>
        <section className="card space-y-3" aria-labelledby="apply">
          <h2 id="apply" className="text-base">Aplikuj</h2>
          <a href={`/oferty/${job.slug}/aplikuj`} rel="noopener nofollow" target="_blank" className="btn btn-primary w-full">
            Aplikuj u pracodawcy
          </a>
          <p className="text-sm text-slate-600">Otworzymy stronę pracodawcy. Nie przechowujemy CV i nic nie wysyłamy w Twoim imieniu.</p>
          <SaveJobButton jobId={job.id} slug={job.slug} />
        </section>
        <div className="text-center">
          <ReportJobButton slug={job.slug} />
        </div>
      </aside>
    </article>
  );
}
