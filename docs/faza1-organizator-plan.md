# Faza 1 — organizator bez wątpliwości: plan wdrożenia

> **Status: PLAN ZATWIERDZONY 2026-09-23, we wdrożeniu.**
> Siódma runda przejścia ścieżki organizatora (poprzednie: `O`/`E`/`P`/`R`/`S`
> w [przeplyw-organizatora.md](./przeplyw-organizatora.md)). Ustalenia mają numery
> `F-n`. Stan repo: `ee233ac` (2026-09-22), 159 migracji.
>
> **F-2 ODRZUCONE decyzją właściciela (2026-09-23).** Zarzut: liczba wierszy
> w `event_participants` nie jest liczbą ludzi na boisku — mogą grać osoby spoza
> Bojo, nigdy nie dopisane ani przez siebie, ani przez organizatora. „10/14 w bazie”
> nie znaczy „przyszło 10 osób”, więc sugerowanie organizatorowi „podziel na 10”
> byłoby fałszywą pewnością gorszą niż dzisiejszy brak przeliczenia. Sekcja F-2
> zostaje w dokumencie jako zapis odrzuconego pomysłu i uzasadnienia — PR-A
> zawiera wyłącznie F-1.
>
> Kryterium doboru (z [strategia.md §0](./strategia.md) i skilla fazy 1): organizator
> ma **wiedzieć, jak działa i co się kiedy stanie**, ustawiać wszystko **szybko**,
> a Bojo ma być **niezawodne** i **nie obiecywać tego, czego nie ma**. Każda pozycja
> niżej wypełnia lukę wobec tego kryterium albo daje organizatorowi argument, którym
> przebija ścianę logowania u graczy. Pozycji „ładniej by było” tu nie ma.

---

## 0. Jak ta runda sprawdzała przepływ

| Co | Wynik |
|---|---|
| `tsc --noEmit` | czysto |
| Vitest | **1525 / 1525** zielonych, 133 pliki |
| Build produkcyjny (atrapy kluczy) | zielony |
| Testy klikalności (Playwright, telefon + komputer) | wszystkie zielone |
| Scenariusze za logowaniem | **nie dało się uruchomić**: obrazy Supabase (`public.ecr.aws`) i Docker Hub są w tym środowisku zablokowane przez proxy (403 / 429), więc stos nie wstał. Wyniki `scenariusze.spec.ts` i `wizualne.spec.ts` z tej sesji są niemiarodajne i nie są tu cytowane |
| Migracje od zera + seedy + RLS (`baza-testowa.sh`) | zielone; na tej bazie odtworzono zachowanie `wyslij_przypomnienia()` w transakcji z `ROLLBACK` |
| Baza produkcyjna | **wyłącznie zapytania agregujące (SELECT, bez danych osobowych)**; wykluczone mecze z markerami seedów i konta `@example.com` |

### Liczby z produkcji, na których stoi ten plan

Stan 2026-09-22, po odfiltrowaniu seedów i kont testowych (zostaje 119 meczów, 11
organizatorów — w dużej części to nadal sam zespół, więc to są **sygnały**, nie
statystyka):

| Pomiar | Wartość | Co z tego wynika |
|---|---|---|
| Płatne mecze rozegrane | 57 | |
| …w tym **bez ani jednej odhaczonej wpłaty** | **46 (81%)** | rozliczenie, główna obietnica dla organizatora, praktycznie nie jest używane |
| …w tym **niepełny skład wg `event_participants`** | 44 (77%) | **nie jest już przesłanką żadnego ustalenia** — liczba wierszy w bazie nie jest liczbą ludzi na boisku (F-2 odrzucone z tego właśnie powodu); wiersz zostaje w tabeli jako ślad odrzuconego rozumowania |
| Mecze z włączonym wynikiem, rozegrane | 88 | |
| …z wpisanym wynikiem | 9 | bez zmian od audytu z sierpnia (6/122); nie ruszamy tu wyniku, patrz §6 |
| Wpisy gości bez konta, przejęte przez konto | **0** | konwersja gość → konto nie działa w ogóle (`F-5`, `F-6`) |
| Mecze utworzone od 2026-09-02, dla których przypomnienie „jutro grasz” **nie miało szansy wyjść** | 2 z 15 | a 7 z 15 powstało w dniu meczu albo dzień wcześniej (`F-3`) |
| Konta z włączonym pushem | 4 z 70 | przypomnienie realnie dociera mailem (`konfiguracja_poczty` jest wypełniona, trzy zadania `pg_cron` aktywne) |

---

## 1. Streszczenie: co proponuję i dlaczego w tej kolejności

Wspólny mianownik: **Bojo robi dla organizatora dobre rzeczy, ale w trzech miejscach
mówi mu nieprawdę albo nie mówi nic** — i to są dokładnie te miejsca, w których
organizator porównuje Bojo z postem na grupie i ankietą na WhatsAppie.

| # | Ustalenie | Wartość dla organizatora | Koszt | Migracja |
|---|---|---|---|---|
| **F-1** | Organizator jest **własnym dłużnikiem** w każdym widoku rozliczenia i w przypomnieniu po meczu | Rozliczenie przestaje kłamać przy pierwszym użyciu | mały | tak (`160`, tylko `CREATE OR REPLACE`) |
| **F-2** | ~~Koszt obiektu nie przelicza się na faktyczny skład~~ | **ODRZUCONE** — patrz notatka na górze dokumentu | — | — |
| **F-3** | Organizator **nie wie, co i kiedy Bojo zrobi za niego**; „przypomnienie wyśle się samo” bywa nieprawdą | Pewność zamiast zgadywania: kiedy przypomnienie, co z rezerwą, kto nic nie dostanie | mały | nie |
| **F-4** | Brak **„Wyślij skład na grupę”** — najczęstszego posta organizatora na WhatsAppie | Bojo robi to, co ankieta WhatsApp, i przy okazji znowu wkleja link do meczu | mały | nie |
| **F-5** | „Powtórz mecz” **nie zaprasza** poprzedniego składu | Cotygodniowa ekipa (przesłanka strategiczna) dostaje zaproszenie bez pisania do nikogo; obietnica z maila „organizator dopisze Cię jednym kliknięciem” zaczyna być prawdą | mały | nie |
| **F-6** | Okno gościa i ekran po zapisie **nie tłumaczą**, po co e-mail i po co konto; obiecują „gry w okolicy” | Niższa bariera zapisu i uczciwy powód, żeby założyć konto | mały (copy) | nie |
| **F-7** | Cztery miejsca obiecują, że mecz **„zobaczą gracze z okolicy”** | Zgodność z zasadą „nie obiecywać, czego nie ma”, pilnowana testem | mały (copy + test) | nie |
| **F-8** | „Jutro” w kreatorze i `min` pól daty liczone **w UTC** | Domyślna data nie jest „dziś” po północy | mały | nie |
| **F-9** | `BACKLOG.md §2` twierdzi, że `SHOW_TURNIEJE` jest włączona; w kodzie jest `false` | Dokumentacja przestaje wprowadzać w błąd | 1 linia | nie |

**Kolejność wdrożenia = kolejność PR-ów:** `PR-A` (F-1 — rozliczenie, jedyna
migracja), `PR-B` (F-3, F-4, F-5 — pewność i ekipa), `PR-C` (F-6, F-7, F-8, F-9 —
copy i drobne). Każdy PR jest samodzielny i da się go wycofać bez ruszania
pozostałych. Uzasadnienie kolejności: rozliczenie to jedyna obietnica z landingu
(„Wiadomo, kto ile płaci”), którą dane z produkcji pokazują jako **nieużywaną**,
a F-1 psuje ją przy pierwszym kontakcie.

**Zgodność z moratorium z [analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md) (A.1):**
żadna pozycja nie dokłada flagi funkcji ani nowej encji domenowej. Jedyna zmiana
schematu to podmiana ciała istniejącej funkcji (`160`) — bez nowej kolumny, bo
F-2 odrzucone.

---

## 2. PR-A — rozliczenie, które się zgadza

### F-1. Organizator jest własnym dłużnikiem

**Problem (potwierdzony).** Organizator, który gra, siedzi w `regulars` jak każdy
inny. Jego wiersz ma `has_paid = false`, więc:

- panel „Podział kosztów” liczy go w „Opłaconych X / Y” i pokazuje przy nim
  przełącznik wpłaty — do samego siebie,
- „Wyślij rozliczenie ekipie” (`lib/settlementShare.ts`) wypisuje go w
  **„Zaległości: [imię organizatora]: 17,86 zł”** na czacie grupy,
- karta „Po meczu” mówi „1 osoba jeszcze nie oddała”, gdy wszyscy oddali,
- `/moje-gry → Historia → „Do rozliczenia”` trzyma mecz na liście w nieskończoność
  (`unpaidCount` w `lib/events.ts`),
- przypomnienie `po_meczu_do_domkniecia` (`144`, blok C) wysyła mu „odhacz wpłaty —
  1 osoba jeszcze nie oddała”. **Odtworzone na lokalnej bazie**: mecz płatny
  z samym organizatorem w składzie → dokładnie ten tekst.

Na produkcji w 46 rozegranych płatnych meczach organizator figuruje jako nieopłacony
(liczone przed odfiltrowaniem seedów, więc to górna granica).
To jest pierwszy ekran rozliczenia, jaki organizator widzi, i pierwsze zdanie
wysłane jego ekipie — z błędem, który podważa zaufanie do całej reszty.

**Decyzja projektowa: helper, nie zapis w danych.** Rozważone i odrzucone:
automatyczne `has_paid = true` dla wiersza organizatora przy tworzeniu meczu —
zmienia dane, nie naprawia 46 istniejących meczów, a przy edycji kosztu po
utworzeniu (mecz darmowy → płatny) znowu się rozjeżdża. Reguła „organizator płaci
za obiekt, nie oddaje sam sobie” jest regułą **widoku i liczenia**, więc żyje
w jednym helperze i w jednym warunku SQL.

**Rozwiązanie.**

1. `frontend/src/lib/payments.ts` — nowy helper (jedno źródło reguły):

   ```ts
   /**
    * Czy ten wpis składu jest winien wpłatę organizatorowi. Organizator płaci za
    * obiekt i zbiera od reszty — jego własny wiersz nigdy nie jest „zaległością”.
    * Lustro warunku w `wyslij_przypomnienia()` (migracja 160, blok C).
    */
   export function winienWplate(
     p: Pick<EventParticipant, 'userId' | 'isReserve' | 'pendingApproval' | 'rsvp'>,
     organizerId: string,
   ): boolean {
     return !p.isReserve && !p.pendingApproval && p.rsvp !== 'maybe'
       && p.userId !== organizerId;
   }
   ```

2. `app/wydarzenia/[id]/EventDetailClient.tsx`, `platnosciSection`:
   - `const placacy = regulars.filter((p) => p.userId !== event.organizerId);`
   - „Opłaconych”, „Zebrano X z Y”, lista z przełącznikami, `handleWszyscyOddali`
     i `liczbaNieoplaconych` dla `PoMeczuCard` liczą z `placacy`, nie z `regulars`.
   - Gdy organizator jest w składzie, **nad listą** jeden wiersz bez przełącznika:
     awatar, „Ty · płacisz za obiekt” (dla delegata: „{imię} · organizator, płaci
     za obiekt”), kwota jego części szarym drukiem. Bez tego wiersza organizator
     szukałby siebie na liście i wnioskowałby, że coś zniknęło.
   - Przełącznik `PoMeczuCard.pokazWszyscyOddali` warunkuje się `placacy.length > 0`.
3. `lib/settlementShare.ts` → `tekstRozliczenia(e, sklad, nieobecni, organizerId)`:
   nowy parametr, filtr `p.userId !== organizerId` przed liczeniem `zaleglosci`,
   `zebrano` i `oczekiwane`. Wywołanie w `handleWyslijRozliczenie` przekazuje
   `event.organizerId`. Parametr **wymagany** (nie opcjonalny) — żeby żadne
   przyszłe wywołanie nie wróciło po cichu do starego zachowania.
4. `lib/events.ts`, zapytanie pod `/moje-gry` (dziś linia ~1534):
   `event_participants(id, user_id, is_reserve, pending_approval, has_paid, rsvp)`
   i `unpaidCount` liczone przez ten sam warunek co `winienWplate` z
   `row.organizer_id`. `user_id` i `rsvp` są w grantach kolumnowych `127` (czyta je
   już `getEvent()`), więc zapytanie nie wywróci się na uprawnieniach.
5. Migracja `160` (patrz niżej, część B): blok C w `wyslij_przypomnienia()` dostaje
   `AND x.user_id IS DISTINCT FROM e.organizer_id` we wszystkich trzech
   podzapytaniach liczących zaległości. **Bloki A i B bez zmian** — ciało funkcji
   kopiujemy z `144` słowo w słowo i zmieniamy wyłącznie te trzy warunki.

**Testy.**
- `__tests__/payments.test.ts`: `winienWplate` — organizator (false), gracz (true),
  rezerwowy / oczekujący / obserwujący (false).
- `__tests__/settlementShare.test.ts`: organizator w składzie z `hasPaid = false`
  nie pojawia się w „Zaległości”, a „zebrane X z Y” go pomija; sam organizator →
  „Wszyscy oddali, dzięki!”.
- `__tests__/myEvents.test.ts`: mecz, w którym nie zapłacił wyłącznie organizator,
  nie trafia do `doRozliczenia()`.
- `supabase/test/przypomnienia.sql`: nowa asercja — płatny mecz wczorajszy
  z samym organizatorem w składzie i bez wyniku do wpisania → **zero** powiadomień
  `po_meczu_do_domkniecia`; z organizatorem i jednym nieopłaconym graczem →
  treść „1 osoba jeszcze nie oddała”.

### F-2. Koszt obiektu dzielony przez faktyczny skład — ODRZUCONE

**Pomysł (odrzucony 2026-09-23).** Kreator pyta domyślnie o „Koszt wynajmu
obiektu” i dzieli go przez liczbę **miejsc**; do bazy trafia wyłącznie wynik
dzielenia. Plan proponował zapamiętanie kwoty za obiekt i przycisk „Podziel na
N osób”, liczący N z `regulars.length` (wierszy w `event_participants` bez
rezerwy/oczekujących/obserwujących).

**Dlaczego to jest błędne rozumowanie, nie tylko szczegół do poprawienia.**
`event_participants` to lista ludzi **zapisanych przez Bojo**, nie lista ludzi
**na boisku**. Na realnym meczu grają też osoby, których nikt nie dopisał do
aplikacji: kolega przyprowadzony w ostatniej chwili, ktoś, kogo organizator
wpuścił bez zapisu, bo brakowało do kompletu. `10/14` w bazie mówi wyłącznie
„10 osób przeszło przez Bojo”, nie „przyszło 10 osób”. Przycisk sugerujący
„podziel na 10” byłby **fałszywą pewnością** — coś, czego ten plan wprost
zabrania sobie robić (patrz nagłówek dokumentu, kryterium „nie obiecywać tego,
czego nie ma”). To jest gorsze niż dzisiejszy brak przeliczenia, bo dzisiejszy
brak przynajmniej nie kłamie liczbą.

Liczba „77% rozegranych płatnych meczów ma niepełny skład wg bazy” (§0) zostaje
w dokumencie jako fakt o danych, ale przestaje być przesłanką jakiejkolwiek
zmiany — właśnie dlatego, że nie wiadomo, ile z tych 44 meczów miało realnie
niepełny skład, a ile tylko niepełny **zapis**.

**Co z tego zostaje w produkcie: nic nowego.** Organizator, który chce policzyć
inaczej niż „koszt / liczba miejsc”, robi to dziś poza Bojo (w głowie albo
w kalkulatorze) — dokładnie tak, jak przy mniej pewnych danych robi to teraz.
Gdyby Bojo miało kiedyś prowadzić realną listę obecności (osobny, wcześniej
odrzucony pomysł — `track_attendance`, patrz [przeplyw-organizatora.md, Faza
7](./przeplyw-organizatora.md)), przeliczenie kosztu miałoby sens na nowo; bez
tego jedyną wiarygodną podstawą jest to, co organizator wpisał sam.


---

## 3. PR-B — organizator wie, co się stanie, a ekipa dostaje to, co z WhatsAppa

### F-3. „Co Bojo zrobi za Ciebie” — oś czasu meczu dla organizatora

**Problem.** Bojo ma dziś trzy zegary (`bojo-przypomnienia` 16:00 UTC,
`bojo-maile-gosci` 16:10 UTC, `bojo-kolejka-rezerwy` co 15 min) i organizator nie
widzi żadnego z nich. Panel „Mecz gotowy” mówi zawsze „Przypomnienie wyśle się
samo, Ty wyślij tylko link” — a to jest **nieprawda**, gdy mecz powstał po 18:00
dzień przed terminem albo w dniu meczu (`wyslij_przypomnienia()` bierze wyłącznie
`event_date = dziś + 1`). Kreator domyślnie ustawia **jutro**, a 7 z 15 ostatnich
meczów powstało w dniu meczu albo dzień wcześniej. Organizator, który uwierzył
zdaniu, nie przypomina ręcznie — i skład nie dostaje nic.

Do tego organizator nie wie: że goście dopisani przez niego (bez adresu e-mail) nie
dostaną **żadnej** wiadomości; ile czasu ma rezerwowy na decyzję; że dzień po meczu
Bojo przypomni mu o rozliczeniu.

**Rozwiązanie: czysta funkcja + mała karta. Zero migracji.**

1. `frontend/src/lib/harmonogramMeczu.ts`:

   ```ts
   /** Lustro `cron.schedule('bojo-przypomnienia', '0 16 * * *')` z migracji 129.
    *  Pilnuje go test czytający plik migracji — zmiana godziny w SQL bez zmiany
    *  tutaj wywraca Vitest. */
   export const PRZYPOMNIENIA_UTC = { godzina: 16, minuta: 0 } as const;

   export type PozycjaHarmonogramu =
     | { klucz: 'przypomnienie'; kiedy: Date }          // „Jutro/śr. ok. 18:00 skład dostanie przypomnienie”
     | { klucz: 'przypomnienie_za_pozno' }               // „Na automatyczne przypomnienie jest za późno”
     | { klucz: 'rezerwa'; minuty: number }              // „Zwolnione miejsce: pierwsza osoba z rezerwy ma 3 h na decyzję”
     | { klucz: 'bez_wiadomosci'; ile: number }          // „N osób nie dostanie żadnej wiadomości (bez konta i bez e-maila)”
     | { klucz: 'po_meczu'; kiedy: Date };               // „Dzień po meczu przypomnimy Ci o wyniku / rozliczeniu”

   export function harmonogramMeczu(
     e: Pick<EventItem, 'date' | 'costGrosze' | 'trackResults' | 'reserveEnabled' | 'reserveClaimMinutes' | 'status'>,
     sklad: Pick<EventParticipant, 'isGuest' | 'userId' | 'maGuestEmail' | 'isReserve' | 'pendingApproval' | 'rsvp'>[],
     teraz: Date = new Date(),
   ): PozycjaHarmonogramu[]
   ```

   - Chwila przypomnienia = `(date − 1 dzień)` o 16:00 **UTC** jako `Date`;
     formatowanie do czasu polskiego robi `Intl` (`timeZone: 'Europe/Warsaw'`),
     więc zimą wyjdzie 17:00, latem 18:00 — dokładnie jak cron.
   - `przypomnienie_za_pozno`, gdy `teraz >= chwila`.
   - `bez_wiadomosci`: wpisy `isGuest && !userId && !maGuestEmail` w składzie.
   - `po_meczu` tylko, gdy `costGrosze > 0 || trackResults` (lustro warunku bloku C).
   - Mecz odwołany → pusta lista.
2. `components/events/HarmonogramMeczu.tsx` — karta dla `isOwner || canManageEvent`,
   `!eventStarted && !isCancelled`, na zakładce „Skład” **pod** kartą „Kiedy
   i gdzie”. Nagłówek „Co Bojo zrobi za Ciebie”, 2–4 wiersze z ikoną (`Clock`,
   `ListOrdered`, `MailX`, `Banknote`). Mobile-first: jedna kolumna, `min-w-0`
   przy tekście (pułapka `truncate` z AGENTS.md). Wiersz `przypomnienie_za_pozno`
   ma przycisk „Wyślij link teraz” → istniejące `handleShare`. Wiersz
   `bez_wiadomosci` ma przycisk „Pokaż kogo” → przewija do składu.
3. Panel „Mecz gotowy”: stałe zdanie zastępuje pierwsza pozycja harmonogramu:
   „Przypomnienie pójdzie do składu jutro ok. 18:00. Ty wyślij tylko link.” albo
   „Mecz jest za wcześnie na automatyczne przypomnienie: wyślij link teraz.”
4. Podsumowanie przed publikacją (`app/wydarzenia/nowe/PodsumowanieMeczu.tsx`,
   `R-6`, okolice linii 150): stałe zdanie o przypomnieniu zastępuje wynik tej
   samej funkcji, liczony dla daty z formularza.

**Test anty-rozjazdowy (najważniejszy element F-3):**
`__tests__/harmonogramMeczu.test.ts` czyta `supabase/migrations/*.sql`, znajduje
**ostatnie** `cron.schedule('bojo-przypomnienia', '<m> <h> * * *'` i porównuje
z `PRZYPOMNIENIA_UTC`; tak samo sprawdza, że ostatnia definicja
`wyslij_przypomnienia` zawiera `event_date = v_dzis + 1` i `v_dzis - 1`. Wzorzec:
`typyPowiadomien.test.ts`. Plus przypadki: mecz za 3 dni (przypomnienie
zaplanowane), jutro po 18:00 (za późno), dziś (za późno), zimą (17:00 lokalnie),
darmowy bez wyniku (brak `po_meczu`), dwóch gości bez e-maila (`ile: 2`).

**Rozważone i odrzucone w tej rundzie:** poranne przypomnienie „dziś grasz” dla
meczów, które przegapiły wieczorny przebieg. Wymaga nowego typu powiadomienia
(trzy listy do zsynchronizowania, `typyPowiadomien.test.ts`), nowego zadania
cron i nowego szablonu maila — czyli dokładnie tego, na co moratorium z analizy
GTM zakłada bramkę. F-3 usuwa **nieprawdę**; brak funkcji organizator obsłuży
jednym kliknięciem „Wyślij link teraz”. Do ponownego rozważenia, gdy liczby
pokażą, że to częsty przypadek.

### F-4. „Wyślij skład na grupę”

**Problem.** Najczęstszy post organizatora na WhatsAppie to nie zaproszenie,
tylko **lista**: „1. Marek 2. Kuba … 12. ___ 13. ___ — brakuje dwóch”. Ludzie ją
kopiują, dopisują się, przeklejają. Bojo prowadzi tę listę lepiej (twardy limit,
rezerwa, kolejność), ale nie umie jej **wysłać** — organizator, który chce
pokazać ekipie stan, robi zrzut ekranu albo przepisuje ręcznie. A każde takie
wysłanie to okazja, żeby link do meczu znowu trafił na czat (argument na ścianę
logowania: „zapisz się pod linkiem, bez konta”).

**Rozwiązanie. Zero migracji.**

1. `lib/eventShare.ts` — `tekstSkladu(e, regulars, rezerwa, stan)`:

   ```
   ⚽ Piłka nożna 7v7 · czwartek, 25 września · 18:00
   Orlik Sołacz

   Skład 10/14:
   1. Marek Kowalski
   2. Kuba Nowak 🧤
   …
   10. Ola Wiśniewska
   11–14: wolne

   Rezerwa: Adam Z., Piotr K.
   Zostały 4 miejsca · 20,00 zł od osoby
   Zapisujesz się bez zakładania konta.
   ```

   - Kolejność = kolejność zapisu (`zapisanoAt`), ta sama co na stronie meczu.
   - 🧤 tylko przy `goalkeepersEnabled`.
   - Linia „Rezerwa” tylko, gdy niepusta; kolejność z `pozycjaWKolejce()`
     (`lib/kolejkaRezerwy.ts`), wpisy z `claimPassed` pominięte.
   - Ostatnie dwie linie **tą samą** logiką co `eventShareText()` (wydzielić
     prywatną funkcję `liniaMiejscICeny(e, stan)` i warunek zdania „bez konta”,
     żeby oba teksty nie mogły się rozjechać).
   - Obserwujący i oczekujący na akceptację — **nie** na liście (nie grają).
   - Imiona tak, jak są w składzie. To nie ujawnia niczego nowego: skład jest
     widoczny na stronie meczu dla każdego z linkiem (`Participants readable by
     all`), a lista trafia do ludzi z tym samym linkiem.
2. `udostepnijSklad()` — `navigator.share({ title, text, url })` z `eventUrl()`
   (podgląd linku działa), fallback do schowka przez `textDoKopiowania()`;
   ten sam wzorzec zwrotny `WynikUdostepnienia` co `shareEvent()`.
3. Przycisk **„Wyślij skład na czat”** (ikona `ListOrdered`) w nagłówku sekcji
   składu na zakładce „Skład”, dla `isOwner || canManageSquad`, `!isCancelled`,
   do startu meczu. Na 320 px: ikona + „Wyślij skład” (pełna etykieta od `sm:`).
4. `lib/analytics.ts`: nowe zdarzenie `'squad_shared'` w `AnalyticsEvent`,
   `track('squad_shared', { eventId })` — żeby po dwóch tygodniach wiedzieć, czy
   organizatorzy tego używają (zgodnie z częścią B analizy GTM).

**Testy.** `eventShare.test.ts`: numeracja, „11–14: wolne” (i „14: wolne” dla
jednego miejsca), komplet bez linii wolnych, rezerwa z kolejnością i bez
odpuszczonych, bramkarz 🧤, zapisy zamknięte („Zapisy zamknięte”, bez zdania
o koncie), zgodność ostatniej linii z `eventShareText()` dla tego samego stanu.
Test klikalności: przycisk mieści się i jest klikalny na telefonie.

### F-5. „Powtórz mecz” zaprasza poprzedni skład

**Problem.** Przesłanka strategiczna (BACKLOG): „mięsem na start są ekipy grające
regularnie”. Gry cykliczne są wyłączone, więc „Powtórz mecz” jest jedynym
narzędziem cotygodniowej ekipy — i kończy się pustym meczem. Organizator musi
znowu wkleić link i czekać, aż każdy wejdzie sam. Tymczasem:

- imienne zaproszenie istnieje (`event_player_invites`, wyzwalacz `067` →
  dzwonek, push, a od `140` także poczta do kont), organizator może je wysłać
  (polityka INSERT z `060`),
- mail `zaloz_konto` do gościa obiecuje wprost: bez konta „organizator nie ma jak
  Cię dopisać na kolejny termin jednym kliknięciem” — czyli **konto ma sens
  właśnie dzięki tej funkcji**, której dziś nie ma w najważniejszym miejscu.

**Rozwiązanie. Zero migracji.** Okno „Powtórz mecz” (`EventDetailClient.tsx`,
`repeatOpen`):

1. Nowy przełącznik pod „Biorę udział”: **„Zaproś skład z tego meczu”**, domyślnie
   **włączony**, podpis policzony: „7 osób z kontem dostanie zaproszenie. 3 osoby
   bez konta: wyślesz im link po utworzeniu.” (druga część tylko, gdy są goście).
2. Odbiorcy: `regulars` z `userId`, bez organizatora; **bez** rezerwy,
   obserwujących i oczekujących (zapraszamy tych, którzy grali).
3. **Mecz przypięty do ekipy (`groupId`) — przełącznika nie ma**, a pod oknem
   jedno zdanie: „Członkowie ekipy dostaną powiadomienie o nowym meczu.” Powód:
   wyzwalacz `072` już powiadamia całą ekipę; zaproszenie dołożyłoby każdemu drugie
   powiadomienie o tym samym.
4. Po `repeatEvent()`: `invitePlayers(newId, ids, { invitedBy: user.id })`
   w osobnym `try` — błąd zaproszeń **nie** cofa meczu; toast „Mecz utworzony,
   zaproszeń nie udało się wysłać. Wyślij link.”. `invitePlayers` robi `upsert`
   z `ignoreDuplicates`, więc ponowienie jest bezpieczne.
5. Panel „Mecz gotowy” po powtórce (już się pokazuje dzięki `?utworzono=1`,
   `S-6`) dostaje linię „Zaproszono N osób z poprzedniego składu” — przekazane
   parametrem `&zaproszono=N`, zdejmowanym z adresu tym samym kodem co
   `utworzono`.
6. `track('repeat_invited', { eventId, ile })` — nowe zdarzenie analityczne.

Lista odbiorców liczona czystą funkcją `odbiorcyPowtorki(regulars, organizerId)`
w `lib/events.ts` (albo `lib/playerInvites.ts`) pod testem: organizator
wykluczony, goście policzeni osobno, rezerwa/obserwujący/oczekujący pominięci.

**Dokumentacja PR-B:** `docs/funkcje.md` (karta harmonogramu, „Wyślij skład”,
zaproszenia przy powtórce), `docs/domena.md` (reguła odbiorców powtórki i
wyjątek dla ekipy), `docs/llm-context.md` + sync.

---

## 4. PR-C — nie obiecywać, czego nie ma; niższa bariera dla gracza

### F-6. Okno „Dołącz bez konta” i ekran po zapisie mówią, po co

**Problem 1 — e-mail bez wyjaśnienia.** Okno zapisu gościa ma dwa pola: „Imię
i nazwisko” i „E-mail”. Nigdzie nie pada, **po co** e-mail ani że nie powstaje
konto i hasło. Dla człowieka, który przyszedł z linku na WhatsAppie, pole e-mail
w obcej aplikacji czyta się jak rejestracja i newsletter — to jest ta sama ściana,
którą organizator próbuje przebić. E-mail **zostaje wymagany** (bez niego gość nie
dowie się o odwołaniu — `O-36`, `P-3`), zmienia się wyłącznie to, co widać.

Zmiana (`EventDetailClient.tsx`, dialog `joinAsGuestDialogOpen`): pod polem
e-mail jedna linia `text-xs text-slate-500`:

> Tylko do wiadomości o tym meczu: zmiana, odwołanie, zwolnione miejsce. Bez hasła
> i bez zakładania konta.

(Bez długiego myślnika — sekcja 11 `check:docs`.)

**Problem 2 — ekran „Świetnie! Jesteś w składzie” obiecuje nieprawdę.** Lista
korzyści konta w oknie po zapisie gościa (`EventDetailClient.tsx` ~5340) oraz na
`/gracz/przejmij/[token]` (`PrzejmijClient.tsx` ~354):

- „Dołączysz do ekipy i dostaniesz powiadomienia o kolejnych meczach” — konto
  nie dołącza do żadnej ekipy,
- „Przejrzysz otwarte gry w okolicy” — otwartych gier jest za mało, co landing
  mówi sam (`LANDING_MISJA.uczciwie`). Na `/gracz/przejmij` stoi przy tym
  plakietka „wczesny etap”, w oknie po zapisie — już nie; dwa ekrany tej samej
  ścieżki mówią to samo różnie.

Tymczasem mail `zaloz_konto` (`supabase/functions/powiadom-goscia/tresc.ts`) ma
listę uczciwą i konkretną. Zmiana: **jedno źródło** w
`frontend/src/content/kontoGoscia.ts`:

```ts
export const KORZYSCI_KONTA = [
  'Na kolejny mecz zapisujesz się jednym kliknięciem, bez wpisywania danych',
  'Organizator zaprosi Cię na następny termin, a Ty dostaniesz powiadomienie',
  'Widzisz wszystkie swoje mecze w jednym miejscu',
] as const;
```

Druga pozycja jest prawdziwa **dopiero po F-5** — stąd PR-C po PR-B. Obie listy
w TSX renderują `KORZYSCI_KONTA`. Funkcja brzegowa (Deno) nie importuje z
frontendu, więc test `__tests__/kontoGoscia.test.ts` czyta `tresc.ts` jako tekst
i sprawdza, że każda pozycja występuje tam dosłownie (lista w mailu zostaje
zaktualizowana do tego samego brzmienia w tym samym PR-ze; wdrożenie funkcji:
Actions → „Wdróż funkcje brzegowe”).

### F-7. „Zobaczą go gracze z okolicy” — cztery obietnice bez pokrycia

Landing jest już uczciwy (`wczesnyEtap`, sekcja „Gdzie jesteśmy dziś, wprost”),
ale to samo zdanie żyje w czterech miejscach bez żadnego zastrzeżenia — w tym
na bramie kreatora, czyli dokładnie tam, gdzie organizator decyduje, czy się
zarejestrować.

| Miejsce | Dziś | Po zmianie |
|---|---|---|
| `components/home/landing/content.ts`, `LANDING_HERO.lead` | „Otwórz mecz publicznie: zobaczą go gracze z okolicy.” | „Otwórz mecz publicznie: trafi na listę otwartych gier w Bojo.” |
| `app/wydarzenia/nowe/page.tsx` (brama, trzeci punkt) | „Otwórz mecz publicznie, a zobaczą go gracze z okolicy” | „Mecz publiczny trafia na listę otwartych gier w Bojo” |
| `EventDetailClient.tsx` ~1694 (okno „Otwórz dla okolicy”) | „Mecz trafi na publiczną listę otwartych gier, zobaczą go gracze z okolicy.” | „Mecz trafi na publiczną listę otwartych gier w Bojo. Graczy szukających meczu dopiero przybywa: najpewniej uzupełnisz skład linkiem do znajomych.” |
| `app/wydarzenia/EventsListView.tsx` ~620 | „Wrzuć własny, zobaczą go gracze z okolicy.” | „Wrzuć własny, trafi na listę otwartych gier.” |

**Bramka, żeby nie wróciło:** dopisać `'zobaczą go gracze z okolicy'`
i `'otwarte gry w okolicy'` do `content/zakazaneFrazy.ts` **oraz** rozszerzyć
test tak, żeby skanował też `app/**/*.tsx` i `components/**/*.tsx` pod te dwie
frazy (dziś lista dotyczy wyłącznie `content/*.ts` — to jest dokładnie powód, dla
którego zdania w TSX przeżyły wcześniejsze porządki). Zdania misji w
`content/dlaczego.ts` i `content/oBojo.ts` („docelowo … znajdzie w okolicy”) nie
pasują do tych fraz i zostają — to jest deklaracja celu, nie obietnica funkcji.

Sprawdzić przed commitem: `landingContent.test.ts` i `tresciStron.test.ts`
(zakazane frazy + bramka „nie zaprzeczaj funkcji, która jest” z `P-8`).

### F-8. „Jutro” w UTC

`tomorrowStr()` w kreatorze i `min={new Date().toISOString().slice(0, 10)}`
w polach daty liczą datę w **UTC**. Między północą a 2:00 czasu polskiego (latem;
zimą do 1:00) domyślne „jutro” w kreatorze jest **dzisiejszą** datą, a `min` pola
daty dopuszcza wczoraj. Dzień tygodnia pod datą (`R-7`) i podsumowanie łapią to
przed publikacją, więc to drobiazg — ale to jest drobiazg dokładnie w polu, które
audyt nazywa najczęstszą pomyłką organizatora.

Zmiana: `lib/eventDates.ts` → `dzisLokalnie(d = new Date())` i
`jutroLokalnie(d = new Date())` (składane z `getFullYear/getMonth/getDate`, nie
z ISO). Podmiana wyłącznie na ścieżce organizatora: `app/wydarzenia/nowe/page.tsx`
(`tomorrowStr`), `components/events/EventDateTimeField.tsx` (`min`),
`EventDetailClient.tsx` (dwa `min` w oknie powtórki i zmiany terminu),
`lib/groups.ts` (dwa `dzis` — najbliższy mecz ekipy). Pozostałe wystąpienia
(admin, katalog boisk, widget) poza zakresem — to nie ścieżka organizatora.
Test: `eventDates.test.ts` z datą lokalną 00:30 i 23:30.

### F-9. Rozjazd w BACKLOG

`BACKLOG.md §2` ma wiersz „~~`SHOW_TURNIEJE`~~ — **WŁĄCZONA 2026-09-16**”,
a `lib/features.ts` ma `SHOW_TURNIEJE = false` (i AGENTS.md mówi „wyłączona”).
Poprawić wiersz na stan faktyczny z datą wyłączenia (2026-09-17 wg analizy GTM).

**Dokumentacja PR-C:** `docs/funkcje.md` (okno gościa), `docs/llm-context.md`
+ sync (zdanie o otwartych grach, jeśli występuje w tym brzmieniu),
`frontend/public/llms.txt` — sprawdzić `grep 'z okolicy'`.

---

## 5. Zasady wykonania wspólne dla wszystkich PR-ów

- **Mobile-first**: style bazowe dla 320–360 px, rozszerzenia wyłącznie `sm:`/`md:`;
  zero `max-*:` i `@media (max-width…)` (sekcja 10 `check:docs`).
- **Kolory**: nic z tego nie jest wiadomością (różowy), prośbą o decyzję ani
  kompletem (niebieski), ani „nowością” (pomarańczowy).
- **Bez długiego myślnika** w treści dla użytkownika.
- **Hot spot kreatora** (`blokujEnter`, osobne `key`, `step !== 3`) — PR-A dotyka
  wyłącznie `handleSubmit` (jedno pole więcej w obiekcie `createEvent`), niczego
  w przyciskach.
- **UPDATE-y** przez `zaktualizujJedenWiersz()`.
- **Nowy typ powiadomienia**: żaden z planu go nie dodaje (F-5 używa istniejącego
  `zaproszenie_na_mecz`).
- Przed każdym commitem: `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build` (atrapy kluczy), `npm run check:docs`; przy PR-A dodatkowo
  `./scripts/baza-testowa.sh` (migracja od zera + `przypomnienia.sql` + `rls.sql`).
- Scenariusze za logowaniem (`npm run scenariusze`) — w CI (`wizualne.yml`), bo
  lokalnie w tym środowisku stos nie wstaje. Nowe scenariusze zapisujące do bazy —
  wyłącznie przez `zeSprzataniem()`.

---

## 6. Świadomie poza zakresem (żeby nie wracało jako „przecież to oczywiste”)

| Pomysł | Dlaczego nie teraz |
|---|---|
| Powiadomienie organizatora o **każdym** zapisie | `079` świadomie powiadamia tylko o zmianie kompletu; kilkanaście wpisów pod dzwonkiem na jeden mecz zagłusza te dwa istotne. F-4 daje organizatorowi stan składu na żądanie |
| E-mail gościa **opcjonalny** | bez adresu gość nie dowie się o odwołaniu, a organizator o tym nie wie — dokładnie to, co naprawiały `O-36` i `P-3`. F-6 obniża barierę wyjaśnieniem, nie zdjęciem pola |
| Przeliczanie kosztu na faktyczny skład (dawne F-2) | **odrzucone jako pomysł**, nie tylko odłożone — `event_participants` nie jest listą obecności, patrz notatka na górze dokumentu i sekcja F-2 |
| Przypomnienie „dziś grasz” rano | nowy typ + cron + szablon maila; F-3 usuwa nieprawdę, funkcja do rozważenia po pomiarze |
| Monit o wpisanie wyniku (9/88) | wynik nie jest obietnicą fazy 1 dla organizatora; przypomnienie po meczu już o nim mówi. Wracamy, gdy rozliczenie zacznie być używane — to ważniejszy sygnał |
| Odroczenie logowania przed kreatorem | decyzja właściciela z 2026-08-08, bez zmian |
| Odmrażanie `SHOW_RECURRING` | F-5 pokrywa potrzebę cotygodniowej ekipy bez nowego modułu |

---

## 7. Decyzje właściciela (2026-09-23)

1. **F-2 odrzucone w całości** — patrz notatka na górze dokumentu. Pytania
   o zaokrąglenie i o nieobecnych, które plan stawiał przy F-2, odpadają razem
   z nim.
2. **F-5, domyślny stan przełącznika** „Zaproś skład z tego meczu”: **włączony**.
3. **PR-B i PR-C: zatwierdzone bez zmian.**

---

## 8. Szkic opisu PR-ów (po polsku)

### PR-A: Rozliczenie, które się zgadza: organizator nie jest swoim dłużnikiem

**Po co.** Rozliczenie jest jedyną obietnicą z landingu, którą dane z produkcji
pokazują jako nieużywaną: 81% rozegranych płatnych meczów nie ma ani jednej
odhaczonej wpłaty. Jeden z powodów, w kodzie: organizator, który gra, był
liczony jako dłużnik samego siebie — w panelu „Podział kosztów”, w wiadomości
„Wyślij rozliczenie ekipie” (z jego własnym imieniem w „Zaległościach”),
na `/moje-gry` i w przypomnieniu po meczu.

(Rozważano też automatyczne przeliczanie ceny na faktyczny skład — odrzucone:
`event_participants` nie jest listą obecności, więc liczba wierszy w bazie nie
mówi, ile osób realnie grało. Szczegóły w `docs/faza1-organizator-plan.md`,
sekcja F-2.)

**Co się zmienia.**
- `winienWplate()` w `lib/payments.ts` — jedna reguła „kto jest winien wpłatę”;
  panel, tekst rozliczenia, karta „Po meczu” i `/moje-gry` liczą przez nią.
  Organizator widzi siebie jako „Ty · płacisz za obiekt”.
- Migracja `160`: `wyslij_przypomnienia()` bez organizatora w zaległościach
  (reszta funkcji bez zmian względem `144`).

**Migracja.** `160_rozliczenie_bez_organizatora.sql` — podmienia wyłącznie
ciało jednej funkcji; skaner ryzyka klasyfikuje ją jako bezpieczną, więc przy
merge'u pojedzie na produkcję automatem (workflow „Migracje”).

**Jak sprawdzone.** `tsc`, ESLint, Vitest, build, `check:docs`,
`baza-testowa.sh` (nowa asercja w `przypomnienia.sql`).

### PR-B: Organizator wie, co Bojo zrobi za niego; skład na czat i zaproszenia przy powtórce

**Po co.** „Przypomnienie wyśle się samo” było nieprawdą dla meczów założonych
po 18:00 dzień wcześniej i w dniu meczu. Organizator nie widział, kto nie dostanie
żadnej wiadomości ani kiedy Bojo się odezwie. Brakowało też dwóch rzeczy, które
organizator robi co tydzień na WhatsAppie: wysłania listy składu i zaproszenia
tych samych ludzi na kolejny termin.

**Co się zmienia.**
- Karta „Co Bojo zrobi za Ciebie” (`lib/harmonogramMeczu.ts`): kiedy pójdzie
  przypomnienie (albo że jest za późno), ile czasu ma rezerwa, kto nie dostanie
  wiadomości, kiedy przypomnimy o rozliczeniu. Godzina jest lustrem crona,
  pilnowanym testem czytającym migrację.
- „Wyślij skład na czat”: lista numerowana z wolnymi miejscami, rezerwą i linkiem.
- „Powtórz mecz” zaprasza poprzedni skład (osoby z kontem), poza meczami ekipy,
  gdzie powiadamia wyzwalacz `072`.

**Migracja.** Brak.

### PR-C: Bez obietnic „graczy z okolicy”; okno zapisu gościa mówi, po co e-mail

**Po co.** Zgodność z zasadą fazy 1 „nie obiecywać, czego nie ma” w czterech
miejscach poza landingiem (w tym na bramie kreatora) oraz niższa bariera dla
gracza z linku: e-mail wyjaśniony jednym zdaniem, korzyści konta prawdziwe
i wspólne z mailem.

**Co się zmienia.** Copy w czterech miejscach + fraza w `zakazaneFrazy.ts`
i skan TSX w teście; `content/kontoGoscia.ts` jako jedno źródło korzyści konta;
`dzisLokalnie()/jutroLokalnie()` na ścieżce organizatora; poprawka wiersza
`SHOW_TURNIEJE` w BACKLOG.

**Migracja.** Brak. Wymaga ponownego wdrożenia funkcji `powiadom-goscia`
(Actions → „Wdróż funkcje brzegowe”).
