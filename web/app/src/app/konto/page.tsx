import type { Metadata } from 'next';
import { MyData } from '@/components/my-data';
import { Tracker } from '@/components/tracker';

export const metadata: Metadata = { title: 'Moje konto — tracker aplikacji', description: 'Śledź oferty, na które aplikujesz: statusy i prywatne notatki.', robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1>Moje konto</h1>
        <p className="mt-2 max-w-2xl text-slate-700">Tracker aplikacji: oferty, które zapisałeś, ze statusem i prywatną notatką.</p>
        <p className="alert alert-info mt-4 max-w-2xl">
          Nie przechowujemy Twojego CV i niczego nie wysyłamy pracodawcom. Tracker to tylko Twoje własne notatki o ofertach.
        </p>
      </header>
      <Tracker />
      <MyData />
    </div>
  );
}
