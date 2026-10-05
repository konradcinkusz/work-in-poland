'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authApi } from '@/lib/client-api';
import { loginUrl, safeRedirect } from '@/lib/redirect';
import { Alert, AuthCard, messageFor } from './auth-ui';
import { useSession } from './session';

/** Forced re-acceptance when the session says `requiresConsent` (versioned consent, IDENTITY-AND-ACCOUNTS §9). */
export function ConsentGate({ terms, privacy }: { terms: string; privacy: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'), '/');
  const { refresh, signOut } = useSession();
  const [t, setT] = useState(false);
  const [p, setP] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!t || !p) {
      setError('Aby korzystać z serwisu, zaakceptuj oba dokumenty.');
      return;
    }
    setBusy(true);
    const res = await authApi('accept-consent', { acceptedTerms: true, acceptedPrivacy: true });
    if (res.data.status === 'ok') {
      await refresh();
      router.replace(redirect);
      router.refresh();
      return;
    }
    setBusy(false);
    if (res.data.status === 'signed_out') router.replace(loginUrl('/zgody'));
    else setError(typeof res.data.error === 'string' ? res.data.error : messageFor(res.data));
  };

  return (
    <AuthCard title="Zaktualizowane dokumenty">
      <p className="text-sm text-slate-700">Zmieniły się nasze dokumenty. Aby dalej korzystać z konta, zapoznaj się z nimi i zaakceptuj je.</p>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={t} onChange={(e) => setT(e.target.checked)} className="mt-1 size-4" />
          <span>Akceptuję <Link href="/regulamin" target="_blank">regulamin</Link> (wersja {terms}).</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={p} onChange={(e) => setP(e.target.checked)} className="mt-1 size-4" />
          <span>Zapoznałem(-am) się z <Link href="/polityka-prywatnosci" target="_blank">polityką prywatności</Link> (wersja {privacy}).</span>
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">Akceptuję i kontynuuję</button>
      </form>
      <button type="button" className="btn btn-secondary w-full" onClick={async () => { await signOut(); router.replace('/'); router.refresh(); }}>
        Nie akceptuję — wyloguj
      </button>
    </AuthCard>
  );
}
