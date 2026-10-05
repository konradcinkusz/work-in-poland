'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { api } from '@/lib/client-api';
import { loginUrl } from '@/lib/redirect';
import {
  BASIS_LABELS, CATEGORIES, CATEGORY_LABELS, CONTRACT_LONG_LABELS, CONTRACT_TYPES, CURRENCIES, PERIOD_LABELS, REMOTE_SCOPES,
  REMOTE_SCOPE_LABELS, SALARY_BASES, SALARY_PERIODS, SENIORITIES, SENIORITY_LABELS, WORK_MODES, WORK_MODE_LABELS,
  type Category, type CompanyDetail, type ContractType, type EmployerJob, type JobInput, type Problem, type RemoteScope,
  type SalaryOffer, type Seniority, type WorkMode,
} from '@/lib/types';
import { Alert } from './auth-ui';
import { Markdown } from './markdown';

export const SALARY_RULE_TEXT =
  'Widełki wynagrodzenia są wymagane — Polska ustawa o jawności wynagrodzeń od 24.12.2025; to zasada serwisu, nie porada prawna.';

interface FormState {
  companyId: string;
  title: string;
  description: string;
  category: Category;
  seniority: Seniority;
  workMode: WorkMode;
  remoteScope: RemoteScope;
  city: string;
  salaries: SalaryOffer[];
  skills: string[];
  applyUrl: string;
}

const emptySalary = (contractType: ContractType): SalaryOffer => ({
  contractType, min: 0, max: 0, currency: 'PLN', period: 'month', basis: contractType === 'uop' ? 'gross' : 'net',
});

const initial: FormState = {
  companyId: '', title: '', description: '', category: 'backend', seniority: 'mid', workMode: 'remote', remoteScope: 'poland',
  city: '', salaries: [emptySalary('b2b')], skills: [], applyUrl: 'https://',
};

/** API field names arrive as `Title` / `title` / `Salaries[0].Min`; normalise to lower camel. */
export function normalizeErrors(problem: Problem | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(problem?.errors ?? {})) {
    const key = k.charAt(0).toLowerCase() + k.slice(1);
    out[key] = [...(out[key] ?? []), ...v];
  }
  return out;
}

export function JobForm({ jobId }: { jobId: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [companies, setCompanies] = useState<CompanyDetail[] | null>(null);
  const [status, setStatus] = useState<EmployerJob['status'] | null>(null);
  const [loading, setLoading] = useState(jobId !== null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [general, setGeneral] = useState('');
  const [busy, setBusy] = useState(false);
  const [skillDraft, setSkillDraft] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, j] = await Promise.all([
        api<CompanyDetail[]>('/employer/companies'),
        jobId ? api<EmployerJob>(`/employer/jobs/${jobId}`) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (c.status === 401 || j?.status === 401) {
        router.push(loginUrl(jobId ? `/pracodawca/oferty/${jobId}` : '/pracodawca/oferty/nowa'));
        return;
      }
      if (c.ok && c.data) {
        setCompanies(c.data);
        if (!jobId && c.data[0]) setForm((f) => ({ ...f, companyId: c.data![0]!.id }));
      } else setGeneral('Nie udało się pobrać firm.');
      if (j) {
        if (j.ok && j.data) {
          const d = j.data;
          setStatus(d.status);
          setForm({
            companyId: d.company.id, title: d.title, description: d.description, category: d.category, seniority: d.seniority,
            workMode: d.workMode, remoteScope: d.remoteScope ?? 'poland', city: d.city ?? '', salaries: d.salaries, skills: d.skills, applyUrl: d.applyUrl,
          });
        } else setGeneral('Nie znaleziono oferty.');
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [jobId, router]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: string) => errors[key]?.[0];
  const salaryErrors = Object.entries(errors).filter(([k]) => k.startsWith('salaries')).flatMap(([, v]) => v);

  const updateSalary = (i: number, patch: Partial<SalaryOffer>) =>
    set('salaries', form.salaries.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const usedContracts = new Set(form.salaries.map((s) => s.contractType));
  const nextContract = CONTRACT_TYPES.find((c) => !usedContracts.has(c));

  const addSkill = (raw: string) => {
    const s = raw.trim().toLowerCase().slice(0, 40);
    if (!s || form.skills.includes(s) || form.skills.length >= 15) return;
    set('skills', [...form.skills, s]);
    setSkillDraft('');
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillDraft);
    } else if (e.key === 'Backspace' && skillDraft === '' && form.skills.length > 0) {
      set('skills', form.skills.slice(0, -1));
    }
  };

  const toInput = (): JobInput => ({
    companyId: form.companyId,
    title: form.title.trim(),
    description: form.description,
    category: form.category,
    seniority: form.seniority,
    workMode: form.workMode,
    remoteScope: form.workMode === 'remote' ? form.remoteScope : null,
    city: form.city.trim() || null,
    salaries: form.salaries,
    skills: skillDraft.trim() ? [...new Set([...form.skills, skillDraft.trim().toLowerCase()])] : form.skills,
    applyUrl: form.applyUrl.trim(),
  });

  const submit = async (publish: boolean) => {
    setBusy(true);
    setErrors({});
    setGeneral('');
    const input = toInput();
    let res;
    if (jobId === null) {
      res = await api<EmployerJob>('/employer/jobs', { method: 'POST', body: { ...input, publish } });
    } else {
      res = await api<EmployerJob>(`/employer/jobs/${jobId}`, { method: 'PUT', body: input });
      if (res.ok && publish && status === 'draft') res = await api<EmployerJob>(`/employer/jobs/${jobId}/publish`, { method: 'POST' });
    }
    setBusy(false);
    if (res.ok) {
      router.push('/pracodawca');
      return;
    }
    if (res.status === 401) {
      router.push(loginUrl('/pracodawca'));
      return;
    }
    const mapped = normalizeErrors(res.problem);
    setErrors(mapped);
    if (Object.keys(mapped).length === 0) setGeneral(res.problem?.detail ?? res.problem?.title ?? 'Nie udało się zapisać oferty.');
    else setGeneral('Popraw zaznaczone pola i spróbuj ponownie.');
  };

  if (loading) return <p role="status">Wczytywanie…</p>;
  if (companies && companies.length === 0) {
    return <Alert kind="warn">Najpierw dodaj firmę w <Link href="/pracodawca">panelu pracodawcy</Link>.</Alert>;
  }

  const fieldProps = (key: string) => ({ 'aria-invalid': !!err(key), 'aria-describedby': err(key) ? `${key}-err` : undefined });
  const fieldErr = (key: string) => err(key) && <p id={`${key}-err`} className="field-error">{err(key)}</p>;
  const isDraftOrNew = jobId === null || status === 'draft';

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(isDraftOrNew ? true : false); }} noValidate className="space-y-8">
      <Alert kind="info">{SALARY_RULE_TEXT}</Alert>
      {general && <Alert kind="error">{general}</Alert>}

      <section className="card grid gap-4 sm:grid-cols-2" aria-labelledby="basics">
        <h2 id="basics" className="sm:col-span-2">Podstawowe informacje</h2>
        <div>
          <label htmlFor="companyId" className="label">Firma</label>
          <select id="companyId" className="input" value={form.companyId} onChange={(e) => set('companyId', e.target.value)} disabled={jobId !== null} {...fieldProps('companyId')}>
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {fieldErr('companyId')}
        </div>
        <div>
          <label htmlFor="title" className="label">Tytuł oferty</label>
          <input id="title" className="input" value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} {...fieldProps('title')} />
          <p className="hint">5–120 znaków.</p>
          {fieldErr('title')}
        </div>
        <div>
          <label htmlFor="category" className="label">Kategoria</label>
          <select id="category" className="input" value={form.category} onChange={(e) => set('category', e.target.value as Category)} {...fieldProps('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          {fieldErr('category')}
        </div>
        <div>
          <label htmlFor="seniority" className="label">Poziom</label>
          <select id="seniority" className="input" value={form.seniority} onChange={(e) => set('seniority', e.target.value as Seniority)} {...fieldProps('seniority')}>
            {SENIORITIES.map((c) => <option key={c} value={c}>{SENIORITY_LABELS[c]}</option>)}
          </select>
          {fieldErr('seniority')}
        </div>
        <div>
          <label htmlFor="workMode" className="label">Tryb pracy</label>
          <select id="workMode" className="input" value={form.workMode} onChange={(e) => set('workMode', e.target.value as WorkMode)} {...fieldProps('workMode')}>
            {WORK_MODES.map((c) => <option key={c} value={c}>{WORK_MODE_LABELS[c]}</option>)}
          </select>
          {fieldErr('workMode')}
        </div>
        {form.workMode === 'remote' ? (
          <div>
            <label htmlFor="remoteScope" className="label">Zakres pracy zdalnej</label>
            <select id="remoteScope" className="input" value={form.remoteScope} onChange={(e) => set('remoteScope', e.target.value as RemoteScope)} {...fieldProps('remoteScope')}>
              {REMOTE_SCOPES.map((c) => <option key={c} value={c}>{REMOTE_SCOPE_LABELS[c]}</option>)}
            </select>
            {fieldErr('remoteScope')}
          </div>
        ) : null}
        <div>
          <label htmlFor="city" className="label">Miasto{form.workMode === 'remote' ? ' (opcjonalnie)' : ''}</label>
          <input id="city" className="input" value={form.city} onChange={(e) => set('city', e.target.value)} {...fieldProps('city')} />
          {fieldErr('city')}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="applyUrl" className="label">Adres aplikowania (https://…)</label>
          <input id="applyUrl" type="url" className="input" value={form.applyUrl} onChange={(e) => set('applyUrl', e.target.value)} {...fieldProps('applyUrl')} />
          <p className="hint">Kandydaci zostaną przekierowani na ten adres. Nie zbieramy CV.</p>
          {fieldErr('applyUrl')}
        </div>
      </section>

      <fieldset className="card space-y-4" aria-describedby="salary-rule">
        <legend className="px-1 text-xl font-semibold">Widełki wynagrodzenia</legend>
        <p id="salary-rule" className="text-sm text-slate-700">{SALARY_RULE_TEXT} Jedna widełka na rodzaj umowy (maks. 4); netto przy B2B oznacza kwotę bez VAT.</p>
        {form.salaries.map((s, i) => (
          <div key={i} className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label={`Widełka ${i + 1}`}>
            <div className="lg:col-span-2">
              <label htmlFor={`sal-${i}-ct`} className="label">Rodzaj umowy</label>
              <select id={`sal-${i}-ct`} className="input" value={s.contractType}
                onChange={(e) => { const ct = e.target.value as ContractType; updateSalary(i, { contractType: ct, basis: ct === 'uop' ? 'gross' : 'net' }); }}>
                {CONTRACT_TYPES.filter((c) => c === s.contractType || !usedContracts.has(c)).map((c) => <option key={c} value={c}>{CONTRACT_LONG_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`sal-${i}-min`} className="label">Od</label>
              <input id={`sal-${i}-min`} type="number" min={0} step={100} className="input" value={s.min || ''} onChange={(e) => updateSalary(i, { min: Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={`sal-${i}-max`} className="label">Do</label>
              <input id={`sal-${i}-max`} type="number" min={0} step={100} className="input" value={s.max || ''} onChange={(e) => updateSalary(i, { max: Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={`sal-${i}-cur`} className="label">Waluta</label>
              <select id={`sal-${i}-cur`} className="input" value={s.currency} onChange={(e) => updateSalary(i, { currency: e.target.value as SalaryOffer['currency'] })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`sal-${i}-per`} className="label">Okres</label>
              <select id={`sal-${i}-per`} className="input" value={s.period} onChange={(e) => updateSalary(i, { period: e.target.value as SalaryOffer['period'] })}>
                {SALARY_PERIODS.map((c) => <option key={c} value={c}>{PERIOD_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`sal-${i}-basis`} className="label">Brutto / netto</label>
              <select id={`sal-${i}-basis`} className="input" value={s.basis} onChange={(e) => updateSalary(i, { basis: e.target.value as SalaryOffer['basis'] })}>
                {SALARY_BASES.map((c) => <option key={c} value={c}>{BASIS_LABELS[c]}</option>)}
              </select>
            </div>
            {form.salaries.length > 1 && (
              <div className="flex items-end">
                <button type="button" className="btn btn-danger btn-sm" aria-label={`Usuń widełkę ${i + 1}`} onClick={() => set('salaries', form.salaries.filter((_, idx) => idx !== i))}>Usuń</button>
              </div>
            )}
          </div>
        ))}
        {salaryErrors.length > 0 && (
          <div role="alert" id="salaries-err" className="field-error">
            <ul>{salaryErrors.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        {nextContract && form.salaries.length < 4 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('salaries', [...form.salaries, emptySalary(nextContract)])}>Dodaj widełkę dla innej umowy</button>
        )}
      </fieldset>

      <section className="card space-y-3" aria-labelledby="skills-h">
        <h2 id="skills-h">Umiejętności</h2>
        <div>
          <label htmlFor="skill-input" className="label">Dodaj umiejętność (Enter lub przecinek)</label>
          <input id="skill-input" className="input" value={skillDraft} maxLength={40} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={onSkillKey} onBlur={() => addSkill(skillDraft)} {...fieldProps('skills')} />
          <p className="hint">1–15 umiejętności; zapisujemy je małymi literami.</p>
          {fieldErr('skills')}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Wybrane umiejętności">
          {form.skills.map((s) => (
            <li key={s} className="badge gap-1">
              {s}
              <button type="button" aria-label={`Usuń umiejętność ${s}`} className="px-1 font-bold" onClick={() => set('skills', form.skills.filter((x) => x !== s))}>×</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card grid gap-4 lg:grid-cols-2" aria-labelledby="desc-h">
        <h2 id="desc-h" className="lg:col-span-2">Opis oferty</h2>
        <div>
          <label htmlFor="description" className="label">Opis (Markdown, 50–20 000 znaków)</label>
          <textarea id="description" className="input min-h-72 font-mono text-sm" value={form.description} maxLength={20000} onChange={(e) => set('description', e.target.value)} {...fieldProps('description')} />
          <p className="hint">{form.description.length}/20000 · HTML jest wyłączony.</p>
          {fieldErr('description')}
        </div>
        <div aria-live="polite">
          <p className="label">Podgląd</p>
          <div className="min-h-72 rounded-md border border-slate-300 bg-white p-3" data-testid="description-preview">
            {form.description.trim() ? <Markdown source={form.description} /> : <p className="text-sm text-slate-600">Podgląd pojawi się tutaj.</p>}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {isDraftOrNew ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void submit(false)}>Zapisz jako szkic</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Opublikuj</button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={busy}>Zapisz zmiany</button>
        )}
        <Link href="/pracodawca" className="btn btn-secondary">Anuluj</Link>
      </div>
    </form>
  );
}
