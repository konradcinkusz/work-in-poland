'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authApi } from '@/lib/client-api';
import { safeRedirect } from '@/lib/redirect';
import { Alert, AuthCard, messageFor } from './auth-ui';
import { useSession } from './session';

type Provider = { provider: string; displayName: string };
type Problem = null | 'invalid' | 'locked' | 'unverified' | 'expired' | 'other';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const redirect = safeRedirect(params.get('redirect'), '/');

  const [step, setStep] = useState<'credentials' | 'twofactor'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [otherMessage, setOtherMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let alive = true;
    authApi('providers', undefined, 'GET').then((r) => {
      if (alive && Array.isArray(r.data.providers)) setProviders(r.data.providers as Provider[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const finish = async () => {
    const s = await refresh();
    if (s.status === 'authenticated' && s.requiresConsent) {
      router.push(`/zgody?redirect=${encodeURIComponent(redirect)}`);
    } else {
      router.push(redirect);
    }
    router.refresh();
  };

  const handle = async (res: { status: number; data: Record<string, unknown> }) => {
    const st = res.data.status;
    if (st === 'ok') return finish();
    if (st === 'two_factor') {
      setStep('twofactor');
      setProblem(null);
      return;
    }
    if (st === 'invalid_credentials' || st === 'invalid_code') setProblem('invalid');
    else if (st === 'locked_out') setProblem('locked');
    else if (st === 'email_not_verified') setProblem('unverified');
    else if (st === 'challenge_expired') {
      setStep('credentials');
      setProblem('expired');
    } else {
      setProblem('other');
      setOtherMessage(typeof res.data.error === 'string' ? res.data.error : messageFor(res.data));
    }
  };

  const onCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setResent(false);
    await handle(await authApi('login', { email, password }));
    setBusy(false);
  };

  const onSecondFactor = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    await handle(await authApi('2fa', useRecovery ? { recoveryCode: code } : { code }));
    setBusy(false);
  };

  const onResend = async () => {
    await authApi('resend', { email });
    setResent(true);
  };

  const showError = () => {
    switch (problem) {
      case 'invalid':
        return <Alert kind="error">{step === 'twofactor' ? 'Nieprawidłowy kod.' : 'Nieprawidłowy e-mail lub hasło.'}</Alert>;
      case 'locked':
        return <Alert kind="error">Konto jest tymczasowo zablokowane po zbyt wielu nieudanych próbach. Spróbuj ponownie za kilka minut albo <Link href="/reset-hasla">zresetuj hasło</Link>.</Alert>;
      case 'unverified':
        return (
          <Alert kind="warn">
            <p>Adres e-mail nie został jeszcze potwierdzony. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji.</p>
            <button type="button" onClick={onResend} className="btn btn-secondary btn-sm mt-2">Wyślij link ponownie</button>
          </Alert>
        );
      case 'expired':
        return <Alert kind="error">Weryfikacja wygasła. Zaloguj się ponownie.</Alert>;
      case 'other':
        return <Alert kind="error">{otherMessage}</Alert>;
      default:
        return null;
    }
  };

  return (
    <AuthCard title="Logowanie">
      {step === 'credentials' ? (
        <form onSubmit={onCredentials} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">Adres e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Hasło</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          {showError()}
          {resent && <Alert kind="success">Jeśli ten adres wymaga potwierdzenia, wysłaliśmy nowy link.</Alert>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
          <p className="text-center text-sm"><Link href="/reset-hasla">Nie pamiętam hasła</Link></p>
        </form>
      ) : (
        <form onSubmit={onSecondFactor} className="space-y-4" noValidate>
          <p className="text-sm text-slate-700">
            {useRecovery ? 'Wpisz jeden z kodów odzyskiwania.' : 'Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.'}
          </p>
          <div>
            <label htmlFor="code" className="label">{useRecovery ? 'Kod odzyskiwania' : 'Kod uwierzytelniający'}</label>
            <input id="code" inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="input" />
          </div>
          {showError()}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? 'Weryfikacja…' : 'Potwierdź'}</button>
          <button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(''); setProblem(null); }} className="btn btn-secondary w-full">
            {useRecovery ? 'Użyj kodu z aplikacji' : 'Użyj kodu odzyskiwania'}
          </button>
        </form>
      )}

      {providers.length > 0 && step === 'credentials' && (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-center text-sm text-slate-700">lub</p>
          {providers.map((p) => (
            // Plain navigation: the BFF redirects the browser to the identity provider.
            <a key={p.provider} href={`/api/auth/oauth/start?provider=${encodeURIComponent(p.provider)}&redirect=${encodeURIComponent(redirect)}`} className="btn btn-secondary w-full">
              Kontynuuj z {p.displayName}
            </a>
          ))}
        </div>
      )}
      <p className="text-center text-sm">Nie masz konta? <Link href="/rejestracja">Załóż konto</Link></p>
    </AuthCard>
  );
}
