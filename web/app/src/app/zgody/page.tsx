import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConsentGate } from '@/components/consent-gate';
import { legalVersions } from '@/lib/consent';

export const metadata: Metadata = { title: 'Zgody', description: 'Zaakceptuj zaktualizowane dokumenty, aby kontynuować.', robots: { index: false } };

export default function ConsentPage() {
  const v = legalVersions();
  return <Suspense><ConsentGate terms={v.terms} privacy={v.privacy} /></Suspense>;
}
