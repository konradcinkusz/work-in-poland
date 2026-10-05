'use client';

import { useEffect, useState } from 'react';
import { PasswordSection } from './account-settings/password-section';
import { TwoFactorSection } from './account-settings/two-factor-section';
import { ProfileSection } from './account-settings/profile-section';

interface UserInfo {
  hasPassword: boolean;
  userName?: string;
  email: string;
  twoFactorEnabled: boolean;
}

export function AccountSettings() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) throw new Error('Nie udało się załadować danych użytkownika');
        const data = await res.json();
        setUser({
          hasPassword: data.hasPassword ?? false,
          userName: data.userName,
          email: data.email,
          twoFactorEnabled: data.twoFactorEnabled ?? false,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Błąd podczas ładowania danych');
      } finally {
        setLoading(false);
      }
    }

    loadUserInfo();
  }, []);

  if (loading) {
    return <div className="text-center text-slate-600">Ładowanie ustawień...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!user) {
    return <div className="alert alert-error">Nie udało się załadować danych użytkownika</div>;
  }

  return (
    <div className="space-y-8">
      {user.hasPassword && <PasswordSection />}

      {!user.hasPassword && (
        <div className="alert alert-info">
          <p>
            <strong>Konto tylko z logowaniem społecznym:</strong> Twoje konto zostało utworzone poprzez logowanie społeczne
            (Google, GitHub itp.) i nie posiada tradycyjnego hasła. Aby ustawić hasło, możesz użyć funkcji resetowania hasła.
          </p>
        </div>
      )}

      <TwoFactorSection enabled={user.twoFactorEnabled} />

      <ProfileSection userName={user.userName} />

      <nav className="border-t pt-6">
        <a href="/konto" className="text-blue-600 hover:underline">
          ← Wróć do Moich danych
        </a>
      </nav>
    </div>
  );
}
