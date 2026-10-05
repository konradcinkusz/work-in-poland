'use client';

import { useSession } from '@/components/session';
import { isAdmin } from '@/lib/admin';
import { useEffect, useState } from 'react';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || session.status === 'loading') {
    return <p>Ładowanie...</p>;
  }

  if (session.status === 'anonymous') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Brak autoryzacji</h1>
        <p>Musisz się zalogować.</p>
      </div>
    );
  }

  const roles = session.status === 'authenticated' ? session.roles : [];
  if (!isAdmin(roles)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>403 — Brak dostępu</h1>
        <p>Nie masz uprawnień do tego obszaru.</p>
      </div>
    );
  }

  return <>{children}</>;
}
