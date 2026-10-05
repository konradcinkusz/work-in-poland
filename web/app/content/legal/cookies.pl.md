# Polityka plików cookies

**[DRAFT] This is a draft of the cookies policy pending legal review.**

## Z jakich cookies korzystamy

Wyłącznie ze ściśle niezbędnych plików cookies, potrzebnych do utrzymania sesji po zalogowaniu:

| Nazwa | Cel | Czas | Kategoria |
|-------|-----|------|----------|
| `wip_at` | Token dostępu | 30 dni | Niezbędny |
| `wip_rt` | Token odświeżania sesji | 30 dni | Niezbędny |
| `wip_2fa` | Znacznik drugiego kroku logowania | 5 minut | Niezbędny |
| `wip_rf` | Marker odświeżania sesji | 10 sekund | Niezbędny |
| `wip_post_login` | Powrót po logowaniu przez zewnętrznego dostawcę | 10 minut | Niezbędny |

Wszystkie cookies są ustawiane jako:
- **HttpOnly**: niedostępne dla JavaScript
- **Secure**: wysyłane tylko przez HTTPS (za wyjątkiem środowiska deweloperskiego)
- **SameSite=Strict** (poza `wip_post_login`, które używa `SameSite=Lax` ze względu na logowanie społeczne)

## Czego nie używamy

- Nie stosujemy analityki, reklam, śledzenia ani plików cookies podmiotów trzecich.
- Przeglądarka nie zapisuje tokenów w pamięci lokalnej.

## Baner cookies

Ponieważ używamy wyłącznie ściśle niezbędnych plików cookies, nie wyświetlamy banera zgody. Jeśli kiedykolwiek dodamy pliki inne niż niezbędne, baner i ta informacja zostaną zaktualizowane przed ich uruchomieniem. Ocena wymaga potwierdzenia przez prawnika.
