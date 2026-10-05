import { Suspense } from 'react';
import Link from 'next/link';
import JobsList from '@/components/admin/JobsList';

export const metadata = { title: 'Panel administratora — Oferty' };

export default function AdminJobsPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Link href="/admin" style={{ textDecoration: 'none', color: '#0066cc', marginBottom: '1rem', display: 'inline-block' }}>
        ← Wróć do panelu
      </Link>
      <h1>Zarządzanie ofertami</h1>

      <Suspense fallback={<p>Ładowanie...</p>}>
        <JobsList />
      </Suspense>
    </main>
  );
}
