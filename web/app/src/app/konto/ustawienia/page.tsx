import type { Metadata } from 'next';
import { AccountSettings } from '@/components/account-settings';

export const metadata: Metadata = {
  title: 'Ustawienia konta — Work in Poland',
  description: 'Zarządzaj bezpieczeństwem i ustawieniami swojego konta.',
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1>Ustawienia konta</h1>
        <p className="mt-2 max-w-2xl text-slate-700">Zarządzaj bezpieczeństwem i ustawieniami swojego konta.</p>
      </header>
      <AccountSettings />
    </div>
  );
}
