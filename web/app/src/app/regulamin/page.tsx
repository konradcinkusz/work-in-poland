import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';
import { loadLegalContent } from '@/lib/legal-content';

export const metadata: Metadata = { title: 'Regulamin', description: 'Regulamin serwisu Work in Poland.' };

export default function TermsPage() {
  const markdown = loadLegalContent('terms');
  return (
    <LegalPage title=”Regulamin” version={legalVersions().terms} markdown={markdown} />
  );
}
