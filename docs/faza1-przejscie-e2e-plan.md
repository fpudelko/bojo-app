# Faza 1, runda 8: przejście całej ścieżki na żywym stosie — plan

> **Status (2026-09-25): decyzje podjęte — D-1 tak, D-2 wariant A, D-3 tak (patrz §8).
> PR-D (W-1, W-2, W-3) i PR-E (W-4, W-5, migracja `163`) wdrożone. PR-F i PR-G czekają.**
> Ósma runda przejścia ścieżki organizatora i gracza. Poprzednie: `O`/`E`/`P`/`R`/`S`
> w [przeplyw-organizatora.md](./przeplyw-organizatora.md) i `F` w
> [faza1-organizator-plan.md](./faza1-organizator-plan.md) (wdrożone w PR-A/B/C).
> Ustalenia tej rundy mają numery `W-n`. Stan repo: `567e075`, migracje do `162` (160 plików).
>
> Kryterium doboru to samo co w rundzie `F` (skill fazy 1, [strategia.md §0](./strategia.md)):
> organizator **wie, jak działa i co się stanie**, ustawia **szybko**, Bojo jest
> **niezawodne** i **nie obiecuje tego, czego nie ma**, a organizator dostaje
> argumenty, którymi przebija ścianę kont u graczy. Pozycji „ładniej by było” tu nie ma:
> każda poniżej została **zobaczona w przeglądarce albo w bazie**, nie tylko wyczytana
> z kodu.

---

## 0. Co ta runda zrobiła inaczej niż poprzednie

Poprzednie rundy nie mogły uruchomić aplikacji za logowaniem: obrazy Supabase
i Docker Hub są w środowisku agenta zablokowane, więc `stos-lokalny.sh` nie wstawał
(patrz [faza1-organizator-plan.md §0](./faza1-organizator-plan.md)). Ta runda
postawiła pełny stos **bez Dockera**: Postgres 16 z obrazu środowiska, GoTrue
`v2.180.0` i PostgREST `v12.2.3` jako gotowe binarki z wydań na GitHubie, mały proxy
Node wystawiający `/auth/v1` i `/rest/v1` pod jednym adresem (tak jak Supabase),
160 plików migracji od zera, wszystkie seedy scenariuszowe, build produkcyjny
wskazujący na ten stos. Potem Playwright (Chromium z obrazu, profil iPhone 13,
`locale: pl-PL`, **`timezoneId: Europe/Warsaw`**) przeszedł ścieżkę tak, jak idzie
człowiek: klikając.

| Co | Wynik |
|---|---|
| `tsc --noEmit` | czysto |
| Vitest | **1630 / 1630**, 140 plików |
| `npm run check:docs` | OK |
| Build produkcyjny | zielony |
| Przejście w przeglądarce (telefon) | landing → brama kreatora → rejestracja e-mailem → kreator (3 kroki, mecz płatny z BLIK-iem) → podsumowanie → publikacja → „Mecz gotowy” → „Wyślij link”, „Wyślij skład” → zapis dwóch gości z linku → zapis gracza z kontem → „Rozliczenia” → „Wyślij rozliczenie ekipie” → mecz przesunięty na wczoraj → karta „Po meczu” → „Powtórz mecz” → strona wpisu gościa `/gracz/przejmij/[token]` → logowanie w nowej karcie |
| Scenariusze za logowaniem (`npm run scenariusze`) | **nie uruchomione lokalnie** — ten stos nie ma realtime ani funkcji brzegowych, a CI puszcza je na właściwym stosie Supabase. Wyniki tej rundy pochodzą z własnego przejścia, nie z tej bramki |
| Baza produkcyjna | **wyłącznie zapytania agregujące** (liczby, bez danych osobowych); wykluczone mecze z markerami seedów i organizatorzy z kontami `@example.com` |

**Co przeszło czysto i zostaje bez zmian** (żeby nie wracało jako „do poprawy”):
kreator (walidacja BLIK-a, przeliczenie kosztu obiektu, szkic, podsumowanie
z „Zmień”), panel „Mecz gotowy” z harmonogramem (F-3), teksty „Wyślij link”
i „Wyślij skład” (liczba wolnych miejsc, cena, „Zapisujesz się bez zakładania konta”),
okno zapisu gościa z wyjaśnieniem pola e-mail (F-6), pasek „Jesteś zapisany(a) · Mój
zapis” po odświeżeniu, rozliczenie bez organizatora-dłużnika (F-1), karta „Po meczu”,
okno „Powtórz mecz” z zaproszeniem składu (F-5).

---

## 1. Streszczenie

Wspólny mianownik: **pierwszy kontakt z Bojo psuje się w miejscach, których żaden test
nie widzi**, bo każdy test startuje z „posprzątaną” przeglądarką (zgoda na cookies już
dana, okno roli już odklikane, strefa czasowa UTC jak na serwerze). Człowiek z linku
na WhatsAppie ma przeglądarkę nieposprzątaną.

| # | Ustalenie | Wartość dla organizatora | Koszt | Migracja | PR |
|---|---|---|---|---|---|
| **W-1** | Baner cookies po 6 s **zasłania „Dołącz bez konta”**, „Zaloguj się” i „Dalej” w kreatorze | Gracz z jego linku może się zapisać bez odklikiwania czegokolwiek | mały | nie | D |
| **W-2** | Okno „Witaj w Bojo… kim jesteś?” wyskakuje **nad kreatorem i nad oknem zapisu**, gdy logowanie skończyło się w innej karcie (link z maila) | Świeży organizator i gracz nie są wyrzucani z drogi, którą właśnie szli | mały | nie | D |
| **W-3** | Strona główna **wywraca hydrację Reacta** każdemu w polskiej strefie czasowej; „Możesz dołączyć już dziś” liczy czas w UTC | Pierwszy ekran organizatora renderuje się raz, poprawnie, a lista nie pokazuje meczu, który już trwa | mały | nie | D |
| **W-4** | Gość bez konta w meczu płatnym **nigdy nie widzi numeru BLIK, sposobu płatności ani czy wpłata jest odhaczona**; okno zapisu gościa nie pokazuje nawet kwoty | Rozliczenie działa także dla graczy bez konta, czyli dokładnie dla tych, których organizator przyprowadza linkiem | średni | **tak** (`163`, tylko podmiana funkcji) | E |
| **W-5** | Ta sama kwota w trzech zapisach: „20.00 PLN”, „20.00 zł”, „20,00 zł” | Organizator widzi w panelu to samo, co wysyła ekipie | mały | nie | E |
| **W-6** | Ekran po zapisie gościa mówi „**Ostatni krok**”, choć zapis jest już zrobiony; toast zasłania przycisk okna | Gość wie, że jest zapisany, a konto jest ofertą, nie warunkiem | mały (copy) | nie | F |
| **W-7** | Brama kreatora prowadzi na „Zaloguj się”, a nowy organizator wpisujący e-mail i nowe hasło dostaje wyłącznie „Nieprawidłowy e-mail lub hasło.” | Mniej porzuceń na ścianie logowania | mały | nie | F |
| **W-8** | Zaproszenie do ekipy `/g/[kod]` **wymaga konta i nie daje drogi do najbliższego meczu**; licznik miejsc liczy obserwujących | Stała ekipa (przesłanka strategiczna) zapisuje się na czwartek bez konta, konto zakłada później | mały | nie | F (decyzja D-1) |
| W-9 | (narzędzie, opcjonalnie) skrypt stawiający ten sam stos bez Dockera | Kolejne rundy sprawdzają zachowanie, a nie tylko kod | mały | nie | G (decyzja D-3) |

**Kolejność = kolejność PR-ów:** `PR-D` (W-1, W-2, W-3: niezawodność pierwszego
kontaktu, zero migracji, zero zmian treści), `PR-E` (W-4, W-5: płatność gościa, jedyna
migracja), `PR-F` (W-6, W-7, W-8: copy i logowanie). Każdy PR jest samodzielny i da się
go cofnąć bez ruszania pozostałych.

Uzasadnienie kolejności: W-1 i W-2 **blokują zapis fizycznie** (przycisk jest pod
innym elementem), W-4 psuje obietnicę z landingu („Wiadomo, kto ile płaci”) dla gracza
bez konta, a W-6…W-8 to tarcie, nie blokada.

**Zgodność z moratorium** z [analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md) (A.1):
żadna pozycja nie dokłada flagi funkcji, typu powiadomienia ani nowej encji. Jedyna
zmiana schematu (`163`) podmienia ciało istniejącej funkcji i dokłada kolumny do jej
wyniku.

---

## 2. PR-D — pierwszy kontakt, który się nie wywraca

### W-1. Baner cookies zasłania główny przycisk

**Problem (zobaczony).** `CookieBanner` (`components/CookieBanner.tsx`) to `fixed
bottom-0 z-50`. Pojawia się po **6 sekundach** albo po przewinięciu o 300 px
(`lib/cookieConsent.ts`, `TIMER_MS`, `SCROLL_THRESHOLD`). Dolne paski akcji mają
`z-30`: pasek „Dołącz bez konta → / Zaloguj się”, pasek „Jesteś zapisany(a) · Mój
zapis” i pasek „Dalej →” kreatora. Na telefonie baner ma ~150 px wysokości i przykrywa
pasek **w całości**.

Przejście: nowa przeglądarka otwiera link do meczu, czyta 7 sekund. Playwright:
`KLIK ZABLOKOWANY: <div role="dialog" aria-label="Informacja o cookies"> … intercepts
pointer events`. Na ekranie jest licznik „1 / 10”, a pod nim baner z zielonym „OK,
rozumiem” — jedyny widoczny przycisk na stronie. To jest dokładnie osoba, którą
organizator przyprowadził linkiem, w dokładnie tej chwili, w której decyduje, czy się
zapisać (wyzwanie 1 ze strategii). Ten sam baner zasłania „Dalej →” świeżemu
organizatorowi w kreatorze.

**Dlaczego nikt tego nie widział.** Każdy test klikalności i każdy test wizualny
**ustawia zgodę przed wejściem** (`localStorage.setItem('bojo_cookie_consent_v1', '1')`
w 20 plikach `e2e/*.klikalnosc.spec.ts` i w `bezBaneraCookies()` w
`wizualne.spec.ts`). Scenariusze za logowaniem zgody nie ustawiają, ale klikają szybciej
niż w 6 sekund; test, który zostanie na stronie dłużej, trafi w baner — to jest też
potencjalne źródło niestabilności samej bramki.

**Rozwiązanie. Baner czeka, aż człowiek nie jest w trakcie czynności.** Ekrany z
własnym dolnym paskiem akcji już się same deklarują: montują `<HideBottomNav />`
(`lib/bottomNavVisibility.tsx`) — dziś robi to wyłącznie kreator, pasek „Dołącz” i pasek
gościa (`grep '<HideBottomNav'`: `app/wydarzenia/nowe/page.tsx`, dwa miejsca w
`EventDetailClient.tsx`, `BottomNavGate.tsx`). Ten sam sygnał znaczy „na dole jest
coś ważniejszego niż informacja”.

1. `lib/cookieConsent.ts`, `useCookieBannerVisible()`:

   ```ts
   import { useBottomNavHidden } from './bottomNavVisibility';
   // …
   const ekranZPaskiemAkcji = useBottomNavHidden();
   // …
   // Baner INFORMUJE (zgody nie zbiera — tylko niezbędne cookies), więc może
   // poczekać. Ekran z własnym dolnym paskiem (kreator, „Dołącz bez konta”,
   // „Mój zapis”) deklaruje to przez <HideBottomNav/>; baner przykrywał tam
   // główny przycisk w całości (W-1, docs/faza1-przejscie-e2e-plan.md).
   return !dismissed && revealed && !ekranZPaskiemAkcji;
   ```

   Jedno miejsce reguły: `StickyCta` na landingu czyta ten sam hook, więc oba nadal się
   zgadzają. Na landingu, liście meczów, mapie i stronach treści **nic się nie zmienia**
   (żadna z nich nie montuje `HideBottomNav`), więc wzorzec `baner-cookies.png`
   z `wizualne.spec.ts` (robiony na `/`) zostaje bez zmian.
2. Stan `revealed` (timer, przewinięcie) liczy się dalej na każdej stronie: kto
   przewinął mecz i przeszedł na listę, zobaczy baner od razu na liście. Informacja
   nie ginie, tylko przestaje stać na drodze.

**Rozważone i odrzucone:** podniesienie banera nad pasek (zmienna CSS z wysokością
paska). Na 375 px dwa paski jeden nad drugim zabierają ~40% ekranu, a na stronie meczu
pod spodem jest licznik miejsc, o który gracz przyszedł.

**Testy.**
- `src/__tests__/banerCookies.test.tsx` (Vitest + Testing Library, `vi.useFakeTimers`):
  (a) bez `HideBottomNav` baner pojawia się po 6 s; (b) z `<HideBottomNav />` w tym
  samym `BottomNavVisibilityProvider` nie pojawia się po 6 s ani po zdarzeniu `scroll`;
  (c) po odmontowaniu `HideBottomNav` pojawia się od razu (stan `revealed` przetrwał).
- `e2e/scenariusze.spec.ts`, nowy test w `describe('dołączanie do meczu')`:
  „pierwsza wizyta z linku: po 7 s «Dołącz bez konta» jest klikalne”. Bez logowania,
  **bez ustawiania zgody**, `otworzMecz(page, MECZ.wolneMiejsca)`, `waitForTimeout(7000)`,
  `click({ trial: true })` na przycisku (sprawdza, że nic go nie przykrywa, niczego nie
  zapisuje — więc bez `zeSprzataniem()`). Asercja zachowania, czyli **bramka**.

**Dokumentacja:** `docs/funkcje.md` — nowy akapit przy „Zapis na mecz bez logowania”
(„baner cookies nie pojawia się na ekranach z dolnym paskiem akcji”) oraz
**AGENTS.md, sekcja o zrzutach**: jedno zdanie, że scenariusz „pierwsza wizyta” jest
jedynym testem bez ustawionej zgody i ma takim zostać.

### W-2. Okno „kim jesteś?” nad kreatorem i nad oknem zapisu

**Problem (zobaczony).** `PostSignupRoleModal` (`components/onboarding/PostSignupRoleModal.tsx`)
pokazuje się świeżemu kontu (< 10 min), gdy **zapamiętany cel logowania** jest neutralny
(`/`, `/wydarzenia`, `/moje-gry`, `/mapa`) albo **go nie ma**. Cel siedzi w
`sessionStorage` (`lib/powrotPoLogowaniu.ts`), a `sessionStorage` jest **per karta**.

Przejście: gracz na stronie meczu klika „Zaloguj się”, zakłada konto. W tej samej karcie
wszystko gra (okno się nie pokazuje). Gdy logowanie kończy się **w innej karcie** —
link logowania z maila (brama kreatora obiecuje wprost „Google, e-mail albo link bez
hasła”), aplikacja pocztowa otwierająca przeglądarkę, logowanie na drugim urządzeniu —
cel jest `null`, więc „neutralny”, i okno wyskakuje:

- na `/wydarzenia/[id]?dolacz=1` **nad otwartym oknem zapisu** (zrzut: pod spodem
  „Zapisać się na mecz?”, na wierzchu zielone „🏆 Jestem organizatorem”, które
  wyprowadza gracza do kreatora),
- na `/wydarzenia/nowe` nad kreatorem u organizatora, który właśnie przyszedł
  z „Zorganizuj mecz”.

**Rozwiązanie.** O pokazaniu decyduje także **strona, na której człowiek stoi** —
ona jest pewniejszym sygnałem intencji niż pamięć jednej karty.

1. Czysta funkcja w tym samym pliku (eksportowana pod test):

   ```ts
   export function czyPokazacWyborRoli(o: {
     sciezka: string;          // window.location.pathname
     cel: string | null;       // ostatniZamierzonyCel()
     wiekKontaMs: number;
     widziano: boolean;
     widget: boolean;
   }): boolean {
     if (o.widget || o.widziano || o.wiekKontaMs >= SWIEZOSC_MS) return false;
     const celNeutralny = o.cel === null || CELE_NEUTRALNE.has(o.cel);
     return celNeutralny && CELE_NEUTRALNE.has(o.sciezka);
   }
   ```
2. Efekt w komponencie woła ją z `usePathname()` (z `next/navigation`) i **dodaje
   `pathname` do zależności efektu**. To ważne: organiczna rejestracja zaczyna się na
   `/logowanie` (nieneutralne), a kończy `router.push('/moje-gry')`. Bez `pathname`
   w zależnościach efekt policzyłby się raz, na `/logowanie`, i okno nie pokazałoby się
   **nigdy** — czyli poprawka zepsułaby onboarding, który dziś działa.

**Testy.** `src/__tests__/wyborRoli.test.ts`: tabela przypadków — nowa karta na
`/wydarzenia/nowe` (`cel: null`) → nie; nowa karta na `/wydarzenia/x` → nie;
organiczna rejestracja na `/moje-gry` (`cel: '/moje-gry'`) → tak; `/logowanie` → nie;
cel `/wydarzenia/nowe`, ścieżka `/` (powrót przez Site URL, `lib/auth.tsx`) → nie;
konto starsze niż 10 min → nie; widziane → nie; widget → nie.

**Dokumentacja:** `docs/funkcje.md` — sekcja o oknie wyboru roli (jeśli jej nie ma: jeden
akapit przy „Gdzie ląduje zalogowany”), reguła „ścieżka i cel muszą być neutralne”.

### W-3. Strona główna wywraca hydrację w polskiej strefie czasowej

**Problem (zobaczony).** Otwarcie `/` z `timezoneId: 'Europe/Warsaw'` daje w konsoli
React `#425`, `#418` i **`#423`** („błąd hydracji poza granicą Suspense, **cały korzeń
przełącza się na renderowanie po stronie klienta**”). Z `timezoneId: 'UTC'` — czysto.
Sprawdzone na 12 trasach; problem ma **wyłącznie** strona główna, czyli pierwszy ekran
każdego organizatora z outreachu.

Przyczyna: `LandingOpenGames` (komponent serwerowy) renderuje `EventBrowseCard`
(kliencki). Karta liczy „Dzisiaj/Jutro” i „za 14 h” z `new Date()` i
`new Date(y, m-1, d, h, min)` — czyli w strefie **procesu**. Serwer (Vercel) liczy
w UTC, przeglądarka w Warszawie: tekst różni się o 1–2 h, React odrzuca cały HTML
z serwera i renderuje stronę od nowa. Skutki: podwójna praca na telefonie przy
pierwszym wejściu, mignięcie treści, a w HTML dla robota — nieprawdziwe „za 16 h”.
Drugi skutek tej samej przyczyny: filtr `isEventJoinable()` w `LandingOpenGames` też
liczy w UTC, więc sekcja „Możesz dołączyć już dziś” pokazuje mecz **do 2 h po jego
starcie** (latem).

**Dlaczego nikt tego nie widział.** `playwright.config.ts` nie ustawia `timezoneId`,
więc przeglądarka w CI dziedziczy UTC runnera — tę samą strefę co serwer. Test nigdy
nie jest w sytuacji polskiego gracza.

**Rozwiązanie.**

1. `lib/czasPolski.ts` (nowy, mały):

   ```ts
   /** „Teraz” w Polsce jako napisy porównywalne z `events.event_date` / `event_time`.
    *  Niezależne od strefy procesu: serwer na Vercelu stoi na UTC. */
   export function terazWPolsce(d: Date = new Date()): { data: string; godzina: string } {
     const f = new Intl.DateTimeFormat('sv-SE', {
       timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
       hour: '2-digit', minute: '2-digit', hour12: false,
     }).format(d);                                  // „2026-09-25 18:04”
     const [data, godzina] = f.split(' ');
     return { data, godzina };
   }

   export function czyPrzedStartemWPolsce(data: string, czas: string | undefined, teraz = terazWPolsce()): boolean {
     const g = (czas ?? '23:59').slice(0, 5);
     return data > teraz.data || (data === teraz.data && g > teraz.godzina);
   }
   ```
2. `components/home/landing/LandingOpenGames.tsx`: `isEventJoinable(e)` →
   `czyPrzedStartemWPolsce(e.date, e.time)`. `isEventJoinable()` zostaje nietknięte
   dla kodu klienckiego (tam strefa przeglądarki jest właściwa).
3. `components/EventBrowseCard.tsx`: etykiety **względne** („Dzisiaj”, „Jutro”, „za 2 h”)
   liczą się dopiero **po montażu**. Nowy hook `lib/usePoMontazu.ts`:
   `const [zamontowany, ustaw] = useState(false); useEffect(() => ustaw(true), []);
   return zamontowany;`. Przed montażem karta pokazuje datę bezwzględną
   (`format(d, 'EEE d MMM', { locale: pl })`) i nie pokazuje „za N h”; po montażu —
   dokładnie to, co dziś. Na listach klienckich (`/wydarzenia`, `/moje-gry`, grupy)
   dane i tak przychodzą po montażu, więc tam **nic się nie zmienia**; zmienia się
   wyłącznie pierwszy HTML landingu. `past`/`isUpcoming` bez zmian (landing pokazuje
   wyłącznie mecze przyszłe).

**Testy.**
- `src/__tests__/czasPolski.test.ts`: `terazWPolsce()` dla `2026-07-01T22:30:00Z`
  (lato, w Polsce już 2 lipca 00:30) i `2026-12-01T23:30:00Z` (zima, 2 grudnia 00:30);
  `czyPrzedStartemWPolsce` — ten sam dzień przed/po godzinie, dzień wcześniej/później,
  brak godziny.
- **Dopisane przy wdrożeniu:** `src/__tests__/kartaMeczuSsr.test.tsx` renderuje
  `EventBrowseCard` przez `renderToString` (czyli tak jak serwer) i sprawdza, że HTML
  nie zawiera „Dzisiaj”/„za N h” i jest identyczny o 16:00 i o 17:30. To jest właściwy
  test dla strony głównej: sekcję „Możesz dołączyć już dziś” pobiera **serwer**, więc
  atrapa `page.route()` (działa tylko w przeglądarce) nigdy jej nie wypełni i test e2e
  na `/` przechodziłby z niewłaściwego powodu. Pada bez poprawki, przechodzi z nią.
- **Nowy test klikalności** `e2e/hydracja.klikalnosc.spec.ts` z
  `test.use({ timezoneId: 'Europe/Warsaw', locale: 'pl-PL' })`: dla każdej trasy z listy
  `TRASY` (wyciągnąć ją z `wizualne.spec.ts` do `e2e/trasy.ts` i importować w obu
  plikach, żeby „dodajesz trasę → dopisz do TRASY” zostało jedną listą) otwiera stronę
  i oczekuje **zero** `pageerror` pasujących do `/Minified React error #(418|423|425)/`.
  Ogólna osłona wszystkich tras (jeden projekt, `telefon`); strony głównej z meczami nie
  pokrywa — patrz punkt wyżej. `TRASY` i `pustaBaza()` przeniesione do `e2e/wspolne.ts`.
  Globalnej strefy w `playwright.config.ts` **nie** zmieniamy: przestawiłaby daty na
  wszystkich wzorcach zrzutów naraz.

**Dokumentacja:** **AGENTS.md, „Pułapki, które już nas ugryzły”** — nowy akapit:
„Serwer renderuje w UTC, gracz jest w Warszawie. Wszystko, co zależy od «teraz» albo od
strefy, w komponencie renderowanym na serwerze liczy się przez `lib/czasPolski.ts` albo
dopiero po montażu (`usePoMontazu`). Test: `hydracja.klikalnosc.spec.ts`.”

---

## 3. PR-E — gość wie, ile, jak i komu zapłacić

### W-4. Gość bez konta nie widzi numeru BLIK ani statusu wpłaty

**Problem (zobaczony, trzy miejsca).**

1. **Okno zapisu gościa** (`EventDetailClient.tsx`, `joinAsGuestDialogOpen`): przy meczu
   płatnym pyta „Jak zapłacisz?”, ale **nie pokazuje kwoty**. Okno dla zalogowanego
   pokazuje „Koszt 20.00 zł” i przy BLIK-u „Numer do BLIKA zobaczysz po zapisaniu się”.
   Gość wybiera BLIK i nie dostaje żadnego zdania — linia `BLIK na numer:` renderuje się
   wyłącznie, gdy `event.blikPhone` jest widoczny, a niezalogowanemu RLS na `event_blik`
   (migracja `120`) numeru nie odda nigdy.
2. **Strona wpisu** `/gracz/przejmij/[token]` („Mój zapis →” z paska i przycisk „Sprawdź
   skład” z każdego maila): pokazuje „20,00 zł od osoby” i nic więcej — ani sposobu,
   ani numeru BLIK, ani „opłacone / nieopłacone”. `podejrzyj_wpis_goscia()` (`137`)
   tych pól po prostu nie zwraca.
3. **Mail „Jutro grasz”** (`supabase/functions/powiadom-goscia/tresc.ts`) ma kwotę
   w karcie meczu — i tyle. To jest w porządku (numer i tak odsłania się godzinę przed
   meczem), pod warunkiem że link z maila prowadzi tam, gdzie numer jest. Dziś nie ma.

Tymczasem zalogowany gracz ma kartę „Twoja płatność” z kwotą (po zniżce kartowej),
sposobem, numerem BLIK od 60 min przed startem (`canSeeBlikPhone`) i statusem.
Organizator, który wpisał numer BLIK w kreatorze, zakłada, że wszyscy z jego linku go
zobaczą. **Nie zobaczą ci, którzy zapisali się tak, jak Bojo zachęca: bez konta.**
Jedynym kanałem zostaje wiadomość „Wyślij rozliczenie ekipie” po meczu. Produkcja
(zapytanie agregujące, bez seedów): w meczach płatnych jest **86 wpisów gości bez
konta, 45 z nich w meczach przyjmujących BLIK**.

To jest wyzwanie 4 ze skilla fazy 1 wprost: „nie działające podstawowe funkcje
organizatora, które obiecujemy — np. rozliczenia po meczu”.

**Decyzja projektowa: token jest uprawnieniem, reguła odsłonięcia ta sama co dla konta.**
Token wpisu już dziś pozwala wypisać się, przyjąć ofertę rezerwy i przejąć wpis
(model „sekret na okaziciela”, jak `join_code`). Numer BLIK widzi każdy uczestnik
z kontem godzinę przed meczem; gość w składzie jest uczestnikiem — dostaje to samo,
na tych samych warunkach. Rezerwowy i czekający na akceptację — nie (tak jak konto).

**Rozwiązanie.**

1. **Migracja `163_gosc_widzi_swoja_platnosc.sql`** — podmiana `podejrzyj_wpis_goscia()`
   (`DROP FUNCTION` + `CREATE`, bo zmienia się typ wyniku — wzorzec z `128`/`137`),
   **sprawdzona w tej rundzie na lokalnej bazie w transakcji z `ROLLBACK`**: przed
   meczem zwraca `blik_pozniej = true` i pusty numer, 30 min przed startem zwraca numer,
   zmyślony token — zero wierszy. `node scripts/ryzyko-migracji.mjs` z tym plikiem:
   ręcznych dalej **7**, czyli `163` pojedzie na produkcję automatem przy merge'u.

   ```sql
   -- 163: gość bez konta widzi swoją płatność (W-4, docs/faza1-przejscie-e2e-plan.md).
   --
   -- DLACZEGO. Gracz z kontem ma kartę „Twoja płatność” (kwota po zniżce, sposób,
   -- numer BLIK godzinę przed meczem, status). Gość bez konta — główna droga, którą
   -- Bojo reklamuje („zapisujesz się bez zakładania konta”) — widział samą kwotę.
   -- Numeru BLIK nie miał skąd wziąć: RLS na `event_blik` (120) słusznie nie oddaje
   -- go anonimowi, a ta funkcja go nie zwracała. Uprawnieniem jest token wpisu, tak
   -- jak przy wypisaniu (128) i ofercie rezerwy (137).
   --
   -- Reguła odsłonięcia numeru jest LUSTREM `canSeeBlikPhone()` i
   -- `BLIK_PHONE_REVEAL_MINUTES = 60` w `frontend/src/lib/payments.ts`. Pilnuje tego
   -- `frontend/src/__tests__/platnoscGoscia.test.ts`, czytający ten plik.
   --
   -- Kształt wyniku się zmienia, więc DROP + CREATE (CREATE OR REPLACE nie pozwala
   -- zmienić RETURNS TABLE). Pierwsze 15 kolumn — bez zmian względem 137.
   DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);
   CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
   RETURNS TABLE (
     imie text, event_id uuid, tytul text, data_meczu date, godzina time, miejsce text,
     juz_przejety boolean, status_meczu text, na_rezerwie boolean,
     czeka_na_akceptacje boolean, koszt_grosze integer, w_skladzie integer,
     max_graczy integer, mozna_zmieniac boolean, oferta_do timestamptz,
     -- Nowe od 163.
     metody_platnosci text[], metoda_platnosci text, karta_sportowa boolean,
     znizka_karty_grosze integer, pokaz_status_platnosci boolean, oplacone boolean,
     blik_telefon text, blik_pozniej boolean
   )
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
   AS $$
     WITH w AS (
       SELECT p.*, e.id AS e_id, e.title, e.sport, e.event_date, e.event_time,
              e.field_name, e.custom_location_name, e.custom_address, e.status AS e_status,
              e.cost_grosz, e.max_players, e.reserve_claim_minutes,
              e.accepted_payment_methods, e.sports_card_discount_grosz, e.show_payment_status,
              b.blik_phone,
              (NOT coalesce(p.is_reserve, false) AND NOT coalesce(p.pending_approval, false)
                AND coalesce(p.rsvp, 'yes') <> 'maybe'
                AND e.status <> 'cancelled' AND coalesce(e.cost_grosz, 0) > 0
                AND 'blik' = ANY (coalesce(e.accepted_payment_methods, '{}'))
                AND b.blik_phone IS NOT NULL) AS blik_dotyczy,
              ((e.event_date + e.event_time) - interval '60 minutes'
                <= (now() AT TIME ZONE 'Europe/Warsaw')) AS blik_juz
         FROM event_participants p
         JOIN events e ON e.id = p.event_id
         LEFT JOIN event_blik b ON b.event_id = e.id
        WHERE p.claim_token = p_token
     )
     SELECT w.name, w.e_id, coalesce(w.title, w.sport), w.event_date, w.event_time,
            coalesce(w.field_name, w.custom_location_name, w.custom_address, 'Boisko'),
            (w.claimed_at IS NOT NULL OR w.user_id IS NOT NULL),
            w.e_status, coalesce(w.is_reserve, false), coalesce(w.pending_approval, false),
            coalesce(w.cost_grosz, 0),
            (SELECT count(*)::int FROM event_participants x
              WHERE x.event_id = w.e_id AND x.pending_approval IS NOT TRUE
                AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE),
            w.max_players,
            (w.claimed_at IS NULL AND w.user_id IS NULL AND w.is_guest
             AND (w.event_date + w.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')),
            CASE WHEN w.claim_offered_at IS NULL THEN NULL
                 ELSE w.claim_offered_at
                      + (coalesce(w.reserve_claim_minutes, 180) || ' minutes')::interval END,
            coalesce(w.accepted_payment_methods, '{}'), w.payment_method,
            coalesce(w.has_sports_card, false), w.sports_card_discount_grosz,
            coalesce(w.show_payment_status, false), coalesce(w.has_paid, false),
            CASE WHEN w.blik_dotyczy AND w.blik_juz THEN w.blik_phone END,
            (w.blik_dotyczy AND NOT w.blik_juz)
       FROM w;
   $$;
   REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
   GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
   ```

   Po dodaniu: `node scripts/build-db-bundles.mjs` i commit wyniku (`supabase/bundles/`).

2. **`lib/guestClaim.ts`** — `PodgladWpisuGoscia` dostaje pola `metodyPlatnosci`,
   `metodaPlatnosci`, `kartaSportowa`, `znizkaKartyGrosze`, `pokazStatusPlatnosci`,
   `oplacone`, `blikTelefon`, `blikPozniej`. Każde z wartością zapasową (`?? []`,
   `?? null`, `?? false`) — wzorzec z `128`: między deployem frontu a migracją strona
   ma pokazać to, co dziś, a nie pustki.
3. **Nowy komponent `components/events/TwojaPlatnosc.tsx`** — wyjęta 1:1 karta
   „Twoja płatność” z `EventDetailClient.tsx` (linie ~2709–2771). Props:

   ```ts
   interface Props {
     kosztGrosze: number;
     znizkaKartyGrosze: number | null;
     kartaSportowa: boolean;
     metoda: PaymentMethod | null;
     blikTelefon: string | null;   // już po regule odsłonięcia; null = nie pokazujemy
     blikPozniej: boolean;         // true = „zobaczysz na godzinę przed meczem”
     pokazStatus: boolean;         // events.show_payment_status
     oplacone: boolean;
   }
   ```

   Kwotę liczy `priceForParticipant()` wewnątrz komponentu (jedyne źródło ceny, AGENTS.md
   „Płatności”). Wiersz BLIK tylko przy `metoda === 'blik'` — ta sama reguła co dziś.
   `EventDetailClient.tsx` renderuje `<TwojaPlatnosc>` z dotychczasowych danych
   (`blikTelefon = canSeeBlikPhone(...) ? event.blikPhone : null`,
   `blikPozniej = !!event.blikPhone && !canSeeBlikPhone(...)`) — **wygląd bez zmian**
   poza W-5.
4. **`app/gracz/przejmij/[token]/PrzejmijClient.tsx`** — pod kartą meczu, gdy
   `kosztGrosze > 0 && !naRezerwie && !czekaNaAkceptacje && statusMeczu === 'active'
   && !juzPrzejety`: `<TwojaPlatnosc … />`. Zdanie nad kartą przy `blikPozniej`:
   „Wróć tu przed meczem po numer BLIK: link do tej strony masz też w mailu.” (sam termin „godzinę przed meczem” mówi już karta)
5. **Okno zapisu gościa** (`EventDetailClient.tsx`, `joinAsGuestDialogOpen`), przy
   `event.costGrosze > 0`, pod wyborem metody — ten sam wiersz co w oknie zalogowanego:
   „Koszt · 20,00 zł”; przy wybranym BLIK-u zamiast dzisiejszego warunkowego
   `BLIK na numer:` — „Numer do BLIKA zobaczysz godzinę przed meczem pod linkiem do
   swojego zapisu (przyjdzie też mailem).”

Mobile-first: karta to jedna kolumna, `flex items-center justify-between` jak dziś,
`min-w-0` przy tekście z numerem. Kolory bez zmian (zielony „Opłacone”, bursztynowy
„Jeszcze nieopłacone” — żaden z zarezerwowanych znaczeń).

**Testy.**
- `supabase/test/poczta-goscia.sql` (już leci w `baza-testowa.sh`): trzy asercje —
  gość w składzie meczu płatnego z BLIK-iem jutro → `blik_telefon IS NULL AND
  blik_pozniej`; ten sam mecz przesunięty na „za 30 min” → numer zwrócony; gość na
  rezerwie za 30 min → `blik_telefon IS NULL AND NOT blik_pozniej`.
- `supabase/test/rls.sql`, sekcja tokenu gościa: zmyślony token → zero wierszy
  (już jest — zostaje, pilnuje, że nowe kolumny nie otworzyły niczego).
- `src/__tests__/platnoscGoscia.test.ts`: czyta **ostatnią** definicję
  `podejrzyj_wpis_goscia` w `supabase/migrations/*.sql` i sprawdza, że zawiera
  `interval '${BLIK_PHONE_REVEAL_MINUTES} minutes'` (wzorzec: `harmonogramMeczu.test.ts`).
  Plus mapowanie w `podejrzyjWpisGoscia()` dla starego kształtu (brak nowych kolumn →
  wartości zapasowe).
- `src/__tests__/twojaPlatnosc.test.tsx`: zniżka kartowa, zniżka bez kwoty („ustal
  z organizatorem”), BLIK później / teraz, status ukryty przy `pokazStatus = false`.

**Dokumentacja:** `docs/baza-danych.md` (wiersz `163`), `docs/domena.md` (reguła:
„token wpisu odsłania numer BLIK na tych samych warunkach co konto”), `docs/funkcje.md`
(„Zapis na mecz bez logowania” + „Poczta do gościa”: co widać pod linkiem),
`docs/llm-context.md` + `npm run sync:llm-context` (wpis w „Ostatnie zmiany”, usunąć
najstarszy — limit 10; znacznik „Stan na”).

### W-5. Jedna forma kwoty

**Problem (zobaczony).** Organizator w panelu „Podział kosztów” widzi „20.00 PLN”,
„0.00 PLN z 60.00 PLN”; w oknie zapisu gracz widzi „20.00 zł”; na plakietce „20 zł / os.”;
w wiadomości, którą organizator wysyła ekipie — „20,00 zł”. Organizator porównuje panel
z wiadomością na czacie i widzi dwie różne kwoty w dwóch walutach. Drobiazg, ale
dokładnie w obszarze, który ma „nie zostawiać miejsca na domysły”.

**Rozwiązanie.** `lib/kwota.ts`:

```ts
/** Kwota w groszach jako „20,00 zł”. Jedyny format kwoty w interfejsie i w tekstach
 *  do udostępnienia (W-5). Plakietka „20 zł / os.” na kartach zostaje: to skrót. */
export function zl(grosze: number): string {
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;
}
```

Podmiana w: `EventDetailClient.tsx` (8 miejsc z „PLN”: linie ~2529, 2547, 2548, 2590,
2618, 2724, 2729 oraz „zł” z kropką ~5245), `app/wydarzenia/nowe/page.tsx` (zdania
„Przy 14 miejscach wychodzi 20.00 zł od osoby” i „Przy komplecie… to …”),
`app/wydarzenia/[id]/edytuj/page.tsx` (~682), `app/kalkulator-kosztow-boiska/KalkulatorKosztow.tsx`
(lokalne `zl`), `lib/settlementShare.ts` (lokalne `zl` → import; **ten sam wynik**),
`lib/eventShare.ts` i `lib/eventSummary.ts` (składanie „… zł od osoby” przez `zl()`;
**ten sam wynik**). Kwoty w polach formularza (`input`) zostają liczbami.

**Testy.** `src/__tests__/kwota.test.ts` (0, 1, 2000, 2050, 123456). Istniejące
`eventShare.test.ts`, `settlementShare.test.ts`, `eventSummary.test.ts` muszą przejść
**bez zmiany oczekiwań** — to dowód, że podmiana nie zmieniła tekstów na czat.
Zrzuty: zmienią się wzorce paneli płatności → etykieta `zrzuty:zaakceptuj` po
obejrzeniu.

**Dokumentacja:** `docs/domena.md` — jedno zdanie przy regułach płatności („kwota
w interfejsie: `zl()` z `lib/kwota.ts`”).

---

## 4. PR-F — logowanie i konwersja bez domysłów

### W-6. „Ostatni krok” po zapisie, który już się udał

**Problem (zobaczony).** Po zapisie gościa okno mówi: „Świetnie! Jesteś w składzie.
**Ostatni krok, 15 sekund**, żeby nie stracić powiadomień o kolejnych meczach.”
„Ostatni krok” mówi, że zapis nie jest skończony, choć jest — to rodzi dokładnie te
wiadomości do organizatora („czy mnie zapisało?”), które Bojo ma z niego zdejmować.
„Nie stracić powiadomień” obiecuje stratę czegoś, czego gość nie miał. Do tego toast
„Dołączyłeś do meczu!” (`handleJoinAsGuest`, ~linia 1359) powtarza nagłówek okna
i przez ~3 s zasłania dolny przycisk „Zapisz sobie link do swojego zapisu”.

**Rozwiązanie (tylko treść, `EventDetailClient.tsx`, okno `showAccountPrompt`):**

| Miejsce | Dziś | Po zmianie |
|---|---|---|
| podlinia, świeży zapis bez konta | „Ostatni krok, 15 sekund, żeby nie stracić powiadomień o kolejnych meczach.” | „Zapis gotowy, organizator Cię widzi. Konto nie jest potrzebne, a jeśli chcesz, zajmie 15 sekund i daje:” |
| podlinia, `alreadyJoined` | „Twój zapis jest już na liście. Ostatni krok, 15 sekund, …” | „Twój zapis jest już na liście. Konto nie jest potrzebne, a jeśli chcesz, zajmie 15 sekund i daje:” |
| przycisk odrzucenia (bez konta) | „Pomijam, potwierdzę później” | „Nie teraz, zostaję bez konta” |
| toast po udanym zapisie gościa | „Dołączyłeś do meczu!” / „Komplet, jesteś…” / „Prośba wysłana…” / „Ten zapis już istniał…” | **brak** — ten sam status mówi nagłówek okna, które właśnie stoi na ekranie; toasty zostają wyłącznie na ścieżce błędów |

Warianty dla `newUserHasAccount` bez zmian. Bez długiego myślnika (sekcja 11
`check:docs`). Żaden test e2e nie opiera się na zmienianych zdaniach (sprawdzone
`grep`).

**Testy.** Jeden nowy przypadek w `scenariusze.spec.ts` („gość z linku”, projekt
telefon i komputer): po „Zapisz się” widać „Zapis gotowy” i **nie** widać „Ostatni krok”;
sprzątanie przez `zeSprzataniem()` → wypisanie tokenem (`wypisz_wpis_goscia`) albo
„Nie mogę grać” na `/gracz/przejmij/[token]`.

**Dokumentacja:** `docs/funkcje.md`, „Zapis na mecz bez logowania”.

### W-7. Ściana logowania dla nowego organizatora

**Problem (zobaczony).** „Zaloguj się i kontynuuj” na bramie kreatora prowadzi na
`/logowanie` w trybie **logowania**: „Zaloguj się. Wejdź na swoje konto…”. Organizator,
który pierwszy raz widzi Bojo, konta nie ma. Google jest na górze i załatwia oba
przypadki, ale kto wpisze e-mail i nowe hasło, dostaje wyłącznie „Nieprawidłowy e-mail
lub hasło.” — bez słowa, że konta jeszcze nie ma i gdzie je założyć („Nie masz konta?
Załóż je” stoi pod formularzem).

**Rozwiązanie.**
1. `lib/auth.tsx`: `export const BLAD_ZLE_DANE = 'Nieprawidłowy e-mail lub hasło.';`,
   `mapAuthError()` zwraca tę stałą.
2. `components/auth/AuthForm.tsx`:
   - `POWODY.kreator = 'Pierwszy raz? Najszybciej przez Google. E-mailem: „Załóż je” pod formularzem. Po zalogowaniu wracasz prosto do kreatora.'`
   - `POWODY.dolacz = 'Po zalogowaniu wrócisz do meczu z otwartym oknem zapisu.'`
   - w `handleSubmit`, gałąź `signin`: gdy błąd `=== BLAD_ZLE_DANE`, pod komunikatem
     przycisk tekstowy „Pierwszy raz tutaj? Załóż konto na ten adres” →
     `switchMode('signup')` (e-mail zostaje w polu — `switchMode` czyści tylko hasło).
3. `app/wydarzenia/nowe/page.tsx`, `przejdzDoLogowania`: `…&powod=kreator`.
   `EventDetailClient.tsx`, przycisk „Zaloguj się” w pasku dołączania (~4406):
   `…?dolacz=1` → cel bez zmian, do adresu logowania `&powod=dolacz`.

**Testy.** Nowy `src/__tests__/authForm.test.tsx` (dziś takiego nie ma; `useAuth` mockowany wzorem `mojeAlerty.test.tsx`): podpowiedź
pojawia się po `BLAD_ZLE_DANE` w trybie logowania, klik przełącza na rejestrację
z zachowanym adresem; `powod=kreator` pokazuje swoje zdanie. `wizualne.spec.ts` ma
już atrapę odpowiedzi GoTrue na złe hasło (`odpowiedzLogowania`) — jej wzorzec
zrzutu zmieni się o jedną linię → `zrzuty:zaakceptuj`.

**Dokumentacja:** `docs/funkcje.md`, „`/logowanie` na tle listy meczów”.

### W-8. Zaproszenie do ekipy bez drogi do najbliższego meczu

**Problem (zobaczony w kodzie, sprawdzony na trasie).** `/g/[kod]`
(`app/g/[code]/ZaproszenieClient.tsx`) pokazuje wylogowanemu kartę „Najbliższy mecz”
i formularz **zakładania konta** („Konto zajmie 30 sekund…”). Nie ma żadnej drogi,
żeby po prostu zapisać się na ten czwartek — choć sam mecz przyjmuje zapis bez konta.
To jest odwrócenie argumentu, którym organizator przebija ścianę: w meczu mówi
„bez konta”, w ekipie — „najpierw konto”. Stała ekipa to według
[PRZESŁANKI STRATEGICZNEJ](../BACKLOG.md) „mięso na start”.

Przy okazji: licznik „N/M miejsc” na tej karcie liczy wiersze bez rezerwy i bez
oczekujących, ale **razem z obserwującymi** (`rsvp = 'maybe'`), a „dziś” (`dzis`)
liczy w UTC — inaczej niż strona meczu.

**Rozwiązanie.**
1. `app/g/[code]/page.tsx`: do zapytania o najbliższy mecz dołożyć `id` i
   `event_participants(…, rsvp)`; licznik: `!is_reserve && !pending_approval &&
   rsvp !== 'maybe'`; `dzis` z `terazWPolsce().data` (W-3).
2. `ZaproszenieClient.tsx`: w karcie „Najbliższy mecz” link
   **„Zapisz się na ten mecz bez konta →”** do `/wydarzenia/{id}` (to kanoniczny link
   meczu, działa także dla meczu prywatnego — decyzja właściciela 2026-08-08 w
   [przeplyw-organizatora.md](./przeplyw-organizatora.md)). Formularz konta zostaje pod
   spodem, bez zmian, i nadal jest głównym wezwaniem strony (konto = ekipa, powiadomienia
   o kolejnych meczach).
   Mobile-first: link jako pełnoszeroki przycisk drugorzędny (`border`, `h-11`) w karcie.

Licznik wyjęty do czystej funkcji `liczZajeteMiejsca(rows)` w `lib/groups.ts`
(warunek identyczny z `winienWplate()`/`kolejkaRezerwy.ts`: bez rezerwy, bez
oczekujących, bez obserwujących).

**Testy.** `src/__tests__/zaproszenieDoEkipy.test.tsx`: render `ZaproszenieClient`
z `nextEvent` (z `id`) i `useAuth` mockowanym na wylogowanego → link „Zapisz się na ten
mecz bez konta” ma `href="/wydarzenia/<id>"`; bez `nextEvent` linku nie ma.
`src/__tests__/groups.test.ts` (albo nowy plik): `liczZajeteMiejsca` pomija rezerwę,
oczekujących i obserwujących. Scenariusza e2e **nie** dokładamy: `seed_wizualne.sql`
nie ma dziś żadnej ekipy, a dopisywanie jej tylko pod ten test to więcej ryzyka dla
bramki niż wartości.

**Dokumentacja:** `docs/funkcje.md`, „Uprawnienia w grupie i lądowanie zaproszenia
`/g/[kod]`”.

---

## 5. W-9 (opcjonalnie). Stos bez Dockera jako narzędzie repo — PR-G

To, co pozwoliło tej rundzie zobaczyć W-1…W-4, da się zapisać jako
`scripts/stos-bez-dockera.sh`: `initdb` (wzorem `baza-testowa.sh`, katalog danych
poza repo), role `supabase_auth_admin`/`authenticator`/`anon`/`authenticated`/
`service_role`, GoTrue `v2.180.0` (sam zakłada schemat `auth` swoimi migracjami;
`GOTRUE_MAILER_AUTOCONFIRM=true`), `supabase/test/shim.sql` **bez** definicji
`auth.uid()`/`auth.role()` (GoTrue ma własne, zgodne z PostgREST), migracje, seedy
jak w `baza-testowa.sh`, PostgREST `v12.2.3`, 40-liniowy proxy Node pod `:54321`,
klucze JWT podpisane tym samym sekretem. Bez realtime i funkcji brzegowych — skrypt
mówi to wprost na starcie. Wersje binarek przypięte w skrypcie.

Nie wchodzi do CI (tam jest prawdziwy stos). Służy agentom i ludziom bez Dockera.
**Decyzja D-3** — bez niej PR-G nie powstaje; PR-D/E/F od niego nie zależą.

---

## 6. Zasady wspólne dla PR-D/E/F

- **Mobile-first**: style bazowe dla 320–375 px, rozszerzenia wyłącznie `sm:`/`md:`;
  zero `max-*:` i `@media (max-width…)` (sekcja 10 `check:docs`).
- **Kolory**: nic z tego nie jest wiadomością (różowy), prośbą o decyzję/kompletem
  (niebieski) ani nowością (pomarańczowy).
- **Bez długiego myślnika** w treści dla użytkownika (sekcja 11 `check:docs`).
- **Hot spot kreatora** (`blokujEnter`, osobne `key`, `step !== 3`): PR-E dotyka
  w kreatorze wyłącznie dwóch zdań z kwotą, PR-F — wyłącznie `przejdzDoLogowania`
  na bramie (przed kreatorem).
- **Nowe typy powiadomień**: żaden.
- Przed każdym commitem: `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build` (atrapy kluczy), `npm run check:docs`; przy PR-E dodatkowo
  `./scripts/baza-testowa.sh` i `node scripts/build-db-bundles.mjs`.
- Zmiany widoczne dla użytkownika → `docs/llm-context.md` + `npm run sync:llm-context`.
- Zmiany wyglądu (W-5, W-6, W-7) → wzorce zrzutów przez etykietę `zrzuty:zaakceptuj`
  po obejrzeniu raportu.

---

## 7. Świadomie poza zakresem

| Pomysł | Dlaczego nie teraz |
|---|---|
| Obiekty `map_visibility = 'organizer_only'` są niewidoczne w kreatorze (szukanie i mapa biorą tylko `public`), wbrew opisowi z migracji `024` | Na produkcji to **20** obiektów w sportach kreatora na ~31 tys. Realne, ale bez wpływu; do BACKLOG jako porządek |
| Mail do gości (z adresem) z zaproszeniem na powtórzony mecz | Nowy powód w `powiadom-goscia`, nowa funkcja SQL i decyzja o treści. F-5 zaprasza już graczy z kontem; najpierw zmierzyć, ilu gości z adresem wraca co tydzień |
| Pasek „Jesteś w składzie · Wypisz się” u organizatora na własnym meczu | Działa poprawnie (okno wyjścia tłumaczy skutek); zgłoszeń nie ma |
| Zdjęcie banera cookies całkowicie | Decyzja prawna, nie produktowa — patrz D-2 |
| Globalne `timezoneId: 'Europe/Warsaw'` w `playwright.config.ts` | Przesunęłoby daty na wszystkich wzorcach naraz; W-3 dokłada osobny test |
| Powiadomienie organizatora o każdym zapisie, przeliczanie kosztu na faktyczny skład | Odrzucone wcześniej (079, F-2) — bez nowych przesłanek |

---

## 8. Decyzje dla właściciela

**Rozstrzygnięte 2026-09-25: D-1 — tak, D-2 — wariant A, D-3 — tak.** Poniżej
pytania w brzmieniu, w jakim były zadane.

- **D-1 (W-8).** Czy na zaproszeniu do ekipy ma stać droga „Zapisz się na ten mecz bez
  konta”? Rekomendacja: **tak** — ekipa zyskuje gracza na czwartek, a konto zakłada się
  potem z maila „Zagrałeś wczoraj” (`zaloz_konto`). Ryzyko: część osób nigdy nie dołączy
  do ekipy jako członek.
- **D-2 (W-1).** Wariant: **(A) baner czeka poza ekranami z dolnym paskiem akcji**
  (ten plan) czy **(B) baner znika w ogóle**, bo Bojo używa wyłącznie niezbędnych
  cookies, a informacja stoi w polityce prywatności. Rekomendacja: **A** teraz; B tylko
  po potwierdzeniu u prawnika przy okazji ustaleń z POZIOMU 4 analizy GTM.
- **D-3 (W-9).** Czy skrypt stosu bez Dockera ma trafić do repo? Rekomendacja: **tak**,
  osobnym PR-em po D/E/F.

---

## 9. Szkic opisów PR-ów (po polsku)

### PR-D: Pierwszy kontakt się nie wywraca: baner cookies, okno roli, hydracja

**Po co.** Przejście całej ścieżki na żywym stosie (pierwszy raz bez Dockera, w polskiej
strefie czasowej, z nieposprzątaną przeglądarką) pokazało trzy rzeczy, których żaden
test nie widział, bo każdy test startuje z zaakceptowanymi cookies, odklikanym oknem
roli i strefą UTC:
- baner cookies po 6 s przykrywał „Dołącz bez konta” graczowi z linku i „Dalej” w kreatorze,
- okno „Kim jesteś?” wyskakiwało nad kreatorem i nad otwartym oknem zapisu, gdy
  logowanie skończyło się w innej karcie (link z maila),
- strona główna wywracała hydrację Reacta każdemu w Polsce, a „Możesz dołączyć już dziś”
  liczyło czas w UTC.

**Co się zmienia.**
- Baner cookies nie pokazuje się na ekranach z własnym dolnym paskiem akcji (ten sam
  sygnał co `HideBottomNav`); gdzie indziej bez zmian.
- Okno wyboru roli: decyduje też bieżąca strona (`czyPokazacWyborRoli()`).
- `lib/czasPolski.ts`: „teraz w Polsce” dla renderu serwerowego; etykiety względne na
  kartach meczu liczą się po montażu.

**Jak sprawdzone.** `tsc`, ESLint, Vitest (nowe: `banerCookies`, `wyborRoli`,
`czasPolski`), build, `check:docs`, nowy `hydracja.klikalnosc.spec.ts` w strefie
Europe/Warsaw, nowy scenariusz „pierwsza wizyta z linku” (bramka).

**Migracja.** Brak.

### PR-E: Gość bez konta wie, ile, jak i komu zapłacić

**Po co.** Gracz z kontem widział kwotę, sposób, numer BLIK (godzinę przed meczem)
i status wpłaty. Gość bez konta, czyli ten, kogo organizator przyprowadza linkiem
„zapisujesz się bez konta”, widział samą kwotę, a w oknie zapisu nawet jej nie było.
Organizator wpisujący numer BLIK zakładał, że zobaczą go wszyscy.

**Co się zmienia.**
- Migracja `163`: `podejrzyj_wpis_goscia()` oddaje sposób płatności, status i numer
  BLIK na tych samych warunkach co kontu (token = uprawnienie, jak przy wypisaniu).
- Karta „Twoja płatność” jako komponent, używana na stronie meczu i na stronie wpisu
  gościa; okno zapisu gościa pokazuje kwotę i mówi, gdzie pojawi się numer BLIK.
- Jedna forma kwoty w całej ścieżce: „20,00 zł” (`lib/kwota.ts`), teksty na czat bez zmian.

**Migracja.** `163_gosc_widzi_swoja_platnosc.sql` — podmienia jedną funkcję
(`DROP FUNCTION` + `CREATE`, zmienia się typ wyniku). Skaner ryzyka: bezpieczna, więc
**przy merge'u pojedzie na produkcję automatem** (workflow „Migracje”); na dev — przy
pushu gałęzi. Frontend ma wartości zapasowe na czas między deployem a migracją.

**Jak sprawdzone.** `tsc`, ESLint, Vitest (nowe: `platnoscGoscia`, `twojaPlatnosc`,
`kwota`; stare testy tekstów na czat bez zmian oczekiwań), build, `check:docs`,
`baza-testowa.sh` (nowe asercje w `poczta-goscia.sql`).

### PR-F: Logowanie i zapis bez domysłów

**Po co.** Trzy miejsca, w których gracz albo nowy organizator dostawał zdanie, które
go zatrzymywało: „Ostatni krok” po zapisie, który już się udał; „Nieprawidłowy e-mail
lub hasło” dla kogoś, kto konta jeszcze nie ma; zaproszenie do ekipy, które wymagało
konta, choć najbliższy mecz przyjmuje zapis bez niego.

**Co się zmienia.**
- Ekran po zapisie gościa: „Zapis gotowy, organizator Cię widzi. Konto nie jest
  potrzebne…”, bez zdublowanego toastu.
- `/logowanie`: zdanie zależne od tego, skąd ktoś przyszedł (kreator, zapis na mecz),
  i podpowiedź „Pierwszy raz tutaj? Załóż konto na ten adres” przy złych danych.
- `/g/[kod]`: „Zapisz się na ten mecz bez konta” przy najbliższym meczu ekipy; licznik
  bez obserwujących.

**Migracja.** Brak.

