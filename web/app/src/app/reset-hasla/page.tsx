import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/reset-forms';

export const metadata: Metadata = { title: 'Reset hasła', description: 'Poproś o link do ustawienia nowego hasła.', robots: { index: false } };

export default function ForgotPage() {
  return <ForgotPasswordForm />;
}
