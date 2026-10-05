'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authApi } from '@/lib/client-api';
import { Alert, AuthCard, messageFor } from './auth-ui';

/** Target of the link in authservice's e-mail: `/verify-email?token=...&email=...`. */
export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [state, setState] = useState<'working' | 'ok' | 'invalid' | 'error'>(token && email ? 'working' : 'invalid');
  const [message, setMessage] = useState('');
  const [resent, setResent] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || !email || started.current) return;
    started.current = true; // the token is single-use: never submit twice (React strict mode re-runs effects)
    authApi('verify', { email, token }).then((res) => {
      if (res.data.status === 'ok') setState('ok');
      else if (res.data.status === 'invalid') setState('invalid');
      else {
        setState('error');
        setMessage(messageFor(res.data));
      }
    });
  }, [token, email]);

  return (
    <AuthCard title="Potwierdzenie adresu e-mail">
      {state === 'working' && <p role="status">Potwierdzamy adres…</p>}
      {state === 'ok' && (
        <>
          <Alert kind="success">Adres e-mail został potwierdzony. Możesz się zalogować.</Alert>
          <Link href="/logowanie" className="btn btn-primary w-full">Zaloguj się</Link>
        </>
      )}
      {state === 'invalid' && (
        <>
          <Alert kind="error">Link jest nieprawidłowy lub wygasł.</Alert>
          {email && !resent && (
            <button type="button" className="btn btn-secondary w-full" onClick={async () => { await authApi('resend', { email }); setResent(true); }}>
              Wyślij nowy link
            </button>
          )}
          {resent && <Alert kind="success">Jeśli ten adres wymaga potwierdzenia, wysłaliśmy nowy link.</Alert>}
        </>
      )}
      {state === 'error' && <Alert kind="error">{message}</Alert>}
    </AuthCard>
  );
}
