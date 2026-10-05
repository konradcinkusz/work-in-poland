'use client';

import { FormEvent, useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { RecoveryCodesDisplay } from './recovery-codes-display';

interface Props {
  onSetupComplete: () => void;
}

interface SetupData {
  sharedKey?: string;
  authenticatorUri?: string;
}

export function TwoFactorSetup({ onSetupComplete }: Props) {
  const [step, setStep] = useState<'init' | 'confirm' | 'done'>('init');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    if (step !== 'init') return;

    let isMounted = true;

    const startSetup = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/account/2fa/enable', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });

        const data = await res.json();

        if (!isMounted) return;

        if (!res.ok) {
          setError(data.error ?? 'Nie udało się uruchomić weryfikacji dwuetapowej');
          return;
        }

        setSetupData(data);
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Błąd serwera');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    startSetup();

    return () => {
      isMounted = false;
    };
  }, [step]);

  useEffect(() => {
    if (setupData?.authenticatorUri) {
      QRCode.toDataURL(setupData.authenticatorUri).then(setQrCode).catch(console.error);
    }
  }, [setupData?.authenticatorUri]);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code || code.length < 6) {
      setError('Podaj 6-cyfrowy kod z aplikacji autentykacyjnej');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/account/2fa/verify-setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code.replace(/\s/g, '') }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Kod jest nieprawidłowy');
        setCode('');
        return;
      }

      setRecoveryCodes(data.recoveryCodes ?? []);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="space-y-4">
        <div className="alert alert-success">Weryfikacja dwuetapowa została włączona pomyślnie!</div>
        <RecoveryCodesDisplay codes={recoveryCodes} onSaved={onSetupComplete} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Aby włączyć weryfikację dwuetapową, skonfiguruj aplikację autentykacyjną (np. Google Authenticator, Authy) skanując
        poniższy kod QR.
      </p>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading && step === 'init' ? (
        <div className="text-center text-slate-600">Przygotowywanie kodu QR...</div>
      ) : qrCode ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            {qrCode && (
              <Image
                src={qrCode}
                alt="QR kod do aplikacji autentykacyjnej"
                width={192}
                height={192}
                className="border border-slate-300 p-2"
              />
            )}
          </div>

          {setupData?.sharedKey && (
            <div className="space-y-2 rounded bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">Klucz do wpisania ręcznie:</p>
              <p className="font-mono text-sm">{setupData.sharedKey}</p>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Wpisz kod z aplikacji autentykacyjnej</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none"
                disabled={loading}
                required
                maxLength={6}
              />
              <p className="mt-1 text-xs text-slate-500">6-cyfrowy kod</p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Weryfikacja...' : 'Potwierdź i włącz 2FA'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
