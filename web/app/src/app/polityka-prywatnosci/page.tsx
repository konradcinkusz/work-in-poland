import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';

export const metadata: Metadata = { title: 'Polityka prywatności', description: 'Jakie dane przetwarza Work in Poland (wersja robocza).' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Polityka prywatności" version={legalVersions().privacy}>
      <p>Projekt polityki prywatności. To szkic opisujący, co system faktycznie robi; nie jest poradą prawną ani deklaracją zgodności z RODO.</p>
      <h2>1. Administrator</h2>
      <p>Dane administratora i kontakt do uzupełnienia przed uruchomieniem produkcyjnym.</p>
      <h2>2. Jakie dane przetwarzamy</h2>
      <ul>
        <li><strong>Konto</strong> (przez usługę logowania): adres e-mail, skrót hasła, daty logowania, zapisy akceptacji regulaminu i polityki (wersja, czas, adres IP, przeglądarka).</li>
        <li><strong>Tracker</strong>: oferty zapisane przez użytkownika, status, data aplikowania i notatki (do 2000 znaków).</li>
        <li><strong>Dane firm</strong> (pracodawcy): nazwa, strona www, opis, miasto, logo, opcjonalny NIP (niewidoczny publicznie) i treść ofert.</li>
        <li><strong>Statystyki ofert</strong>: liczba wyświetleń i kliknięć „Aplikuj” — bez danych identyfikujących odwiedzającego.</li>
        <li><strong>Dzienniki serwera</strong>: adres IP i żądania HTTP, w celu bezpieczeństwa i ograniczania nadużyć.</li>
      </ul>
      <h2>3. Czego nie robimy</h2>
      <ul>
        <li>Nie przechowujemy CV ani danych kandydatów przesyłanych pracodawcom — aplikowanie odbywa się przez przekierowanie na stronę pracodawcy.</li>
        <li>Nie używamy analityki, reklam ani skryptów podmiotów trzecich.</li>
      </ul>
      <h2>4. Cele i podstawy</h2>
      <p>Prowadzenie konta i tracker (wykonanie umowy), bezpieczeństwo i ograniczanie nadużyć (uzasadniony interes), udokumentowanie zgód (obowiązek wykazania zgody). Podstawy wymagają potwierdzenia przez prawnika.</p>
      <h2>5. Odbiorcy</h2>
      <p>Dostawcy infrastruktury hostingowej i bazy danych oraz usługa wysyłki e-maili (weryfikacja adresu, reset hasła). Lista do uzupełnienia.</p>
      <h2>6. Okres przechowywania i prawa</h2>
      <p>Dane konta przechowujemy do usunięcia konta. Użytkownik może żądać dostępu, sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia danych oraz wnieść skargę do Prezesa UODO. Szczegóły procedury i okresów do uzupełnienia.</p>
      <h2>7. Pliki cookies</h2>
      <p>Zob. <a href="/cookies">politykę plików cookies</a>.</p>
    </LegalPage>
  );
}
