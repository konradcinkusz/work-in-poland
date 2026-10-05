import { Suspense } from 'react';
import Link from 'next/link';
import CompaniesList from '@/components/admin/CompaniesList';

export const metadata = { title: 'Panel administratora — Firmy' };

export default function AdminCompaniesPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Link href="/admin" style={{ textDecoration: 'none', color: '#0066cc', marginBottom: '1rem', display: 'inline-block' }}>
        ← Wróć do panelu
      </Link>
      <h1>Zarządzanie firmami</h1>

      <Suspense fallback={<p>Ładowanie...</p>}>
        <CompaniesList />
      </Suspense>
    </main>
  );
}
