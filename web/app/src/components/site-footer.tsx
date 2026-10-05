import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-700">
        <p>
          Work in Poland — oferty pracy z jawnymi widełkami wynagrodzenia. Nie przechowujemy CV; aplikujesz bezpośrednio u pracodawcy.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          <li><Link href="/regulamin">Regulamin</Link></li>
          <li><Link href="/polityka-prywatnosci">Polityka prywatności</Link></li>
          <li><Link href="/cookies">Pliki cookies</Link></li>
          <li><Link href="/mcp">Asystenci AI (MCP)</Link></li>
        </ul>
      </div>
    </footer>
  );
}
