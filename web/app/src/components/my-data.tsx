'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { api, authApi } from '@/lib/client-api';
import { deleteMyDataAndAccount } from '@/lib/delete-account';
import { Alert } from './auth-ui';
import { useSession } from './session';

const CONFIRM_WORD = 'USUŃ';

/** "Moje dane": RODO access/portability (export) and erasure (data first, then the account). */
export function MyData() {
  const router = useRouter();
  const { session, refresh } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null);
  const needsPassword = session.status === 'authenticated' ? session.hasPassword : true;

  const open = () => {
    setTyped('');
    setPassword('');
    setMessage(null);
    dialog.current?.showModal();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (typed !== CONFIRM_WORD) return;
    setBusy(true);
    setMessage(null);
    const outcome = await deleteMyDataAndAccount(needsPassword ? password : undefined, {
      deleteServiceData: async () => (await api('/me/data', { method: 'DELETE', body: { confirm: 'delete-my-data' } })).status,
      deleteAccount: async (pw) => {
        const r = await authApi('delete-account', { password: pw });
        return { status: r.status, code: String(r.data.status ?? '') };
      },
    });
    setBusy(false);
    switch (outcome) {
      case 'done':
        dialog.current?.close();
        await refresh();
        router.push('/?konto=usuniete');
        router.refresh();
        return;
      case 'invalid_password':
        setMessage({ kind: 'error', text: 'Nieprawidłowe hasło. Dane w serwisie zostały już usunięte — podaj poprawne hasło, aby usunąć konto.' });
        return;
      case 'data_deleted_account_kept':
        setMessage({ kind: 'warn', text: 'Dane w serwisie usunięte, konto nie — spróbuj ponownie.' });
        return;
      case 'signed_out':
        router.push('/logowanie?redirect=%2Fkonto');
        return;
      default:
        setMessage({ kind: 'error', text: 'Nie udało się usunąć danych w serwisie. Nic nie zostało usunięte — spróbuj ponownie.' });
    }
  };

  return (
    <section aria-labelledby="my-data" className="card space-y-4">
      <h2 id="my-data">Moje dane</h2>
      <p className="text-sm text-slate-700">Masz prawo wglądu w swoje dane i ich usunięcia.</p>
      <div className="flex flex-wrap gap-3">
        {/* Plain link: the proxy injects the token server-side; the browser just downloads the file. */}
        <a href="/api/proxy/me/export" download="work-in-poland-export.json" className="btn btn-secondary">Pobierz moje dane</a>
        <button type="button" className="btn btn-danger" onClick={open}>Usuń moje dane i konto</button>
      </div>

      <dialog ref={dialog} aria-labelledby="del-title" className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg p-6 backdrop:bg-slate-900/50">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <h3 id="del-title" className="text-xl font-semibold">Usunąć dane i konto?</h3>
          <p className="text-sm text-slate-700">
            Usuniemy Twój tracker, firmy i oferty (opublikowane oferty znikną od razu), a następnie konto. Tej operacji nie można cofnąć.
          </p>
          <div>
            <label htmlFor="del-confirm" className="label">Aby potwierdzić, wpisz {CONFIRM_WORD}</label>
            <input id="del-confirm" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          {needsPassword && (
            <div>
              <label htmlFor="del-password" className="label">Hasło</label>
              <input id="del-password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {message && <Alert kind={message.kind}>{message.text}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-danger" disabled={busy || typed !== CONFIRM_WORD || (needsPassword && !password)}>Usuń na stałe</button>
            <button type="button" className="btn btn-secondary" onClick={() => dialog.current?.close()}>Anuluj</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
