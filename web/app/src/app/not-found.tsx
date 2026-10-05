import Link from 'next/link';

export const metadata = { title: 'Nie znaleziono strony' };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <h1>Nie znaleziono strony</h1>
      <p className="mt-3 text-slate-700">Ta strona nie istnieje albo oferta została już zamknięta.</p>
      <Link href="/" className="btn btn-primary mt-6">Wróć do ofert</Link>
    </div>
  );
}
