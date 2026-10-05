'use client';

import { FormEvent, useState } from 'react';

interface Props {
  userName?: string;
}

export function ProfileSection({ userName: initialUserName }: Props) {
  const [userName, setUserName] = useState(initialUserName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!userName.trim()) {
      setError('Podaj nazwę użytkownika');
      return;
    }

    if (userName.length > 50) {
      setError('Nazwa użytkownika nie może przekraczać 50 znaków');
      return;
    }

    if (!/^[a-zA-Z0-9_-]*$/.test(userName)) {
      setError('Nazwa użytkownika może zawierać tylko litery, cyfry, łączniki i podkreślniki');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/account/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Aktualizacja profilu nie powiodła się');
        return;
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-300 p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Profil</h2>
      <p className="mt-1 text-sm text-slate-600">Aktualizuj swoją nazwę użytkownika i inne dane profilu.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <div className="alert alert-error text-sm">{error}</div>}
        {success && <div className="alert alert-success text-sm">Profil zaktualizowany pomyślnie.</div>}

        <div>
          <label htmlFor="username" className="block text-sm font-medium">Nazwa użytkownika</label>
          <input
            id="username"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            disabled={loading}
            maxLength={50}
          />
          <p className="mt-1 text-xs text-slate-500">
            Tylko litery, cyfry, łączniki i podkreślniki. Max 50 znaków.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Aktualizacja...' : 'Aktualizuj profil'}
        </button>
      </form>
    </section>
  );
}
