import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';
import { loadLegalContent } from '@/lib/legal-content';

export const metadata: Metadata = { title: 'Pliki cookies', description: 'Z jakich plików cookies korzysta Work in Poland.' };

export default function CookiesPage() {
  const markdown = loadLegalContent('cookies');
  // The cookie document has no separate version in authservice's required set; it follows the privacy version.
  return (
    <LegalPage title="Pliki cookies" version={legalVersions().privacy} markdown={markdown} />
  );
}
