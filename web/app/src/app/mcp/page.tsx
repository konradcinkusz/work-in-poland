import type { Metadata } from 'next';
import { McpEndpoints } from '@/components/mcp-endpoints';
import { publicApiUrl } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Asystenci AI (MCP)',
  description: 'Szukaj ofert pracy i publikuj ogłoszenia przez asystenta AI: Claude, Cursor i inne klienty MCP.',
  alternates: { canonical: '/mcp' },
};

const OPEN_TOOLS: [string, string][] = [
  ['search_jobs', 'Szuka ofert wg słów kluczowych, miasta, trybu pracy, poziomu, widełek i rodzaju umowy.'],
  ['get_job_details', 'Zwraca pełną ofertę: opis, wszystkie widełki, adres aplikowania.'],
  ['search_companies', 'Szuka firm po nazwie, także tylko zweryfikowanych.'],
  ['get_company', 'Zwraca firmę wraz z jej otwartymi ofertami.'],
  ['get_salary_benchmarks', 'Statystyki wynagrodzeń (min, kwartyle, mediana, max) dla stanowiska, poziomu, umowy i miasta.'],
  ['list_filter_values', 'Podaje dozwolone wartości filtrów i miasta z aktywnymi ofertami.'],
];
const ACCOUNT_TOOLS: [string, string, string][] = [
  ['track_job', 'Zapisuje ofertę w trackerze, ustawia status i notatkę.', 'tracker:write'],
  ['list_tracked_jobs', 'Pokazuje Twoje zapisane oferty ze statusami.', 'jobs:read'],
  ['untrack_job', 'Usuwa ofertę z trackera.', 'tracker:write'],
  ['list_my_companies', 'Wyświetla Twoje firmy.', 'employer:write'],
  ['create_company', 'Tworzy firmę pracodawcy.', 'employer:write'],
  ['list_my_jobs', 'Wyświetla Twoje oferty (szkice i opublikowane).', 'employer:write'],
  ['get_my_job', 'Pokazuje jedną z Twoich ofert ze statystykami.', 'employer:write'],
  ['post_job', 'Dodaje ofertę jako szkic lub od razu ją publikuje (widełki są wymagane).', 'employer:write'],
  ['update_job', 'Zmienia ofertę.', 'employer:write'],
  ['publish_job', 'Publikuje szkic.', 'employer:write'],
  ['close_job', 'Zamyka opublikowaną ofertę.', 'employer:write'],
  ['renew_job', 'Odnawia ofertę na kolejny okres.', 'employer:write'],
];
const PROMPTS = [
  'Znajdź zdalne oferty backend dla seniora z widełkami od 20 000 PLN netto na B2B.',
  'Ile zarabia mid frontend developer na UoP w Krakowie? Pokaż medianę i próbę.',
  'Zapisz tę ofertę w moim trackerze jako „aplikowano” i dodaj notatkę, że rozmowa jest w piątek.',
  'Dodaj ofertę Senior QA w mojej firmie: hybrydowo w Gdańsku, B2B 16 000–20 000 PLN netto, jako szkic.',
];

export default function McpPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1>Asystenci AI</h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-700">
          MCP (Model Context Protocol) to otwarty standard, dzięki któremu asystent AI może korzystać z zewnętrznych narzędzi.
          Work in Poland udostępnia takie narzędzia: asystent przeszuka oferty, porówna wynagrodzenia, a po zalogowaniu prowadzi Twój tracker lub dodaje ogłoszenia.
        </p>
      </header>

      <section aria-labelledby="endpoints" className="space-y-4">
        <h2 id="endpoints">Adresy i konfiguracja</h2>
        <McpEndpoints initialApiUrl={publicApiUrl()} />
        <div className="alert alert-warn">
          <p className="font-semibold">Uwaga o logowaniu OAuth</p>
          <p className="mt-1">
            Endpoint konta wymaga identyfikatora i sekretu klienta OAuth wydanych przez operatora serwisu — usługa logowania obsługuje wyłącznie
            wcześniej zarejestrowanych klientów (bez dynamicznej rejestracji). Endpoint publiczny nie wymaga niczego.
          </p>
        </div>
      </section>

      <section aria-labelledby="tools" className="space-y-4">
        <h2 id="tools">Narzędzia</h2>
        <h3 className="font-semibold">Endpoint publiczny — bez logowania</h3>
        <ul className="space-y-2">
          {OPEN_TOOLS.map(([name, desc]) => (
            <li key={name} className="card py-3"><code className="font-semibold">{name}</code> — {desc}</li>
          ))}
        </ul>
        <h3 className="pt-4 font-semibold">Endpoint konta — OAuth (obejmuje też narzędzia publiczne)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Narzędzia konta i wymagane zakresy</caption>
            <thead><tr className="border-b border-slate-300"><th scope="col" className="py-2 pr-3">Narzędzie</th><th scope="col" className="py-2 pr-3">Opis</th><th scope="col" className="py-2">Zakres</th></tr></thead>
            <tbody>
              {ACCOUNT_TOOLS.map(([name, desc, scope]) => (
                <tr key={name} className="border-b border-slate-200 align-top">
                  <th scope="row" className="py-2 pr-3 font-mono font-semibold">{name}</th>
                  <td className="py-2 pr-3">{desc}</td>
                  <td className="py-2 font-mono">{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-700">Zakresy: <code>jobs:read</code>, <code>tracker:write</code>, <code>employer:write</code> oraz <code>offline_access</code> (wymagany przez usługę logowania).</p>
      </section>

      <section aria-labelledby="prompts" className="space-y-3">
        <h2 id="prompts">Przykładowe polecenia</h2>
        <ul className="space-y-2">
          {PROMPTS.map((p) => <li key={p} className="card py-3">„{p}”</li>)}
        </ul>
      </section>
    </div>
  );
}
