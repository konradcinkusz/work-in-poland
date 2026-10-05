# Następne kroki: przedsprzedaż i lista pytań do prawnika

Platforma w tym repozytorium jest **gotowa technicznie, ale nie zweryfikowana rynkowo**
([ADR 0010](../adr/0010-product-scope.md)). Analiza ([`HIMALAYAS-DLA-POLSKI.md`](HIMALAYAS-DLA-POLSKI.md), §5) stawia
rozmowy przed kodem; kod już jest, więc rozmowy są teraz jedyną rzeczą, która rozstrzyga między opcjami
B, C i D. Ten dokument zamienia §5 w gotowe do użycia kroki. **To nie jest porada prawna ani
księgowa** — lista pytań jest po to, żeby rozmowa z prawnikiem trwała godzinę, a nie trzy.

## 1. Co rozstrzyga, która opcja wygrywa

| Opcja z analizy | Rozstrzyga ją | Zrobione, gdy | Gdzie w kodzie to "wchodzi" |
|---|---|---|---|
| **C** — warstwa MCP/AI dla istniejącego portalu | rozmowy z 5 mniejszymi portalami | co najmniej jeden portal mówi "tak, chcemy to oficjalnie" i podaje cenę | partner publikuje oferty swoich pracodawców przez to samo API (zakres w authservice + endpoint zbiorczy) |
| **B** — nisza (AI/agenci, remote z Polski, B2B) | 20 wiadomości do firm | ≥ 3 firmy deklarują zapłatę 1–2 tys. PLN za ogłoszenie przed konkretną grupą | płatności ([ADR 0005](../adr/0005-no-payments-yet.md)) i strony kategorii |
| **D** — portfolio | nic: to domyślny wynik, gdy B i C milczą | demo działa publicznie, a ewaluacje MCP są opisane | to, co jest teraz |

## 2. Pięć rozmów z portalami (opcja C)

Cel rozmowy: **czy chcą oficjalnego serwera MCP / aplikacji AI na swoich danych i za ile** — nie
przedstawianie tego repozytorium jako konkurenta. Demo jest argumentem, że wiesz, jak to zrobić.

- **Kogo:** mniejsze i średnie portale z ofertami IT (np. Bulldogjob, 4programmers i podobne).
  Decydent to zwykle product owner albo ktoś od partnerstw, nie rekruter.
- **Pierwsza wiadomość (szablon):**

  > Dzień dobry, jestem inżynierem; zbudowałem działający serwer MCP dla polskiego rynku pracy
  > (wyszukiwanie ofert, widełki z podziałem UoP/B2B, śledzenie aplikacji, logowanie OAuth) — można go
  > podłączyć do Claude'a lub Cursora jednym adresem: `<adres /mcp>`. Zastanawiam się, czy portale
  > takie jak Państwa chciałyby mieć **oficjalnego, utrzymywanego** MCP na własnych danych, zamiast
  > nieoficjalnych wtyczek społeczności. Czy mogę zająć 20 minut i zapytać, czy to w ogóle jest u Państwa
  > temat — i czy tak, to w jakiej formie? Niczego nie sprzedaję w tej wiadomości.

- **Pytania na rozmowę:** (1) Czy macie już plan na ChatGPT/Claude jako kanał kandydatów? (2) Kto u was
  zdecydowałby o oficjalnym MCP, i kto by go utrzymywał? (3) Jakie dane moglibyście udostępnić i na
  jakich warunkach (regulamin, zgody pracodawców)? (4) Ile byłoby to warte rocznie — rząd wielkości?
  (5) Co sprawiłoby, że powiedzielibyście "nie"?
- **Kryterium sukcesu:** ≥ 1 portal prosi o ofertę i podaje cenę. Pięć grzecznych "może kiedyś" to
  odpowiedź: nie C.
- **Czego nie robić:** nie pobierać ofert z ich serwisów, nie pokazywać ich danych w demie bez zgody
  (analiza §5.3).

## 3. Dwadzieścia wiadomości do firm (opcja B)

- **Kogo:** polskie firmy z niszy AI/agentów, które w ostatnich miesiącach ogłaszały rekrutację na
  senior-ów (seniorzy to ~60% ofert — analiza §2).
- **Wiadomość (szablon):**

  > Widzę, że rekrutujecie `<rola>`. Buduję w Polsce miejsce na takie ogłoszenia: obowiązkowe widełki
  > (UoP i B2B osobno), weryfikacja ofert i dotarcie przez asystentów AI. Czy zapłaciłby Pan/Pani
  > 1–2 tys. PLN za ogłoszenie, gdyby trafiło do konkretnej grupy `<opis>` — a jeśli nie, co musiałoby
  > być prawdą, żeby tak?

- **Kryterium:** ≥ 3 z 20 mówią "tak, za tyle" — i podają, czego brakuje. Rachunek pomocniczy z analizy:
  10 płatnych ogłoszeń miesięcznie ≈ 9–20 tys. PLN, co przy konwersji 5–15% wymaga 70–200 darmowych
  ogłoszeń miesięcznie — **dla niszy to dużo**; jeśli odpowiedzi tego nie dźwigają, wynik to D.

## 4. Pytania do prawnika (jedna godzina)

Kolejność według tego, co **blokuje uruchomienie publiczne**:

1. **Regulamin, polityka prywatności, polityka cookies.** Robocze wersje są w aplikacji
   (`/regulamin`, `/polityka-prywatnosci`, `/cookies`) z widocznym ostrzeżeniem. Czy opisują dokładnie
   to, co system robi: konto w usłudze tożsamości, notatki w trackerze, dane firm, brak CV, tylko
   niezbędne cookies sesyjne?
2. **RODO.** Kto jest administratorem czego (konto/tracker: operator; dane kandydatów u pracodawcy po
   przekierowaniu: pracodawca)? Czy potrzebna jest umowa powierzenia z partnerem w opcji C? Retencja po
   usunięciu konta (authservice: soft-delete + okres karencji; tracker: [do ustalenia w backlogu]).
3. **Pośrednictwo pracy (KRAZ).** Potwierdzić, że publikowanie ogłoszeń z przekierowaniem do ATS firmy,
   bez zbierania i przekazywania CV, **nie** wymaga wpisu — i gdzie dokładnie przebiega granica
   ([ADR 0004](../adr/0004-apply-by-redirect.md)). Czy "tracker" z notatkami kandydata zmienia obraz?
4. **Jawność wynagrodzeń od 24.12.2025.** Jak przepisy stosują się do B2B i umów cywilnoprawnych; jakie
   są sankcje; czy widełki w ogłoszeniu spełniają obowiązek informacyjny, czy tylko go uzupełniają
   ([ADR 0007](../adr/0007-mandatory-salary-ranges.md) — to reguła produktu, nie interpretacja ustawy).
5. **Odpowiedzialność za treść ogłoszeń** (wyłączenie odpowiedzialności hostingodawcy, zgłaszanie
   naruszeń, moderacja — w API jest `unpublish` z powodem, brak formularza zgłoszeń).
6. **Dane widoczne publicznie.** NIP firmy (zapisywany, nie wystawiany publicznie), nazwa firmy i opis —
   czy weryfikacja ("zweryfikowana firma") rodzi odpowiedzialność za jej prawdziwość?

## 5. Z księgowym

Faktury, VAT i podatki od przychodów firmy (działalność w Polsce, płatności od firm) — dopiero gdy
pojawi się pierwsza płatność ([ADR 0005](../adr/0005-no-payments-yet.md)). Przed uruchomieniem
publicznym nie ma tu nic do zrobienia.

## 6. Decyzja

Po rozmowach z §2 i §3 zapisz wynik jako nowy ADR (np. `0012-wybrana-opcja.md`), który zastępuje
[ADR 0010](../adr/0010-product-scope.md): wybrana opcja, dowód (kto i co powiedział), i co robimy w
następnym kwartale — oraz **czego już nie robimy**.
