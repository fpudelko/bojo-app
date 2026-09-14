# Moduł turniejowy — plan (duże klocki)

> Zatwierdzone 2026-09-13. Zobacz też [turnieje-plan-srednie-klocki.md](./turnieje-plan-srednie-klocki.md)
> (specyfikacja co do pliku/funkcji) i [funkcje.md](./funkcje.md#flagi-funkcji) (stan wdrożenia,
> flaga `SHOW_TURNIEJE`). Ten plik jest **odniesieniem historycznym** — opisuje decyzję taką, jaka
> zapadła, i aktualizuje się, gdy decyzja się zmienia, nie przy każdym PR-ze wdrożeniowym.

Organizator zakłada turniej, ustawia parametry, otwiera zapisy dla drużyn. Drużyny zgłaszają się
z zawodnikami. Gracze z kontem widzą wszystko (składy, statystyki), bez konta — tylko ogólne info.
Prowadzący oznacza start/koniec meczu i wpisuje wynik na żywo (gole, strzelcy, kartki, MVP).
Rankingi strzelców i tabela liczą się same.

**Strategia:** faza 1 Bojo skupia się na organizatorach — turniej jest silniejszą wersją tego
samego mechanizmu co pojedynczy mecz (organizator przyprowadza graczy, którzy muszą założyć
konto, żeby zobaczyć coś więcej niż ogólne info).

## 1. Dlaczego turniej, a nie kolejna funkcja meczu

Jeden mecz to organizator + 10–14 osób. Jeden turniej to organizator, 8–16 kapitanów i 60–200
zawodników — i ci ludzie **chcą** wracać: sprawdzić tabelę, klasyfikację strzelców, kiedy grają
kolejny mecz. To najsilniejszy dostępny nam wariant *single-player mode* (OpenTable): dajemy
organizatorowi wartość w dniu zero (terminarz, tabela, wyniki — dziś robione w Excelu i na
kartce), a przy okazji zmuszamy kilkadziesiąt osób do założenia konta, żeby zobaczyć nazwisko
przy golu.

**Zasada przewodnia:** turniej ma być prostszy niż kartka, nie bogatszy niż Ekstraklasa. Od
„utwórz turniej” do „wyślij link kapitanom” w trzy minuty.

## 2. Stary moduł turniejowy — co z nim robimy

W repo istniał już moduł turniejowy: migracje `029`/`030`, sześć tabel `tournament_*`,
`lib/tournaments.ts` (446 linii), trasy `/turniej/*`, za flagą `SHOW_CUP = false`. To „BOJO
Community Cup” — **inny produkt**: turniej zakłada wyłącznie admin, jedna edycja wpisana seedem,
drużyny umawiają mecze same przez tygodnie, wynik zgłasza kapitan i potwierdza rywal.

| Wymiar | Stary moduł (`029`) | Nowy moduł |
|---|---|---|
| Kto zakłada | wyłącznie admin Bojo | każdy zalogowany organizator |
| Ile edycji | jedna, wpisana seedem | dowolnie wiele, równolegle |
| Kiedy się gra | przez tygodnie, drużyny umawiają się same | jeden dzień/weekend, terminarz z góry |
| Kto wpisuje wynik | kapitan zgłasza, rywal potwierdza | prowadzący na boisku, na żywo |
| Zdarzenia w meczu | brak — tylko wynik końcowy | gole, strzelcy, asysty, kartki, MVP |

**Decyzja:** nowe tabele mają **polskie nazwy** (`turnieje`, `turniej_druzyny`, …), więc fizycznie
nie kolidują ze starymi. Sprzątanie starego modułu rozpada się na dwa niezależne kroki:

- **Front usuwamy od razu** (Etap 0): trasy `/turniej/*`, `lib/tournaments.ts`,
  `lib/tournamentLabels.ts`, `components/tournament/Countdown.tsx`, typy `Tournament*`, flaga
  `SHOW_CUP`, jej wzmianki (`Header.tsx`, `AnnouncementBar.tsx`, `robots.ts`, `check-docs.mjs`),
  trzy wzorce zrzutów.
- **Tabele kasuje osobna migracja** `149_zegnaj_stary_turniej.sql`, uruchamiana świadomie, gdy
  nowy moduł już działa.

Nowe trasy siedzą pod `/turnieje` (liczba mnoga, jak `/wydarzenia`/`/grupy`) — `/turniej/[id]`
łapałby stare `/turniej/drabinka` jako segment dynamiczny.

## 3. Zasady, których plan nie łamie

| Zasada | Jak ją trzymamy |
|---|---|
| Brak własnego backendu | Supabase + RLS. Operacje wymagające więcej uprawnień → `SECURITY DEFINER` |
| Komponenty nie omijają `lib/` | Siedem plików w `lib/`, zero `supabase` w komponentach |
| RLS po cichu unieważnia UPDATE | Wszystko przez `zaktualizujJedenWiersz()` |
| `useSearchParams()` wywala build | Zakładki z `window.location.search` w `useEffect` |
| Mobile-first bezwzględnie | Zero `max-*:`, rozszerzanie przez `sm:`/`md:`/`lg:` |
| Kolory niosą stałe znaczenie | Zero nowych znaczeń dla różowego/niebieskiego/pomarańczowego/szarego |
| Migracja przeżywa drugie uruchomienie | `IF NOT EXISTS`, `DROP … IF EXISTS` |
| Nowy typ powiadomienia = trzy listy | migracja + `ikonyPowiadomien.ts` + `ustawieniaPowiadomien.ts` |
| Kolumnowe granty | `turniej_druzyny.kontakt_*` — `REVOKE SELECT`, jak `event_participants` od `127` |
| Nie dotykamy `EventDetailClient.tsx` | Zero zmian w `events`/`event_participants`/tym pliku |

**Twarda granica:** moduł nie modyfikuje ani jednej istniejącej tabeli poza jedną nullowalną
kolumną `notifications.turniej_id`.

## 4. Role i cykl życia

| Rola | Skąd się bierze | Co może |
|---|---|---|
| Organizator | `turnieje.organizator_id` | wszystko; jedyny nadający uprawnienia i kasujący turniej |
| Współorganizator | `turniej_osoby.moze_edytowac` | ustawienia, terminarz, drużyny, ogłoszenia |
| Prowadzący | `moze_prowadzic` lub `turniej_mecze.prowadzacy_id` | start/koniec meczu, gole, kartki, MVP |
| Kapitan | `turniej_druzyny.kapitan_id` | skład swojej drużyny, kontakt, przekazanie, wycofanie |
| Zawodnik | wiersz w `turniej_zawodnicy` | widzi wszystko zalogowane; nic nie edytuje |

Prowadzący ma dwie niezależne drogi uprawnienia (ogólną i punktową na jeden mecz) — bo
organizator na 3 boiskach nie może sam prowadzić wszystkiego.

**Stany:** `szkic → zapisy → zamkniete_zapisy → trwa → zakonczony`, plus `odwolany` z dowolnego
stanu. Szara plakietka „Zapisy zamknięte” to ten sam `slate-*` i to samo znaczenie co
`lib/stanZapisow.ts` (migracja `141`).

**Trzy formaty:** `grupy_puchar` (domyślny, 8–32 drużyn), `puchar` (drabinka od razu, plażówka/
streetball), `liga` (3–8 drużyn, tylko tabela).

## 5. Ściana logowania

Egzekwowana w **RLS**, nie w interfejsie (klucz `anon` jest jawny w paczce JS).

| Widzi każdy (`anon`) | Wyłącznie zalogowany |
|---|---|
| nazwa, sport, format, miejsce, daty, regulamin, opis | składy drużyn (imiona, numery) |
| lista drużyn (same nazwy), grupy, rozstawienie | kto strzelił, kto miał asystę |
| terminarz: kto z kim, kiedy, gdzie | klasyfikacja strzelców i asyst |
| wynik meczu i status | kartki |
| tabela grupy i drabinka | MVP meczów i MVP turnieju |
| ogłoszenia organizatora | kontakt do kapitana (tylko organizator) |

Trzy niezależne uzasadnienia: **konwersja** (wynik 3:2 + „Kto strzelił? Zobacz po zalogowaniu” —
najmocniejszy moment na konto), **RODO** (imiona kilkudziesięciu osób nie w otwartym internecie,
ta sama decyzja co migracja `030`), **SEO** (publiczne = dokładnie to, co warto indeksować).

UI: zwykła karta z przyciskami logowania w miejscu składu, bez rozmazanych treści i ciemnych
wzorców. Prywatność turnieju (`widocznosc = 'na_link'`) działa jak prywatność meczu: nie ma go na
liście, ale wiersz jest czytelny — nie udajemy kontroli dostępu, której nie ma.

## 6. Schemat bazy (10 nowych tabel, zero zmian w istniejących)

`turnieje`, `turniej_osoby`, `turniej_druzyny`, `turniej_zawodnicy`, `turniej_grupy`,
`turniej_areny`, `turniej_mecze`, `turniej_zdarzenia`, `turniej_ogloszenia`, `turniej_blik`.
Pełny SQL → [turnieje-plan-srednie-klocki.md §D](./turnieje-plan-srednie-klocki.md).

**Wynik meczu — zdarzenia rządzą, dopóki nie wejdzie człowiek.** `wynik_a`/`wynik_b` są zapisane
na meczu i to one liczą się do tabeli. Dopóki `wynik_recznie = false`, trigger przelicza wynik od
zera z sumy zdarzeń. Gdy organizator poprawi wynik ręcznie, `wynik_recznie` staje się `true` i
zdarzenia przestają go ruszać — UI mówi to wprost.

**BLIK w osobnej tabeli** (`turniej_blik`) — ten sam powód co `event_blik` (migracja `120`): RLS
jest wierszowe, a wiersz `turnieje` czyta każdy.

## 7. RLS i funkcje w bazie

Pięć funkcji pomocniczych `SECURITY DEFINER` (`czy_organizator_turnieju`, `czy_zarzadza_turniejem`,
`czy_zarzadza_druzynami`, `czy_prowadzi_mecz`, `czy_kapitan_druzyny`). Cztery RPC wołane z
przeglądarki (`dolacz_do_druzyny_kodem`, `zakoncz_mecz`, `przesun_terminarz`, `turniej_kontakty`).
Trzy wyzwalacze (`nadaj_kod_druzynie`, `przelicz_wynik_meczu`, `propaguj_zwyciezce`).

**Zero widoków SQL** — widok w Postgresie omija RLS tabel, na których stoi. Tabelę, drabinkę i
statystyki liczy przeglądarka z wierszy, które i tak pobrała (czyste funkcje, testowalne bez
bazy, skala do tego wystarcza: 64 drużyny, ~200 meczów, ~1000 zdarzeń).

## 8. Trasy i układ ekranów

`/turnieje`, `/turnieje/nowe`, `/turnieje/[id]` (5 zakładek: Terminarz/Drużyny/Tabela/
Statystyki/Info), `/turnieje/[id]/panel` (6 zakładek, osobna trasa — nie szósta zakładka, bo
`/wydarzenia/[id]` już raz popełniło błąd renderowania pustej zakładki „Ustawienia” dla
każdego), `/turnieje/[id]/zglos`, `/turnieje/[id]/druzyna/[id]`, `/turnieje/[id]/mecz/[id]`,
`/t/[kod]` (lądowanie z linku drużyny, jak `/d/`/`/g/`).

Domyślna zakładka zależy od stanu turnieju: `zapisy`→Info, `zamkniete_zapisy`→Drużyny,
`trwa`→Terminarz, `zakonczony`→Tabela.

Kreator: 4 kroki (Podstawy/Miejsce/Format/Zapisy), z kartą „Tak zobaczą to kapitanowie” +
wyliczeniem czasu trwania turnieju — najważniejsze zdanie w kreatorze.

## 9. Terminarz — generator

Cztery czyste funkcje w `lib/turniejFormat.ts`: `rozlosujGrupy` (wężyk), `meczeKazdyZKazdym`
(karuzela, wolne losy przy nieparzystej), `zbudujDrabinke` (wolne losy przy braku potęgi dwójki,
rozstawienie krzyżowe), `ulozHarmonogram` (rozkład na areny i godziny, bez kolizji drużyny w
slocie, ostrzeżenie przy grze dwóch meczów pod rząd).

**Najmocniejsza funkcja organizatorska:** „Turniej się opóźnia — przesuń resztę o 10 minut”.
Jeden przycisk, powiadomienia do wszystkich dotkniętych drużyn.

## 10. Konsola prowadzącego

Najważniejszy ekran modułu — używany na stojąco, w słońcu, jedną ręką. „Rozpocznij mecz” →
„Gol” (arkusz z dołu ekranu ze składem, jedno dotknięcie) → opcjonalna asysta → „Cofnij
ostatnie” zawsze widoczne → „Zakończ mecz” (karne przy remisie w pucharze, opcjonalny MVP).

Zapisy optymistyczne; nieudany zapis dostaje stan „niezapisane” + „Ponów”
(`zPonowieniemPoOdswiezeniu()`). **Świadomie bez trybu offline** (za duży projekt, zrobiony po
łebkach gorszy niż jego brak) i **bez Supabase Realtime** (wymaga ręcznego włączenia replikacji —
klasa „działa u mnie, milczy na produkcji”, jak `pg_cron`). Odświeżanie co 20 s dla widzów.

## 11. Tabela, drabinka, statystyki

Rozstrzyganie remisów: punkty → różnica bramek → bramki zdobyte → **ręczne ustawienie
organizatora** → alfabetycznie. Nie „mecz bezpośredni” — w turnieju jednodniowym ktoś musi
zdecydować teraz, a reguła jest zawsze napisana pod tabelą.

Drabinka na telefonie: **pionowa lista rund** (nie drzewko — nieczytelne na 360px), drzewko z
liniami dopiero od `md:`.

## 12. Powiadomienia

Dziewięć typów. Najlepsze: `turniej_nastepny_mecz` — „Wasz mecz jest następny — Boisko 2” w
momencie, gdy kończy się poprzedni mecz na tej arenie. Zero crona, zero zegara. Kolory z
istniejącej konwencji: niebieski tylko tam, gdzie trzeba zdecydować (zgłoszenie drużyny),
różowy tylko ogłoszenie (bo to wiadomość), reszta neutralna.

## 13. Czego nie było w zleceniu, a musi być

Remis w fazie pucharowej (karne), walkower, liczba drużyn spoza potęgi dwójki (wolne losy),
nieparzysta grupa (pauza), wycofanie drużyny po losowaniu, lista rezerwowa drużyn (bez
auto-awansu — ta sama zasada co przy meczu), jeden gracz w dwóch drużynach (zablokowane
indeksem), akceptacja regulaminu, areny (turniej na 12 drużyn musi chodzić na 2–3 boiskach
naraz), ogłoszenia, eksport kontaktów, obraz OG z wynikiem.

**Najmocniejszy pomysł: „Zamień drużynę w ekipę”.** Po turnieju kapitan jednym przyciskiem robi z
drużyny grupę w Bojo z całym składem. Turniej kończy się nie pustką, tylko dwunastoma ludźmi w
ekipie na przyszły tydzień.

**Kolorów drużyn nie ma w v1** — kolidowałyby z rezerwacją różowy/niebieski/pomarańczowy w
AGENTS.md. Konsola pokazuje pełne nazwy dużą czcionką.

## 14. Czego świadomie NIE robimy

Czatu turniejowego (osobna decyzja — czwarte źródło w `/rozmowy`), głosowania graczy na MVP
(prowadzący wybiera), płatności online (BLIK + odhaczanie, jak przy meczach), rezerwacji obiektu
(`FEATURE_RESERVATIONS` zostaje wyłączone), integracji z `get_player_stats` (statystyki turniejowe
żyją osobno), trybu offline, Realtime, widoku na TV/projektor, wielu sportów w jednym turnieju,
sędziów do wynajęcia.

## 15. Etapy wdrożenia

5 etapów, 5 PR-ów, każdy z zielonym CI, cały czas pod flagą `SHOW_TURNIEJE = false`:

0. **Fundament i porządki** (migracja 145) — usunięcie starego modułu, turniej/drużyny/skład,
   zgłoszenia, kreator, panel (Drużyny/Ludzie/Ustawienia).
1. **Terminarz** (migracja 146) — grupy, areny, mecze, generator, przesuwanie terminarza.
2. **Rozgrywka na żywo** (migracja 147) — zdarzenia, konsola prowadzącego, propagacja drabinki.
3. **Tabela i statystyki** (bez migracji) — tabela, drabinka na telefonie, klasyfikacje.
4. **Domknięcie i odmrożenie** (migracje 148, 149) — ogłoszenia, BLIK, „zamień w ekipę”,
   kasowanie starego modułu, `SHOW_TURNIEJE = true`.

Dolna nawigacja (Mecze·Szukaj·＋·Rozmowy·Ekipy) zostaje **nietknięta** — wejście przez `/profil`,
`/moje-gry`, link udostępniony.

## 16. Testy, bramki, dokumentacja

Vitest dla wszystkich czystych funkcji (`turniejFormat`, `turniejTabela`, `turniejStatystyki`,
`turniejKreator`). Nowa sekcja w `supabase/test/rls.sql` (jedyne miejsce sprawdzające granicę
dostępu od strony bazy). `e2e/wizualne.spec.ts` (−3 stare trasy, +8 nowych). `e2e/turniej.spec.ts`
za logowaniem, każdy zapis przez `zeSprzataniem()`.

Dokumentacja aktualizowana w tym samym PR-ze: `docs/baza-danych.md`, `docs/domena.md`,
`docs/funkcje.md`, `docs/llm-context.md` (+ `sync:llm-context`), `llms.txt` (dopiero po
odmrożeniu), `AGENTS.md`, `BACKLOG.md` §6, `docs/wizja.md`.

## 17. Ryzyka

Migracje ręczne (idempotentne + opis w PR), zła polityka RLS (asercje w `rls.sql`, nie w UI),
cichy UPDATE (zawsze `zaktualizujJedenWiersz()`), rozrost powierzchni (flaga do końca, zero
zmian w `events`/`EventDetailClient.tsx`/`BottomNav.tsx`), konsola przy słabym zasięgu (jawny
stan „niezapisane”), build wywalający się na Vercelu (`window.location.search`, nie
`useSearchParams()`), obiecanie turnieju przed czasem (`zakazaneFrazy.ts` do Etapu 4).

## 18. Decyzje — zatwierdzone 2026-09-13

1. **Stary moduł turniejowy znika** — front w Etapie 0, tabele migracją `149` w Etapie 4.
2. **Polskie nazwy tabel** (`turnieje`, `turniej_*`).
3. **Ściana logowania** na składach i statystykach (RLS, nie UI).
4. **MVP wybiera prowadzący** (v1), bez głosowania graczy.
5. **Wpisowe bez przepływu pieniędzy** — kwota + BLIK + odhaczanie „opłacone”.
