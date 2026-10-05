import type { Metadata } from 'next';
import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = { title: 'Rejestracja', description: 'Załóż konto w Work in Poland, aby śledzić aplikacje lub publikować oferty pracy.', robots: { index: false } };

export default function RegisterPage() {
  return <RegisterForm />;
}
