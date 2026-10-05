'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { loginUrl } from '@/lib/redirect';
import { formatSalary } from '@/lib/salary';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus, type TrackedJob } from '@/lib/types';
import { Alert } from './auth-ui';

export function Tracker() {
  const router = useRouter();
  const [items, setItems] = useState<TrackedJob[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api<{ items: TrackedJob[] }>('/tracker');
    if (res.status === 401) {
      router.push(loginUrl('/konto'));
      return;
    }
    if (res.ok && res.data) {
      setItems(res.data.items);
      setError('');
    } else {
      setError('Nie udało się pobrać zapisanych ofert.');
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async (t: TrackedJob, patch: { status?: ApplicationStatus; notes?: string }) => {
    const res = await api<TrackedJob>(`/tracker/${t.job.id}`, { method: 'PUT', body: { status: patch.status ?? t.status, notes: patch.notes ?? t.notes } });
    if (!res.ok || !res.data) {
      setError(res.problem?.errors?.notes?.[0] ?? 'Nie udało się zapisać zmian.');
      return false;
    }
    const updated = res.data;
    setItems((cur) => (cur ?? []).map((x) => (x.job.id === updated.job.id ? updated : x)));
    setError('');
    return true;
  };

  const remove = async (t: TrackedJob) => {
    const res = await api(`/tracker/${t.job.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Nie udało się usunąć oferty z trackera.');
      return;
    }
    setItems((cur) => (cur ?? []).filter((x) => x.job.id !== t.job.id));
  };

  if (items === null && !error) return <p role="status">Wczytywanie…</p>;

  return (
    <div className="space-y-8">
      {error && <Alert kind="error">{error}</Alert>}
      {items && items.length === 0 && (
        <div className="card text-center">
          <p className="font-medium">Nie masz jeszcze zapisanych ofert.</p>
          <p className="mt-1 text-sm text-slate-700">Na stronie oferty kliknij „Zapisz w trackerze”.</p>
          <Link href="/" className="btn btn-primary mt-4">Przeglądaj oferty</Link>
        </div>
      )}
      {items && APPLICATION_STATUSES.map((status) => {
        const group = items.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`col-${status}`}>
            <h2 id={`col-${status}`} className="mb-3">{APPLICATION_STATUS_LABELS[status]} <span className="text-base font-normal text-slate-600">({group.length})</span></h2>
            <ul className="space-y-3">
              {group.map((t) => <TrackedCard key={t.job.id} tracked={t} onSave={save} onRemove={remove} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TrackedCard({ tracked, onSave, onRemove }: {
  tracked: TrackedJob;
  onSave: (t: TrackedJob, patch: { status?: ApplicationStatus; notes?: string }) => Promise<boolean>;
  onRemove: (t: TrackedJob) => Promise<void>;
}) {
  const { job } = tracked;
  const [notes, setNotes] = useState(tracked.notes);
  const [saved, setSaved] = useState(false);
  const dirty = notes !== tracked.notes;
  const idBase = `t-${job.id}`;

  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold"><Link href={`/oferty/${job.slug}`} className="text-slate-900 hover:underline">{job.title}</Link></h3>
          <p className="text-sm text-slate-700">{job.company.name}</p>
          {job.salaries[0] && <p className="text-sm font-medium">{formatSalary(job.salaries[0])}</p>}
        </div>
        <div>
          <label htmlFor={`${idBase}-status`} className="label">Status: {job.title}</label>
          <select
            id={`${idBase}-status`}
            className="input"
            value={tracked.status}
            onChange={(e) => void onSave(tracked, { status: e.target.value as ApplicationStatus })}
          >
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${idBase}-notes`} className="label">Notatki: {job.title}</label>
        <textarea id={`${idBase}-notes`} className="input min-h-24" maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
        <p className="hint">{notes.length}/2000 · Notatki są Twoje — nie trafiają do pracodawcy.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={async () => setSaved(await onSave(tracked, { notes }))}>
          Zapisz notatkę
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void onRemove(tracked)}>Usuń z trackera</button>
        <span role="status" className="text-sm text-green-800">{saved && !dirty ? 'Notatka zapisana.' : ''}</span>
      </div>
    </li>
  );
}
