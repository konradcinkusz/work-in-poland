import Link from 'next/link';
import { formatSalary, relativeDate } from '@/lib/salary';
import { CATEGORY_LABELS, REMOTE_SCOPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS, type JobSummary } from '@/lib/types';

export function SalaryList({ salaries }: { salaries: JobSummary['salaries'] }) {
  if (salaries.length === 0) return <p className="text-sm text-slate-600">Brak widełek</p>;
  return (
    <ul className="space-y-0.5">
      {salaries.map((s) => (
        <li key={s.contractType} className="text-sm font-semibold text-slate-900">
          {formatSalary(s)}
        </li>
      ))}
    </ul>
  );
}

export function VerifiedBadge() {
  return <span className="badge bg-green-100 text-green-900">Zweryfikowana firma</span>;
}

export function locationLabel(job: Pick<JobSummary, 'workMode' | 'remoteScope' | 'city'>): string {
  if (job.workMode === 'remote') {
    const scope = job.remoteScope ? ` (${REMOTE_SCOPE_LABELS[job.remoteScope]})` : '';
    return `${WORK_MODE_LABELS.remote}${scope}${job.city ? `, ${job.city}` : ''}`;
  }
  return `${job.city ?? ''}${job.city ? ', ' : ''}${WORK_MODE_LABELS[job.workMode].toLowerCase()}`;
}

export function JobCard({ job, now }: { job: JobSummary; now?: Date }) {
  return (
    <article className="card" aria-labelledby={`job-${job.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`job-${job.id}`} className="text-lg">
            <Link href={`/oferty/${job.slug}`} className="text-slate-900 hover:underline">{job.title}</Link>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Link href={`/firmy/${job.company.slug}`} className="font-medium text-slate-800">{job.company.name}</Link>
            {job.company.isVerified && <VerifiedBadge />}
          </p>
        </div>
        {job.isPromoted && <span className="badge bg-amber-100 text-amber-950">Promowane</span>}
      </div>
      <div className="mt-3"><SalaryList salaries={job.salaries} /></div>
      <p className="mt-2 text-sm text-slate-700">
        {locationLabel(job)} · {SENIORITY_LABELS[job.seniority]} · {CATEGORY_LABELS[job.category]}
        {job.publishedAt && <> · <span>{relativeDate(job.publishedAt, now)}</span></>}
      </p>
      {job.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Umiejętności">
          {job.skills.slice(0, 8).map((s) => (
            <li key={s} className="badge">{s}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
