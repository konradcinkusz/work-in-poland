import { Suspense } from 'react';
import Link from 'next/link';
import AdminStats from '@/components/admin/AdminStats';

export const metadata = { title: 'Panel administratora — Podsumowanie' };

export default function AdminPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Panel administratora</h1>
      <nav style={{ marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
        <Link href="/admin/oferty" style={{ marginRight: '2rem', textDecoration: 'none', color: '#0066cc' }}>
          Oferty
        </Link>
        <Link href="/admin/firmy" style={{ marginRight: '2rem', textDecoration: 'none', color: '#0066cc' }}>
          Firmy
        </Link>
      </nav>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Podsumowanie</h2>
        <Suspense fallback={<p>Ładowanie...</p>}>
          <AdminStats />
        </Suspense>
      </section>
    </main>
  );
}
