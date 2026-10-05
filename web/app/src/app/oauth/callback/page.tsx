import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OAuthCallback } from '@/components/oauth-callback';

export const metadata: Metadata = { title: 'Kończenie logowania', robots: { index: false } };

export default function OAuthCallbackPage() {
  return <Suspense><OAuthCallback /></Suspense>;
}
