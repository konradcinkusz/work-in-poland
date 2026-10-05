import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { legalVersions } from '@/lib/consent';

export const metadata: Metadata = { title: 'Regulamin', description: 'Regulamin serwisu Work in Poland (wersja robocza).' };

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin" version={legalVersions().terms}>
      <p>Projekt regulaminu serwisu Work in Poland. To szkic, a nie porada prawna; nie stanowi zapewnienia zgodności z jakimikolwiek przepisami.</p>
      <h2>1. Czym jest serwis</h2>
      <p>Work in Poland to tablica ogłoszeń o pracę w Polsce. Serwis nie jest pracodawcą ani pośrednikiem pracy: wyświetla ogłoszenia dodane przez pracodawców i przekierowuje kandydatów na strony, które pracodawcy wskazali.</p>
      <h2>2. Konto</h2>
      <ul>
        <li>Konta są prowadzone przez zewnętrzną usługę logowania (authservice) działającą w ramach tego samego systemu.</li>
        <li>Użytkownik odpowiada za poufność hasła i prawdziwość podanych danych.</li>
      </ul>
      <h2>3. Kandydaci</h2>
      <ul>
        <li>Przeglądanie ofert nie wymaga konta.</li>
        <li>Serwis <strong>nie przechowuje CV</strong> i nie przekazuje pracodawcom żadnych danych kandydata. Przycisk „Aplikuj” otwiera stronę pracodawcy; dalsze działania odbywają się na zasadach pracodawcy.</li>
        <li>Tracker aplikacji zawiera wyłącznie notatki i statusy wprowadzone przez użytkownika; są widoczne tylko dla niego.</li>
      </ul>
      <h2>4. Pracodawcy</h2>
      <ul>
        <li>Każda opublikowana oferta musi zawierać widełki wynagrodzenia (min i max) dla każdego oferowanego rodzaju umowy. To zasada serwisu, oparta na polskich przepisach o jawności wynagrodzeń obowiązujących od 24.12.2025; nie jest to porada prawna.</li>
        <li>Pracodawca odpowiada za treść ogłoszenia, jej zgodność z prawem i prawdziwość widełek.</li>
        <li>Serwis może zamknąć ofertę, która narusza regulamin lub prawo.</li>
        <li>Obecnie publikacja ofert nie jest płatna; promowanie ofert przyznaje operator serwisu.</li>
      </ul>
      <h2>5. Zakazane zachowania</h2>
      <p>Zabronione jest zamieszczanie treści bezprawnych, wprowadzających w błąd, zbieranie danych kandydatów poza zasadami prawa oraz zakłócanie działania serwisu.</p>
      <h2>6. Asystenci AI (MCP)</h2>
      <p>Serwis udostępnia interfejs MCP. Korzystanie z niego podlega temu samemu regulaminowi; odpowiedzi asystentów AI mogą zawierać błędy, a źródłem prawdy jest treść ogłoszenia.</p>
      <h2>7. Odpowiedzialność</h2>
      <p>Serwis dokłada starań, by dane były aktualne, ale nie gwarantuje ciągłości działania ani skutku aplikacji. Zakres odpowiedzialności wymaga ustalenia przez prawnika.</p>
      <h2>8. Zmiany regulaminu</h2>
      <p>O zmianie regulaminu zawiadamiamy przez nową wersję dokumentu; zalogowany użytkownik zostanie poproszony o ponowną akceptację.</p>
    </LegalPage>
  );
}
