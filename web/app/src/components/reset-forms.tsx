'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authApi } from '@/lib/client-api';
import { Alert, AuthCard, messageFor } from './auth-ui';
import { passwordStrength } from './register-form';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await authApi('forgot', { email });
    setBusy(false);
    if (res.data.status === 'ok') setSent(true);
    else setError(messageFor(res.data));
  };

  return (
    <AuthCard title="Reset hasła">
      {sent ? (
        <Alert kind="success">Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-700">Podaj adres e-mail konta. Wyślemy link do ustawienia nowego hasła.</p>
          <div>
            <label htmlFor="email" className="label">Adres e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">Wyślij link</button>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/logowanie">Wróć do logowania</Link></p>
    </AuthCard>
  );
}

/** Target of the link in authservice's e-mail: `/reset-password?token=...&email=...`. */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const res = await authApi('reset', { email, token, newPassword: password });
    setBusy(false);
    if (res.data.status === 'ok') setDone(true);
    else if (res.data.status === 'invalid') {
      const list = Array.isArray(res.data.errors) ? res.data.errors.filter((x): x is string => typeof x === 'string') : [];
      setErrors(list.length ? list : ['Link jest nieprawidłowy lub wygasł.']);
    } else setErrors([messageFor(res.data)]);
  };

  if (!token || !email) {
    return (
      <AuthCard title="Nowe hasło">
        <Alert kind="error">Link jest niekompletny. <Link href="/reset-hasla">Poproś o nowy.</Link></Alert>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Nowe hasło">
      {done ? (
        <>
          <Alert kind="success">Hasło zostało zmienione. Możesz się zalogować.</Alert>
          <Link href="/logowanie" className="btn btn-primary w-full">Zaloguj się</Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-700">Konto: <strong>{email}</strong></p>
          <div>
            <label htmlFor="new-password" className="label">Nowe hasło</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-describedby="pw-hint" />
            <p id="pw-hint" className="hint" aria-live="polite">{strength.label || 'Minimum 8 znaków.'}</p>
          </div>
          {errors.length > 0 && <Alert kind="error"><ul className="list-disc pl-4">{errors.map((er) => <li key={er}>{er}</li>)}</ul></Alert>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">Ustaw hasło</button>
        </form>
      )}
    </AuthCard>
  );
}
