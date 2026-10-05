'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './session';

const NAV = [
  { href: '/', label: 'Oferty pracy' },
  { href: '/wynagrodzenia', label: 'Wynagrodzenia' },
  { href: '/mcp', label: 'Asystenci AI' },
  { href: '/pracodawca', label: 'Dla pracodawców' },
];

export function SiteHeader() {
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Versioned consent: a signed-in user whose accepted versions are stale must re-accept first.
  const mustConsent = session.status === 'authenticated' && session.requiresConsent;
  useEffect(() => {
    if (mustConsent && !['/zgody', '/regulamin', '/polityka-prywatnosci', '/cookies'].includes(pathname)) {
      router.replace(`/zgody?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [mustConsent, pathname, router]);

  const onLogout = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900 no-underline">
          Work in Poland
        </Link>
        <nav aria-label="Główna nawigacja" className="order-3 w-full sm:order-2 sm:w-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-block py-2 text-sm font-medium no-underline hover:underline ${active ? 'text-slate-900 underline' : 'text-slate-700'}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="order-2 flex items-center gap-2 sm:order-3">
          {session.status === 'anonymous' ? (
            <>
              <Link href="/logowanie" className="btn btn-secondary btn-sm">Zaloguj się</Link>
              <Link href="/rejestracja" className="btn btn-primary btn-sm">Załóż konto</Link>
            </>
          ) : (
            <>
              {/* Optimistic while loading: show the account entry, not "log in" (no flash for signed-in users). */}
              <Link href="/konto" className="btn btn-secondary btn-sm">Moje konto</Link>
              {session.status === 'authenticated' && (
                <button type="button" onClick={onLogout} className="btn btn-secondary btn-sm">Wyloguj</button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
