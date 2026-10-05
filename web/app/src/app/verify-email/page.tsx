import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmail } from '@/components/verify-email';

// This English path is fixed by authservice: its e-mail links to <FrontendBaseUrl>/verify-email.
export const metadata: Metadata = { title: 'Potwierdzenie adresu e-mail', description: 'Potwierdź adres e-mail konta.', robots: { index: false } };

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmail /></Suspense>;
}
