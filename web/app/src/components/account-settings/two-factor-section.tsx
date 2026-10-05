'use client';

import { useState } from 'react';
import { TwoFactorSetup } from './two-factor-setup';
import { TwoFactorManage } from './two-factor-manage';

interface Props {
  enabled: boolean;
}

export function TwoFactorSection({ enabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);

  const handleSetupComplete = () => {
    setEnabled(true);
  };

  const handleDisabled = () => {
    setEnabled(false);
  };

  return (
    <section className="rounded-lg border border-slate-300 p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Weryfikacja dwuetapowa (2FA)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Dodaj warstwę bezpieczeństwa do swojego konta wymagając kodu przy logowaniu.
      </p>

      <div className="mt-6">
        {enabled ? (
          <TwoFactorManage onDisabled={handleDisabled} />
        ) : (
          <TwoFactorSetup onSetupComplete={handleSetupComplete} />
        )}
      </div>
    </section>
  );
}
