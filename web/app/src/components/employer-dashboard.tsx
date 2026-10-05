'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, fieldErrors } from '@/lib/client-api';
import { isValidNip } from '@/lib/nip';
import { loginUrl } from '@/lib/redirect';
import { JOB_STATUS_LABELS, type CompanyDetail, type EmployerJob, type Page } from '@/lib/types';
import { Alert } from './auth-ui';

export function EmployerDashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyDetail[] | null>(null);
  const [jobs, setJobs] = useState<EmployerJob[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<CompanyDetail | 'new' | null>(null);

  const load = useCallback(async () => {
    const [c, j] = await Promise.all([api<CompanyDetail[]>('/employer/companies'), api<Page<EmployerJob>>('/employer/jobs?limit=100')]);
    if (c.status === 401 || j.status === 401) {
      router.push(loginUrl('/pracodawca'));
      return;
    }
    if (c.ok && j.ok && c.data && j.data) {
      setCompanies(c.data);
      setJobs(j.data.items);
      setError('');
    } else setError('Nie udało się pobrać danych pracodawcy.');
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const act = async (job: EmployerJob, action: 'publish' | 'close' | 'renew' | 'delete') => {
    const res = action === 'delete'
      ? await api(`/employer/jobs/${job.id}`, { method: 'DELETE' })
      : await api(`/employer/jobs/${job.id}/${action}`, { method: 'POST' });
    if (!res.ok) {
      const errs = Object.values(res.problem?.errors ?? {}).flat();
      setError(errs[0] ?? res.problem?.detail ?? 'Operacja nie powiodła się.');
      return;
    }
    await load();
  };

  if (companies === null && !error) return <p role="status">Wczytywanie…</p>;

  return (
    <div className="space-y-10">
      {error && <Alert kind="error">{error}</Alert>}

      <section aria-labelledby="companies">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="companies">Firmy</h2>
          {editing === null && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing('new')}>Dodaj firmę</button>}
        </div>
        {editing !== null && (
          <CompanyForm
            company={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => { setEditing(null); await load(); }}
          />
        )}
        {companies && companies.length === 0 && editing === null && (
          <p className="card text-slate-700">Nie masz jeszcze firmy. Dodaj ją, aby publikować oferty.</p>
        )}
        <ul className="space-y-2">
          {companies?.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{c.name} {c.isVerified && <span className="badge bg-green-100 text-green-900">Zweryfikowana</span>}</p>
                <p className="text-sm text-slate-700">{c.city}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/firmy/${c.slug}`} className="btn btn-secondary btn-sm">Strona publiczna</Link>
                <button type="button" className="btn btn-secondary btn-sm" aria-label={`Edytuj firmę ${c.name}`} onClick={() => setEditing(c)}>Edytuj</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="jobs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="jobs">Oferty</h2>
          {companies && companies.length > 0 && <Link href="/pracodawca/oferty/nowa" className="btn btn-primary btn-sm">Nowa oferta</Link>}
        </div>
        {jobs && jobs.length === 0 && <p className="card text-slate-700">Nie masz jeszcze ofert.</p>}
        {jobs && jobs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Twoje oferty</caption>
              <thead>
                <tr className="border-b border-slate-300">
                  <th scope="col" className="py-2 pr-3">Oferta</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Wyświetlenia</th>
                  <th scope="col" className="py-2 pr-3">Kliknięcia „Aplikuj”</th>
                  <th scope="col" className="py-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-200 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {j.status === 'published' ? <Link href={`/oferty/${j.slug}`}>{j.title}</Link> : j.title}
                      <span className="block text-xs font-normal text-slate-600">{j.company.name}</span>
                    </th>
                    <td className="py-2 pr-3">{JOB_STATUS_LABELS[j.status]}</td>
                    <td className="py-2 pr-3">{j.views}</td>
                    <td className="py-2 pr-3">{j.applyClicks}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(j.status === 'draft' || j.status === 'published') && (
                          <Link href={`/pracodawca/oferty/${j.id}`} className="btn btn-secondary btn-sm" aria-label={`Edytuj ofertę ${j.title}`}>Edytuj</Link>
                        )}
                        {j.status === 'draft' && <button type="button" className="btn btn-primary btn-sm" aria-label={`Opublikuj ofertę ${j.title}`} onClick={() => void act(j, 'publish')}>Opublikuj</button>}
                        {j.status === 'published' && <button type="button" className="btn btn-secondary btn-sm" aria-label={`Zamknij ofertę ${j.title}`} onClick={() => void act(j, 'close')}>Zamknij</button>}
                        {j.status !== 'draft' && <button type="button" className="btn btn-secondary btn-sm" aria-label={`Odnów ofertę ${j.title}`} onClick={() => void act(j, 'renew')}>Odnów</button>}
                        {j.status === 'draft' && <button type="button" className="btn btn-danger btn-sm" aria-label={`Usuń szkic ${j.title}`} onClick={() => void act(j, 'delete')}>Usuń szkic</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CompanyForm({ company, onCancel, onSaved }: { company: CompanyDetail | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(company?.name ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [description, setDescription] = useState(company?.description ?? '');
  const [city, setCity] = useState(company?.city ?? '');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? '');
  const [nip, setNip] = useState(company?.nip ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (nip.trim() && !isValidNip(nip)) local.nip = 'Nieprawidłowy NIP (10 cyfr i poprawna suma kontrolna).';
    if (name.trim().length === 0) local.name = 'Podaj nazwę firmy.';
    setErrors(local);
    setGeneral('');
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const body = {
      name: name.trim(),
      website: website.trim() || null,
      description: description.trim() || null,
      city: city.trim() || null,
      logoUrl: logoUrl.trim() || null,
      nip: nip.replace(/[\s-]/g, '') || null,
    };
    const res = company
      ? await api<CompanyDetail>(`/employer/companies/${company.id}`, { method: 'PUT', body })
      : await api<CompanyDetail>('/employer/companies', { method: 'POST', body });
    setBusy(false);
    if (res.ok) {
      await onSaved();
      return;
    }
    const mapped = fieldErrors(res.problem);
    setErrors(Object.fromEntries(Object.entries(mapped).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v])));
    if (Object.keys(mapped).length === 0) setGeneral(res.problem?.detail ?? 'Nie udało się zapisać firmy.');
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, extra: { type?: string; hint?: string; multiline?: boolean } = {}) => (
    <div className={extra.multiline ? 'sm:col-span-2' : ''}>
      <label htmlFor={`c-${id}`} className="label">{label}</label>
      {extra.multiline ? (
        <textarea id={`c-${id}`} className="input min-h-24" value={value} onChange={(e) => set(e.target.value)} maxLength={2000} aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `c-${id}-err` : undefined} />
      ) : (
        <input id={`c-${id}`} type={extra.type ?? 'text'} className="input" value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `c-${id}-err` : undefined} />
      )}
      {extra.hint && <p className="hint">{extra.hint}</p>}
      {errors[id] && <p id={`c-${id}-err`} className="field-error">{errors[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="card mb-4 grid gap-4 sm:grid-cols-2" aria-label={company ? 'Edycja firmy' : 'Nowa firma'}>
      {field('name', 'Nazwa firmy', name, setName)}
      {field('city', 'Miasto', city, setCity)}
      {field('website', 'Strona www (https://…)', website, setWebsite, { type: 'url' })}
      {field('logoUrl', 'Adres logo (https://…, opcjonalnie)', logoUrl, setLogoUrl, { type: 'url' })}
      {field('nip', 'NIP (opcjonalnie)', nip, setNip, { hint: 'Zmiana nazwy lub NIP usuwa status zweryfikowanej firmy.' })}
      {field('description', 'Opis firmy (Markdown)', description, setDescription, { multiline: true })}
      {general && <div className="sm:col-span-2"><Alert kind="error">{general}</Alert></div>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{company ? 'Zapisz firmę' : 'Dodaj firmę'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
      </div>
    </form>
  );
}

