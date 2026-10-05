'use client';

import { FormEvent, useState } from 'react';

export function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Wszystkie pola są wymagane');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Nowe hasła się nie zgadzają');
      return;
    }

    if (newPassword.length < 8) {
      setError('Nowe hasło musi mieć co najmniej 8 znaków');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/account/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Zmiana hasła nie powiodła się');
        return;
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-300 p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Hasło</h2>
      <p className="mt-1 text-sm text-slate-600">Zmień swoje hasło, aby zachować bezpieczeństwo konta.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <div className="alert alert-error text-sm">{error}</div>}
        {success && (
          <div className="alert alert-success text-sm">Hasło zmienione pomyślnie. Wszystkie pozostałe sesje zostały wylogowane.</div>
        )}

        <div>
          <label className="block text-sm font-medium">Bieżące hasło</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Nowe hasło</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            disabled={loading}
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-slate-500">Minimum 8 znaków</p>
        </div>

        <div>
          <label className="block text-sm font-medium">Potwierdź nowe hasło</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Zmiana hasła...' : 'Zmień hasło'}
        </button>
      </form>
    </section>
  );
}
