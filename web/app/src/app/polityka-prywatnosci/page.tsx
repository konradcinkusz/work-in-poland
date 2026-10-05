import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';
import { loadLegalContent } from '@/lib/legal-content';

export const metadata: Metadata = { title: 'Polityka prywatności', description: 'Jakie dane przetwarza Work in Poland.' };

export default function PrivacyPage() {
  const markdown = loadLegalContent('privacy');
  return (
    <LegalPage title="Polityka prywatności" version={legalVersions().privacy} markdown={markdown} />
  );
}
