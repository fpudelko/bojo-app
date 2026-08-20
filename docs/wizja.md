# Bojo — wizja i propozycje wartości

> **To jest dokument nadrzędny.** Opisuje kierunek produktu. Gdy kod nie zgadza się
> z tym dokumentem, to **kod nie nadążył** — nie odwrotnie. Rozbieżności trafiają do
> [BACKLOG.md](../BACKLOG.md) jako zadania.
>
> Sekcja 1 to dokument źródłowy **wklejony bez zmian**. Nie parafrazować, nie skracać,
> nie „poprawiać" przy okazji innych zmian. Aktualizacja tylko wtedy, gdy zapadnie
> świadoma decyzja produktowa.

Plan operacyjny (infrastruktura, koszty, role, fazy) → [strategia.md](./strategia.md).
Stan implementacji funkcji → [funkcje.md](./funkcje.md).

---

## 1. Dokument źródłowy (werbatim)

> BOJO - Wizja, Value Propositions i Roadmapa
> Wersja robocza v1. 2026.07.18
>
> **Po co ten dokument**
>
> Żebyśmy oboje mieli te same definicje wizji, wartości i priorytetów.
> Zamiast trzymać je osobno w głowie i ryzykować, że się z czasem rozjadą.
> To nie jest zamknięta decyzja, tylko punkt odniesienia do zmieniania:
> ustalamy → budujemy → testujemy → zbieramy feedback → korygujemy →
> wracamy tutaj i aktualizujemy
>
> **1. Misja, Wizja i Cel Długoterminowy**
>
> Misja: Łączymy ludzi poprzez najprostszy sposób organizowania i
> dołączania do amatorskich gier sportowych.
>
> Wizja: Oddolna platforma społecznościowo-organizacyjna, która staje się
> dla amatorskich graczy domyślnym miejscem planowania, rozgrywania i
> przeżywania aktywności sportowych.
>
> W przeciwieństwie do konkurencji (np. BallSquad), która zaczyna od
> kontraktowania obiektów, BOJO stosuje podejście odwrotne – najpierw to
> skojarzenie z organizacją gry, dopiero potem, z pozycji siły i z realną
> liczbą zaangażowanych userów za sobą, rozmowa z obiektami o rezerwacjach
> i współpracy.
>
> W dłuższej perspektywie BOJO to coś więcej niż narzędzie organizacyjne:
> platforma społecznościowa sportu amatorskiego, gdzie gracze budują
> historię, statystyki i rywalizację, o której można rozmawiać i się nią
> chwalić, podobnie jak Strava robi to dla biegania i kolarstwa. Sport jako
> sfera socjalna, nie tylko rozwiązanie logistycznego problemu "kto gra,
> gdzie i kiedy". BOJO ma być pierwszą aplikacją, którą użytkownik otwiera,
> gdy chce zagrać w sport.
>
> Cel Długoterminowy: Największa społeczność amatorskich graczy
> sportowych w Polsce. Zbudowanie rentownej firmy opartej na tej
> społeczności. Głównym miernikiem sukcesu projektu jest cel finansowy,
> który stanowi ostateczny wskaźnik tego, czy aplikacja dostarcza realną,
> rynkową wartość (użytkownicy i obiekty chcą za nią płacić) - nie tylko
> rośnie liczbą userów.
>
> Cel finansowy nie oznacza rezygnacji z tego, co napędza ten projekt od
> początku - czystej zajawki i chęci rozwiązania własnego problemu. To
> dodatkowy wymiar, który sprawdza, czy inicjatywa jest zdrowa i daje nam
> fun.
>
> **2. WARTOŚCI BOJO (Value Propositions)**
>
> Wartość BOJO budowana jest na dwóch głównych poziomach, które
> rozwiązują realne problemy graczy oraz zaspokajają ich potrzeby
> społeczne:
>
> **A. Poziom Funkcjonalny (Rozwiązanie problemów graczy).**
>
> Najłatwiejszy sposób stworzenia meczu (dopasowany do sportu): Szybkie
> tworzenie gier pojedynczych lub cyklicznych, prywatne, widoczne dla
> grupy lub publiczne
>
> Znajdź brakujących graczy i nie odwołuj gry: wystawianie publicznych gier
>
> Znajdź grę w 2 minuty. Masz czas i ochotę?: dołączanie do gier publicznych
>
> Grupy - (stałe ekipy, zaproszenia, historia meczów i składów) zastąpienie
> facebook/whatsapp, członkowie grupy dostają powiadomienie o utworzeniu
> gry/otwarciu zapisów,
>
> Rozliczysz ekipę w minutę - Kalkulator płatności - zbieranie info ile i
> komu kto ma zapłacić z możliwością oznaczania uregulowanych
>
> Wszystkie obiekty w jednym miejscu: najlepsza baza wiedzy o boiskach i
> obiektach (początkowo jako pinezki na mapie, docelowo pełne profile).
> Bez szukania informacji na stronach
>
> (później) zarezerwuj obiekt bezpośrednio przez apkę
>
> (później) rozliczanie płatności
>
> (później) wynajmij sędziego
>
> (później) zorganizuj turniej firmowy, liga, ………….
>
> **B. Poziom Socjalny (Efekt "Strava / Playarena")**
>
> (później) Rywalizacja i Statystyki: Zapisywanie wyników (gole asysty MVP
> liczba gier), prowadzenie statystyk dla zamkniętych grup znajomych oraz
> rankingów publicznych. Coś, o czym gracze mogą rozmawiać po meczu i czym
> mogą się pochwalić.
>
> (później) Profil Gracza i System Ocen: Budowanie sportowej tożsamości w
> aplikacji, ocena umiejętności oraz system sugerowania odpowiednich
> gier/zawodników na podstawie poziomu zaawansowania i celu gry (skill,
> rywalizacja, sport, przyjemność, kondycja), wiarygodność gracza
>
> (później) poznaj nowych znajomych dzielących pasję/sport
>
> (później) odznaki i rankingi — strzelec miesiąca/roku, X gier w
> miesiącu/roku, 100h na boisku, 10 nowych znajomych
>
> (później) inne kolejne
>
> (później) inne kolejne

---

## 2. Status implementacji

Legenda:

| Status | Znaczenie |
|---|---|
| `ZBUDOWANE` | Działa i użytkownik to widzi |
| `ZBUDOWANE, UKRYTE` | Kod kompletny, ale flaga chowa wejście — użytkownik tego nie znajdzie |
| `CZĘŚCIOWO` | Część działa, część brakuje — szczegóły w kolumnie obok |
| `NIE ZNALEZIONO` | Brak w kodzie |

### A. Poziom funkcjonalny

| Propozycja wartości | Status | Szczegóły |
|---|---|---|
| Najłatwiejszy sposób stworzenia meczu — gry **pojedyncze** | `ZBUDOWANE` | `/wydarzenia/nowe`, `lib/events.ts` |
| …gry **cykliczne** | `ZBUDOWANE, UKRYTE` | `lib/recurring.ts`, `/cykliczne/*`; flaga `SHOW_RECURRING = false` → [luka 3](#3-luki) |
| …**prywatne** lub **publiczne** | `ZBUDOWANE` | `events.visibility` |
| …**widoczne dla grupy** | `NIE ZNALEZIONO` | `visibility` dopuszcza tylko `private`/`public` → [luka 1](#3-luki) |
| Znajdź brakujących graczy — wystawianie gier publicznych | `ZBUDOWANE` | `getPublicEvents`, `/wydarzenia` |
| Znajdź grę w 2 minuty — dołączanie do gier publicznych | `ZBUDOWANE` | `joinEvent`, sortowanie po odległości, `getNearbyEvents` |
| Grupy — stałe ekipy, zaproszenia, historia | `ZBUDOWANE` | `lib/groups.ts`, `/grupy/*`, `/g/[code]` |
| …**powiadomienie dla członków grupy o nowej grze** | `ZBUDOWANE` | Trigger `powiadom_o_nowym_meczu_w_grupie` (migracja `072`) — patrz [luka 2](#3-luki), zamknięta |
| Rozliczysz ekipę w minutę — kalkulator płatności | `ZBUDOWANE` | Panel „Podział kosztów" liczy i renderuje się też **po** meczu — patrz [luka 4](#3-luki), zamknięta |
| Wszystkie obiekty w jednym miejscu | `ZBUDOWANE` | Ponad 30 000 boisk w całej Polsce (import OSM, PR #109), `/mapa`, `/boiska/[sport]`, `/boisko/[id]`; pełne profile zamiast pinezek |
| (później) zarezerwuj obiekt przez apkę | `ZBUDOWANE, UKRYTE` | **Wyprzedza roadmapę.** `lib/bookings.ts`, `/obiekt/*`, `/rezerwacje`; flaga `FEATURE_RESERVATIONS` |
| (później) rozliczanie płatności | `CZĘŚCIOWO` | Rejestrowanie kto zapłacił — tak. Realny przepływ pieniędzy (BLIK/Stripe) — nie |
| (później) wynajmij sędziego | `NIE ZNALEZIONO` | — |
| (później) turniej firmowy, liga | `ZBUDOWANE, UKRYTE` | **Wyprzedza roadmapę.** `lib/tournaments.ts` (455 linii), 6 tabel `tournament_*`, `/turniej/*`; flaga `SHOW_CUP` |

### B. Poziom socjalny

| Propozycja wartości | Status | Szczegóły |
|---|---|---|
| (później) Rywalizacja i statystyki — **gole, asysty, liczba gier** | `ZBUDOWANE` | RPC `get_player_stats`, tabele `player_goals`, `match_results`, `player_stats` |
| …**MVP** | `NIE ZNALEZIONO` | Jedyne wystąpienie to tekst nagrody na `/turniej` |
| …statystyki dla **zamkniętych grup** | `ZBUDOWANE` | `getGroupPlayerStats` w `lib/eventFeatures.ts` |
| …**rankingi publiczne** | `NIE ZNALEZIONO` | — |
| (później) Profil gracza | `ZBUDOWANE` | `/gracz/[id]`, `lib/players.ts` |
| …**wiarygodność gracza** | `ZBUDOWANE` | `reliabilityPct()`, znaczek „rzetelny gracz" (≥5 gier, 0 nieobecności), `player_reports` |
| …**ocena umiejętności / poziom zaawansowania** | `NIE ZNALEZIONO` | — |
| …**sugerowanie gier/zawodników wg poziomu i celu gry** | `NIE ZNALEZIONO` | — |
| (później) poznaj nowych znajomych | `NIE ZNALEZIONO` | — |
| (później) odznaki i rankingi | `NIE ZNALEZIONO` | Poza znaczkiem „rzetelny gracz" |

---

## 3. Luki

Pozycje, w których **kod nie nadążył za dokumentem**. Każda ma wpis w
[BACKLOG.md](../BACKLOG.md).

1. **Trzeci poziom widoczności — „widoczne dla grupy".** Dokument wymienia trzy poziomy,
   kod ma dwa: `events.visibility` to CHECK `('private','public')` (`002_events_and_auth.sql`).
   Kolumna `group_id` (`051_group_field.sql`) steruje **listowaniem** meczu w grupie,
   nie **dostępem** do niego. Wymaga migracji + zmian w UI tworzenia meczu.

2. **ZROBIONE — Powiadomienie dla członków grupy o utworzeniu gry.** Dokument stawia to
   jako część propozycji „Grupy — zastąpienie facebook/whatsapp". Trigger
   `powiadom_o_nowym_meczu_w_grupie` (migracja `072`) wstawia powiadomienie wszystkim
   członkom grupy poza organizatorem przy każdym `INSERT INTO events` z ustawionym
   `group_id`. Szczegóły → [BACKLOG.md §1.2](../BACKLOG.md#12-powiadomienie-dla-członków-grupy-o-utworzeniu-gry--zrobione).

3. **Gry cykliczne ukryte flagą.** Dokument wymienia je w pierwszej propozycji wartości,
   na równi z grami pojedynczymi. Kod jest kompletny; `SHOW_RECURRING = false` ukrywa
   wejścia w `Header.tsx`, `app/page.tsx` i `moje-gry`. Decyzja: odmrozić czy uzasadnić
   ukrycie.

4. **ZROBIONE — Rozliczenie po meczu.** Propozycja brzmi „Rozliczysz ekipę w minutę".
   Panel „Podział kosztów" (`EventDetailClient.tsx`) nie jest już bramkowany
   `!eventStarted` — renderuje się przy `costGrosze > 0 && (isOwner || canManagePayments)`,
   niezależnie od tego, czy mecz się zaczął. Karta „Twoja płatność" pokazuje uczestnikowi
   kwotę do zapłaty. Szczegóły → [BACKLOG.md §1.4](../BACKLOG.md#14-rozliczenie-po-meczu--zrobione).

### Odwrotny kierunek: kod wyprzedza dokument

**Rezerwacje obiektów** i **turniej** są oznaczone w dokumencie jako „(później)", a są
zbudowane i schowane za flagami. To nie jest luka — to decyzja do podjęcia: odmrozić
i przesunąć w roadmapie, czy zostawić do czasu, aż będzie na to popyt.
