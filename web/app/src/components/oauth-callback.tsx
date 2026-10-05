'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authApi } from '@/lib/client-api';
import { safeRedirect } from '@/lib/redirect';
import { Alert, AuthCard, messageFor } from './auth-ui';
import { useSession } from './session';

/** Redeems the single-use `?code=` from social login; continues with the 2FA step when the account has it. */
export function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const code = params.get('code') ?? '';
  const [state, setState] = useState<'working' | 'twofactor' | 'failed'>(code ? 'working' : 'failed');
  const [message, setMessage] = useState('Brakuje kodu logowania.');
  const [redirect, setRedirect] = useState('/');
  const [otp, setOtp] = useState('');
  const [recovery, setRecovery] = useState(false);
  const started = useRef(false);

  const land = async (to: string) => {
    const s = await refresh();
    router.replace(s.status === 'authenticated' && s.requiresConsent ? `/zgody?redirect=${encodeURIComponent(to)}` : to);
    router.refresh();
  };

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true; // single-use code
    authApi('exchange', { code }).then((res) => {
      const to = safeRedirect(typeof res.data.redirect === 'string' ? res.data.redirect : null, '/');
      setRedirect(to);
      if (res.data.status === 'ok') void land(to);
      else if (res.data.status === 'two_factor') setState('twofactor');
      else {
        setState('failed');
        setMessage(res.data.status === 'invalid_code' ? 'Kod logowania jest nieprawidłowy lub wygasł. Spróbuj zalogować się ponownie.' : messageFor(res.data));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onOtp = async (e: FormEvent) => {
    e.preventDefault();
    const res = await authApi('2fa', recovery ? { recoveryCode: otp } : { code: otp });
    if (res.data.status === 'ok') await land(redirect);
    else if (res.data.status === 'invalid_code') setMessage('Nieprawidłowy kod.');
    else if (res.data.status === 'locked_out') setMessage('Konto jest tymczasowo zablokowane. Spróbuj za kilka minut.');
    else if (res.data.status === 'challenge_expired') { setState('failed'); setMessage('Weryfikacja wygasła. Zaloguj się ponownie.'); }
    else setMessage(messageFor(res.data));
  };

  return (
    <AuthCard title="Logowanie">
      {state === 'working' && <p role="status">Kończymy logowanie…</p>}
      {state === 'twofactor' && (
        <form onSubmit={onOtp} className="space-y-4" noValidate>
          <div>
            <label htmlFor="otp" className="label">{recovery ? 'Kod odzyskiwania' : 'Kod uwierzytelniający'}</label>
            <input id="otp" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} className="input" required />
          </div>
          {message && message !== 'Brakuje kodu logowania.' && <Alert kind="error">{message}</Alert>}
          <button type="submit" className="btn btn-primary w-full">Potwierdź</button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => { setRecovery(!recovery); setOtp(''); }}>
            {recovery ? 'Użyj kodu z aplikacji' : 'Użyj kodu odzyskiwania'}
          </button>
        </form>
      )}
      {state === 'failed' && (
        <>
          <Alert kind="error">{message}</Alert>
          <Link href="/logowanie" className="btn btn-primary w-full">Wróć do logowania</Link>
        </>
      )}
    </AuthCard>
  );
}
