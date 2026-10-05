'use client';

import { FormEvent, useState } from 'react';
import { RecoveryCodesDisplay } from './recovery-codes-display';

interface Props {
  onDisabled: () => void;
}

type State = 'idle' | 'regen' | 'disable';

export function TwoFactorManage({ onDisabled }: Props) {
  const [state, setState] = useState<State>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const handleRegenerateRecoveryCodes = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/account/2fa/recovery-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Nie udało się wygenerować nowych kodów');
        return;
      }

      setRecoveryCodes(data.recoveryCodes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !code) {
      setError('Podaj hasło i kod weryfikacyjny');
      return;
    }

    if (code.length < 6) {
      setError('Podaj 6-cyfrowy kod z aplikacji autentykacyjnej');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/account/2fa/disable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, code: code.replace(/\s/g, '') }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Nie udało się wyłączyć weryfikacji dwuetapowej');
        return;
      }

      setState('idle');
      setPassword('');
      setCode('');
      onDisabled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  if (recoveryCodes) {
    return (
      <RecoveryCodesDisplay
        codes={recoveryCodes}
        onSaved={() => {
          setRecoveryCodes(null);
          setState('idle');
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded bg-green-50 p-4">
        <span className="text-sm font-medium text-green-900">✓ Weryfikacja dwuetapowa jest włączona</span>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {state === 'idle' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setState('regen')}
            className="flex-1 rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
          >
            Wygeneruj nowe kody odzyskiwania
          </button>
          <button
            type="button"
            onClick={() => setState('disable')}
            className="flex-1 rounded bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200"
          >
            Wyłącz
          </button>
        </div>
      )}

      {state === 'regen' && (
        <form onSubmit={handleRegenerateRecoveryCodes} className="space-y-3">
          <p className="text-sm text-slate-600">
            Wygeneruj nowe kody odzyskiwania. Stare kody będą nieważne. Możesz użyć nowych kodów jako zapasowego sposobu
            logowania.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Generowanie...' : 'Potwierdzam'}
            </button>
            <button
              type="button"
              onClick={() => {
                setState('idle');
                setError(null);
              }}
              disabled={loading}
              className="flex-1 rounded bg-slate-200 px-4 py-2 hover:bg-slate-300 disabled:opacity-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {state === 'disable' && (
        <form onSubmit={handleDisable} className="space-y-3 rounded bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Aby wyłączyć weryfikację dwuetapową, podaj swoje hasło i bieżący kod z aplikacji autentykacyjnej.
          </p>

          <div>
            <label htmlFor="disable-password" className="block text-sm font-medium">Hasło</label>
            <input
              id="disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="disable-code" className="block text-sm font-medium">Kod weryfikacyjny</label>
            <input
              id="disable-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none"
              disabled={loading}
              required
              maxLength={6}
            />
            <p className="mt-1 text-xs text-slate-500">6-cyfrowy kod z aplikacji autentykacyjnej lub kod odzyskiwania</p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !password || code.length !== 6}
              className="flex-1 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Wyłączanie...' : 'Wyłącz 2FA'}
            </button>
            <button
              type="button"
              onClick={() => {
                setState('idle');
                setPassword('');
                setCode('');
                setError(null);
              }}
              disabled={loading}
              className="flex-1 rounded bg-slate-200 px-4 py-2 hover:bg-slate-300 disabled:opacity-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
