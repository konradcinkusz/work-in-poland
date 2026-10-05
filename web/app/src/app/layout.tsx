import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/session';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeScript } from '@/components/theme-script';
import { publicSiteUrl } from '@/lib/env';
import './globals.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(publicSiteUrl()),
    title: { default: 'Work in Poland — oferty pracy z widełkami wynagrodzenia', template: '%s — Work in Poland' },
    description: 'Polskie oferty pracy z jawnymi widełkami wynagrodzenia. Wyszukuj w przeglądarce albo przez asystenta AI (MCP).',
    openGraph: { siteName: 'Work in Poland', locale: 'pl_PL', type: 'website' },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Pages are rendered per request: the CSP nonce set by the edge gate must reach the framework's scripts.
  await connection();
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Przejdź do treści
        </a>
        <SessionProvider>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
