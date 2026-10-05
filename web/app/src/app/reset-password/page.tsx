import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/reset-forms';

// This English path is fixed by authservice: its e-mail links to <FrontendBaseUrl>/reset-password.
export const metadata: Metadata = { title: 'Nowe hasło', description: 'Ustaw nowe hasło do konta.', robots: { index: false } };

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
