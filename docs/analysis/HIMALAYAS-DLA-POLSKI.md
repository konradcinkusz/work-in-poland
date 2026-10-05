# "Himalayas dla Polski" — analiza

> Analiza wejściowa do tego repozytorium, wklejona bez zmian merytorycznych. To ona wyznacza,
> co jest zakładem, a co nie; [`docs/adr/0010-product-scope.md`](../adr/0010-product-scope.md)
> opisuje, jak została przełożona na zakres implementacji.

Data: 2026-10-05. Pytanie: zbudować coś analogicznego do Himalayas (MCP-first job board z
publikowaniem przez firmy), ale na rynek polski.

Ograniczenia: szybki przegląd internetu. Cenniki i ruch pochodzą z zestawienia na blogu
agregującego cenniki, którego daty nie ustaliłem (wspomina dane z 2021), więc traktuj je jako
rząd wielkości. Nie mam danych o przychodach ani udziałach polskich portali. Wnioski prawne nie
są poradą prawną.

## 1. Werdykt

Kopiowanie Himalayas 1:1 dla Polski to zły zakład. Dwie zmodyfikowane wersje mają sens, ale
tylko po przedsprzedaży.

Himalayas działa, bo jest globalny, wyłącznie zdalny i anglojęzyczny, z darmową publikacją, więc
ma ogromną pulę ofert i ruchu. Polski odpowiednik traci każdą z tych cech: rynek jest lokalny,
zasilany przez kilku silnych graczy z dojrzałymi cennikami, a udział ofert zdalnych spada. Polska
nie jest dla Himalayas "rynkiem", tylko filtrem na stronie z ofertami zdalnymi z całego świata.

## 2. Polski rynek

Rynek pracy IT (raport No Fluff Jobs 2025/2026, przytoczony przez Antyweb):

* Oferty wzrosły w 2025 o 44% rok do roku, a liczba aplikacji na ofertę spadła o 45%.
  Pracodawcy mają więc motywację, żeby płacić za dotarcie do kandydatów.
* Seniorzy to około 60% ofert, juniorzy około 5%.
* Praca zdalna to 42–43% ofert i maleje, hybrydowa 35,4% (z 18,6% trzy lata temu). Czyli nisza
  "zdalnie z Polski" kurczy się, a nie rośnie.

Konkurenci (według zestawienia): Pracuj.pl (ok. 3,5 mln odwiedzających miesięcznie), No Fluff
Jobs (obowiązkowe widełki w ofertach), JustJoin.it, Bulldogjob, theprotocol.it (grupa Pracuj),
4programmers i inni. Ceny za pojedyncze ogłoszenie IT to rząd 890–1 990 PLN netto (pakiety
podstawowe do premium, wyższe dla wariantów "all-star"). Tak niski próg płatności oznacza, że
firmy są przyzwyczajone do płacenia, ale też że na rynku jest już dużo graczy.

Przejrzystość wynagrodzeń nie jest już wyróżnikiem. Od 24 grudnia 2025 nowelizacja Kodeksu pracy
wymaga przekazania informacji o wynagrodzeniu (kwota wyjściowa lub widełki, razem ze wszystkimi
składnikami) przed rozmową lub zatrudnieniem, ale nie wprost w ogłoszeniu. Zakazuje też pytania
o poprzednie zarobki. No Fluff Jobs i tak wymaga widełek. Nie ustaliłem, jak przepisy dotyczą
B2B ani kar. Do sprawdzenia z prawnikiem.

MCP po stronie polskich boardów: w moim przeglądzie nie znalazłem oficjalnego MCP żadnego dużego
polskiego portalu. Są nieoficjalne serwery społeczności (np. dla No Fluff Jobs) i ogólne
serwery typu proxy. To realna luka, ale nie weryfikowałem jej dokładnie, a "brak MCP" nie
oznacza popytu na niego.

## 3. Opcje

**A. Pełny polski job board z MCP (kopia modelu Himalayas)**

* Zimny start przeciwko Pracuj.pl, No Fluff Jobs i JustJoin.it, które mają ruch, markę i bazy
  kandydatów.
* Darmowa publikacja (jak Himalayas) działa tam, gdzie jest globalna pula ofert. W Polsce nie ma
  jej czym zasilić legalnie (scrapowanie boardów odpada).
* Przewaga "MCP" jest słaba, bo kanał nie ma widowni (patrz poprzednia analiza).
* Nie polecam.

**B. Wąska nisza w Polsce**

Np. role inżynierskie AI/agentów, ewentualnie "remote-first z Polski z B2B", z obowiązkowymi
widełkami i weryfikacją ofert. Mało ofert, wysoka wartość każdej, twoja wiarygodność z portfolio
działa jako dowód.

* Rachunek pomocniczy (nie prognoza): przy cenach z zestawienia, 10 płatnych ogłoszeń miesięcznie
  to około 9–20 tys. PLN. Przy konwersji 5–15% z darmowych (benchmark z poprzedniej analizy)
  trzeba około 70–200 darmowych ogłoszeń miesięcznie, co dla niszy jest dużo.
* Ryzyko: nisza może być zbyt mała, a kandydaci i tak pójdą na duże portale.
* Dopuszczalne, tylko po przedsprzedaży.

**C. Warstwa MCP/AI jako usługa dla istniejących polskich boardów (B2B2C)**

Zamiast budować własny board, zaoferować mniejszym i średnim portalom oficjalny, utrzymywany
serwer MCP / aplikację dla ChatGPT i Claude (wyszukiwanie ofert, szczegóły, śledzenie
aplikacji), z OAuth i ewaluacjami. Boardy mają oferty i płacących pracodawców, ty masz
technologię. Klientem jesteś dla portalu, nie dla kandydatów.

* Plus: omija zimny start dwustronny, legalny dostęp do danych, który masz za zgodą właściciela,
  i dobry projekt portfolio (MCP, OAuth, ewaluacje).
* Minus: mały krąg klientów (kilka portali), cykl sprzedaży z decydentami, ryzyko, że zrobią to
  sami lub wystarczy im wtyczka.
* Najciekawsza z trzech, ale trzeba najpierw zapytać portale, czy tego chcą.

**D. Tylko portfolio**

Serwer MCP z publicznie dostępnych, legalnych źródeł (ATS firm) i demo, bez modelu biznesowego.
Zgodne z planem na 2027.

## 4. Wymagania specyficzne dla Polski

* Przepisy o jawności wynagrodzeń: widełki i składniki; obsługa B2B i umów o pracę (UoP) jako
  dwóch różnych wymiarów w danych.
* RODO i UODO, regulamin serwisu i polityka prywatności po polsku. Aplikowanie najlepiej jako
  przekierowanie do ATS firmy, bez przechowywania CV.
* Pośrednictwo pracy: samo publikowanie ogłoszeń to co innego niż zbieranie CV i przekazywanie
  ich pracodawcom. To drugie może wymagać wpisu do rejestru agencji zatrudnienia (KRAZ), o czym
  pisałem przy pomyśle agencji. Sprawdź z prawnikiem, zanim dodasz funkcję "wyślij moje CV do
  firm".
* Faktury, VAT i podatki firmy (działalność w Polsce, płatności od firm). Szczegóły z księgowym.
* Język i SEO po polsku; zweryfikować, jak Google for Jobs działa dla polskich ofert i jakie
  dane strukturalne wymaga.

## 5. Co zrobić najpierw (zanim powstanie linia kodu)

1. Pięć rozmów z polskimi boardami (najlepiej mniejszymi, np. Bulldogjob, 4programmers i
   podobne): czy chcą oficjalnego MCP/aplikacji AI i za ile. To odpowiada na opcję C.
2. Dwadzieścia wiadomości do polskich firm z niszy AI/agentów: czy zapłaciłyby 1–2 tys. PLN za
   ogłoszenie przed konkretną grupą. To odpowiada na opcję B.
3. Sprawdź regulamin i zgodę każdego źródła, którego dane chcesz pokazywać.
4. Dopiero wtedy decyzja: C, B albo D.

## 6. Moja rekomendacja

Najpierw wariant D jako realny, tani start (MCP z legalnych źródeł i dobrymi ewaluacjami), a
równolegle rozmowy z portalami (C). Jeśli któryś zgłosi zainteresowanie, to jest produkt z
klientem zamiast zakładu na zimny start. Opcję A pomijam, B tylko po pozytywnej przedsprzedaży.

Bez oceniania: to piąty kierunek w krótkim czasie. Jeśli ma służyć szukaniu pracy i budowie
pozycji na 2027, wybierz jeden projekt narzędziowy. Ten kierunek wymaga sprzedaży i rozmów z
ludźmi więcej niż pisania kodu.

## Źródła

* [Jawność wynagrodzeń w rekrutacji (Infor.pl)](https://www.infor.pl/prawo/praca/rekrutacja/7506135,jawnosc-wynagrodzen-w-rekrutacji-pracownikow-trzeba-podac-konkretna-kwote-czy-widelki-co-zmienila-nowelizacja-kodeksu-pracy.html)
* [Top 9 IT job boards in Poland (Next Technology Professionals)](https://nexttechnology.io/top-9-it-job-boards-in-poland/)
* [Odbicie na rynku pracy IT: więcej ofert, mniej CV, seniorzy rządzą (Antyweb)](https://antyweb.pl/rynek-pracy-w-it-2026)
* [Himalayas, dokumentacja](https://himalayas.app/docs/what-is-himalayas)
* [Remote Jobs in Poland on Himalayas](https://himalayas.app/jobs/countries/poland)
