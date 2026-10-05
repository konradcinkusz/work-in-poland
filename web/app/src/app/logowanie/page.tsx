import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = { title: 'Logowanie', description: 'Zaloguj się do Work in Poland, aby śledzić aplikacje lub publikować oferty.', robots: { index: false } };

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
