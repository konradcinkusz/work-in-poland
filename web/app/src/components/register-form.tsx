'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authApi } from '@/lib/client-api';
import { Alert, AuthCard, messageFor } from './auth-ui';
import { useSession } from './session';

/** Rough strength hint (length and variety). authservice and Identity are authoritative on the policy. */
export function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) return { level: 1, label: 'Za krótkie — minimum 8 znaków' };
  if (score <= 2) return { level: 1, label: 'Słabe — dodaj wielkie litery, cyfry i znak specjalny' };
  if (score === 3) return { level: 2, label: 'Średnie' };
  return { level: 3, label: 'Mocne' };
}

export function RegisterForm() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [versions, setVersions] = useState<{ terms: string; privacy: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // The versions shown here come from authservice; they are never hard-coded.
    authApi('consents', undefined, 'GET').then((r) => {
      if (alive && typeof r.data.terms === 'string' && typeof r.data.privacy === 'string') {
        setVersions({ terms: r.data.terms, privacy: r.data.privacy });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const strength = passwordStrength(password);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if (!terms || !privacy) {
      setErrors(['Zaakceptuj regulamin i politykę prywatności, aby założyć konto.']);
      return;
    }
    setBusy(true);
    const res = await authApi('register', { email, password, acceptTerms: terms, acceptPrivacy: privacy });
    setBusy(false);
    const st = res.data.status;
    if (st === 'ok') {
      await refresh();
      router.push('/');
      router.refresh();
    } else if (st === 'verification_required') {
      setVerifyEmail(email);
    } else if (st === 'invalid' && Array.isArray(res.data.errors) && res.data.errors.length > 0) {
      setErrors(res.data.errors.filter((x): x is string => typeof x === 'string'));
    } else {
      setErrors([typeof res.data.error === 'string' ? res.data.error : messageFor(res.data)]);
    }
  };

  if (verifyEmail) {
    return (
      <AuthCard title="Sprawdź skrzynkę">
        <Alert kind="success">Konto zostało utworzone. Wysłaliśmy link potwierdzający na adres <strong>{verifyEmail}</strong>. Kliknij go, aby się zalogować.</Alert>
        <Link href="/logowanie" className="btn btn-secondary w-full">Przejdź do logowania</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Załóż konto">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">Adres e-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Hasło</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-describedby="pw-hint" />
          <p id="pw-hint" className="hint" aria-live="polite">
            {strength.label || 'Minimum 8 znaków. Im dłuższe i bardziej zróżnicowane, tym lepsze.'}
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="sr-only">Zgody</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-4" />
            <span>Akceptuję <Link href="/regulamin" target="_blank">regulamin</Link>{versions && <> (wersja {versions.terms})</>}.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 size-4" />
            <span>Zapoznałem(-am) się z <Link href="/polityka-prywatnosci" target="_blank">polityką prywatności</Link>{versions && <> (wersja {versions.privacy})</>}.</span>
          </label>
        </fieldset>
        {errors.length > 0 && (
          <Alert kind="error">
            <ul className="list-disc pl-4">{errors.map((er) => <li key={er}>{er}</li>)}</ul>
          </Alert>
        )}
        <button type="submit" disabled={busy || !versions} className="btn btn-primary w-full">{busy ? 'Tworzenie konta…' : 'Załóż konto'}</button>
      </form>
      <p className="text-center text-sm">Masz już konto? <Link href="/logowanie">Zaloguj się</Link></p>
    </AuthCard>
  );
}
