import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';

export const metadata: Metadata = { title: 'Pliki cookies', description: 'Z jakich plików cookies korzysta Work in Poland (wersja robocza).' };

export default function CookiesPage() {
  // The cookie document has no separate version in authservice's required set; it follows the privacy version.
  return (
    <LegalPage title="Pliki cookies" version={legalVersions().privacy}>
      <p>Projekt informacji o plikach cookies; nie stanowi porady prawnej.</p>
      <h2>Z jakich cookies korzystamy</h2>
      <p>Wyłącznie ze ściśle niezbędnych plików cookies, potrzebnych do utrzymania sesji po zalogowaniu:</p>
      <ul>
        <li><code>wip_at</code> — token dostępu (HttpOnly, SameSite=Strict, Secure poza środowiskiem deweloperskim);</li>
        <li><code>wip_rt</code> — token odświeżania sesji (jak wyżej);</li>
        <li><code>wip_2fa</code> — krótkotrwały (5 minut) znacznik drugiego kroku logowania;</li>
        <li><code>wip_rf</code>, <code>wip_post_login</code> — kilkusekundowe/kilkuminutowe pliki techniczne odświeżania sesji i powrotu po logowaniu przez zewnętrznego dostawcę.</li>
      </ul>
      <h2>Czego nie używamy</h2>
      <p>Nie stosujemy analityki, reklam, śledzenia ani plików cookies podmiotów trzecich. Przeglądarka nie zapisuje tokenów w pamięci lokalnej.</p>
      <h2>Baner cookies</h2>
      <p>Decyzja: ponieważ używamy wyłącznie ściśle niezbędnych plików cookies, nie wyświetlamy banera zgody. Jeśli kiedykolwiek dodamy pliki inne niż niezbędne, baner i ta informacja zostaną zaktualizowane przed ich uruchomieniem. Ocena wymaga potwierdzenia przez prawnika.</p>
    </LegalPage>
  );
}
