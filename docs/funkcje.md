# Inwentarz funkcji

Co aplikacja potrafi, gdzie to leży i **czy użytkownik to widzi**. Status wobec wizji →
[wizja.md](./wizja.md#2-status-implementacji).

---

## Flagi funkcji

**Najczęstsze źródło pomyłki w tym repo: „funkcja nie działa" — a ona działa, tylko jest
schowana.** Zanim uznasz coś za niezbudowane, sprawdź tę tabelę.

| Flaga | Wartość | Co chowa | Gdzie warunkuje |
|---|---|---|---|
| `SHOW_CUP` | `false` | Turniej / BOJO Cup | `Header.tsx`, `AnnouncementBar.tsx` |
| `SHOW_GAME_ALERTS` | `false` | „Ustaw alert" o grach w okolicy | `components/home/dashboard/DashboardSections.tsx` (sekcja „Otwarte mecze" na dashboardzie zalogowanego) |
| `SHOW_SMS_FEATURES` | `false` | Potwierdzenia SMS i przypomnienia | `app/wydarzenia/[id]/edytuj/page.tsx` |
| `SHOW_RECURRING` | `false` | Gry cykliczne | `Header.tsx`, `app/page.tsx`, `app/moje-gry/page.tsx` |
| `FEATURE_RESERVATIONS` | z env `NEXT_PUBLIC_FEATURE_RESERVATIONS` | Rezerwacje obiektów | `LeafletMapImpl.tsx`, `app/admin/[fieldId]/page.tsx` |

Cztery pierwsze: `frontend/src/lib/features.ts` (stałe w kodzie).
Piąta: `frontend/src/config/features.ts` (zmienna środowiskowa).

**Rezerwacje mają drugą furtkę per obiekt:** `showBookingForField()` zwraca `true`, jeśli
flaga globalna jest włączona **albo** dany obiekt ma `fields.booking_enabled = true`.
Czyli rezerwacje można włączyć pojedynczemu boisku bez odmrażania całej funkcji.

**Flagi ukrywają wejścia, nie trasy.** Trasa `/cykliczne` odpowiada normalnie, jeśli ktoś
wpisze adres ręcznie — flaga usuwa tylko linki w nawigacji. Dlatego trasy za flagami nie
trafiają do `llms.txt` ani do `sitemap.ts`: reklamowanie ich wyszukiwarce obiecuje coś,
czego użytkownik nie znajdzie w interfejsie.

---

## Gdzie jest spis tras

Celowo nie utrzymujemy tu inwentarza tras i komponentów — agent znajdzie je szybciej
przez `frontend/src/app/**` niż w tabeli, która by się zestarzała. Ludzki opis funkcji
z trasami: [PRZEWODNIK.md](../PRZEWODNIK.md). Admin = `profiles.is_admin = true`,
panel pod `/admin/*` (CRM kontaktu z obiektami: `/admin/outreach`, logika `lib/outreach.ts`).

---

## Funkcje meczu (opcje zaawansowane)

Włączane per mecz przy tworzeniu lub edycji, obsługiwane przez `lib/eventFeatures.ts`:

| Opcja | Kolumna | Efekt |
|---|---|---|
| Drużyny | `team_mode`, `teams_published` | Podział składu, kapitanowie, losowanie, publikacja |
| Wyniki | `track_results` | Wynik meczu + gole i asysty |
| Płatności | `track_payments`, `show_payment_status` | Podział kosztów, oznaczanie opłaconych |
| Bramkarze | `goalkeepers_enabled`, `max_goalkeepers` | Osobny limit; nadmiarowi na rezerwę |
| Akceptacja zapisów | `require_approval` | Zapis nie zajmuje miejsca do akceptacji |
| Goście bez konta | `allow_guest_adds` | Uczestnicy mogą dopisywać gości |
| Kod dołączenia | `join_code` | Wejście przez `/d/[code]` |
| Przejęcie wpisu gościa | `claim_token` | Osoba dopisana ręcznie wiąże wpis z kontem przez `/gracz/przejmij/[token]` |
| Potwierdzenie SMS | `require_sms_confirmation`, `confirmation_deadline_h` | **ukryte — `SHOW_SMS_FEATURES`** |

---

## Zaproszenia na mecz

Imienne zaproszenie (`event_player_invites`, migracja `060`, `lib/playerInvites.ts`) —
organizator albo dowolny potwierdzony uczestnik zaprasza konkretne osoby z ekipy
(`components/events/InviteFromGroupDialog.tsx`, przycisk „Zaproś z ekipy" na stronie
meczu). Zaproszenie nie zajmuje miejsca w składzie; odpowiedź to zwykłe „Dołącz" /
„Obserwuj" na stronie meczu albo „Nie tym razem" (odrzucenie, zapisywane trwale, żeby
ponowne „zaproś ekipę" nie wskrzeszało odrzuconego zaproszenia).

Gdzie widać otwarte zaproszenia:

| Miejsce | Co pokazuje |
|---|---|
| Strona główna (dashboard) | Sekcja „Zaproszenia" — max 3, znika przy zerze |
| `/moje-gry?tab=nadchodzace` | Ten sam teaser co na dashboardzie — max 3, link „Wszystkie" prowadzi do zakładki niżej |
| `/moje-gry?tab=zaproszenia` | Pełna lista, bez limitu, z pustym stanem |
| `/wydarzenia` | Plakietka „Zaproszenia N" obok pola wyszukiwania — **widoczna tylko gdy N > 0**, prowadzi do zakładki wyżej |

Wspólny hook `lib/useMyInvites.ts` (pobiera zaproszenia + mapę uczestnictwa, filtruje do
statusu `'invited'`) i wspólny komponent listy `components/events/InviteList.tsx` — cztery
powyższe miejsca renderują ten sam kod, żeby nie rozjeżdżały się przy zmianie.
`InvitesSection` (`components/home/dashboard/DashboardSections.tsx`) przyjmuje opcjonalne
`href`/`dismissedIds`/`onDismiss` właśnie po to, żeby dashboard i `/moje-gry` mogły dzielić
jeden komponent zamiast dwóch kopii — patrz sekcja „Układ `/moje-gry`" niżej.

Nie mylić z `lib/invites.ts` (tabela `event_invites`, migracja `036`) — zaproszenia po
e-mailu z tokenem, martwy kod, nic go nie importuje.

---

## Dolny panel nawigacji (mobile)

`components/layout/BottomNav.tsx`, montowany globalnie przez `BottomNavGate.tsx`
(`app/layout.tsx`) dla zalogowanych na mobile. Panel chowa się na dwóch ścieżkach, gdzie
zasłaniałby ważniejsze CTA:

- **Kreator meczu** (`/wydarzenia/nowe`) — cały czas, żeby nie rozpraszać organizatora
  i nie zasłaniać przycisku „Dalej".
- **Strona meczu**, dopóki widoczny jest pasek „Dołącz →" / „Obserwuj" (czyli dopóki
  użytkownik nie ma potwierdzonego miejsca ani oczekującej prośby). Po dołączeniu panel
  wraca — to zachęta do kolejnej akcji.

Mechanizm: `lib/bottomNavVisibility.tsx` — kontekst z licznikiem (nie boolean), żeby dwa
niezależne powody ukrycia nie odsłaniały panelu przedwcześnie. Komponent `<HideBottomNav/>`
montowany warunkowo chowa panel, dopóki jest zamontowany.

**Miejsce pod paskiem — zmienna `--bottom-nav-h`.** Pasek jest `fixed`, więc sam z siebie
nie rezerwuje miejsca w dokumencie. `BottomNavGate.tsx` ustawia `document.documentElement
.dataset.bottomNav = '1'`, dopóki pasek faktycznie jest widoczny (zalogowany, mobile, nie
schowany); `app/globals.css` reaguje na `html[data-bottom-nav='1']` i:
- dokłada `padding-bottom: var(--bottom-nav-h)` do `<body>`,
- odejmuje `--bottom-nav-h` od `.min-h-screen` / `.h-screen` (kolejność `vh` → `svh`, jak
  w `.hero-first-screen` — `svh` ignoruje chowający się pasek adresu).

Od `md:` (768px) `--bottom-nav-h` wraca do `0px` — pasek i tak jest `md:hidden`. Zastąpiło
to element-dystans (`<div className="h-16" />`), który **nie działał**: `BottomNavGate`
montuje się w layoucie po `{children}`, więc dystans lądował poza kontenerem strony i tylko
wydłużał dokument o 64 px — po dojechaniu do dołu każda strona dla zalogowanego na mobile
kończyła się pustym pasem tła. Wartość `--bottom-nav-h` (`3.5rem` + `env(safe-area-inset-bottom)`)
musi się zgadzać z rzeczywistą wysokością paska (`h-14` w `BottomNav.tsx`).

---

## Górny pasek nawigacji — inny dla zalogowanych na mobile

Poniżej `md` (768px) zalogowany użytkownik dostaje w `Header.tsx` **inny pasek** niż
wylogowany i niż desktop: bez logo, `h-12` zamiast `h-16`, po prawej dzwonek powiadomień
(`NotificationBell`) i awatar linkujący do `/profil` — zamiast logo + hamburgera. Powód:
wszystko, co było w arkuszu hamburgera dla zalogowanego (Moje mecze, Grupy, Moje obiekty,
panel admina, profil, motyw, Wyloguj), już jest dostępne w dolnym panelu nawigacji albo na
`/profil` — drugi zestaw tych samych skrótów tylko zjadał pierwszy ekran.

Skutek uboczny: dzwonek powiadomień, wcześniej wyłącznie w bloku `hidden md:flex`, jest
teraz dostępny na telefonie.

### Pasek znika całkiem na `/`, `/wydarzenia`, `/mapa`

Na tych trzech trasach zalogowany na mobile **w ogóle nie widzi paska Header** — dzwonek
i awatar wędrują do własnego wiersza strony, wzorem tego, jak od dawna robi to pulpit
(`GreetingBar`: powitanie + awatar w jednym wierszu). Mechanizm: `Header` dostaje prop
`hideMobileBarForUser` — gdy jest `true` **i** ktoś jest zalogowany, cały `<header>`
dostaje `hidden md:block` (znika na mobile, wraca od `md:`), a jego własny mobilny
dzwonek/awatar w ogóle się nie montuje (żeby nie było trzeciego, niewidocznego kanału
realtime obok tego w treści strony).

Zastępczy wiersz to nowy, współdzielony komponent `components/layout/MobileIdentityRow.tsx`
(dzwonek + awatar, markup 1:1 z mobilnego klastra `Header`) — sam sprawdza `useAuth()`
i zwraca `null` dla wylogowanego, więc wywołujący wstawia go bezwarunkowo:

| Trasa | Gdzie wiersz siedzi |
|---|---|
| `/` | `GreetingBar` — dzwonek obok istniejącego awatara `h-10 w-10` |
| `/wydarzenia` | `EventsListView` — jeden wiersz z polem szukania (`flex-1`) + `MobileIdentityRow` |
| `/mapa` | `VenueExplorer` — ten sam wiersz obok pływającego pola szukania nad mapą |

`/moje-gry` i `/grupy` **zachowują pełny pasek Header bez zmian** — `hideMobileBarForUser`
się tam nie przekazuje. Wylogowanych i desktop `hideMobileBarForUser` nie dotyczy nigdy:
wylogowany na tych trasach nadal widzi marketingowy pasek (mapa/Dołącz/awatar) opisany
niżej, a desktop ma pełny pasek jak zawsze.

**Hamburgera nie ma już w ogóle** — ani dla zalogowanych, ani dla wylogowanych. Arkusz
pełnoekranowy, pułapka focusa i blokada przewijania zostały usunięte z `Header.tsx`.

Wylogowany na mobile dostaje po prawej trzy elementy: **ikonę mapy** (`/mapa`), zielony
przycisk **„Dołącz"** i **ikonę awatara** (logowanie). „Dołącz" prowadzi na
`/logowanie?mode=rejestracja` i otwiera formularz od razu na zakładaniu konta —
`AuthForm` przyjmuje prop `initialMode`, domyślnie `'signin'`, więc pozostałe ~20 wejść
na `/logowanie` zachowuje się bez zmian.

Konsekwencja świadoma: **pasek przestał być nawigacją dla wylogowanego.** Do
`/wydarzenia` i `/wydarzenia/nowe` prowadzą CTA w hero landingu, klikalny krok
„Stwórz mecz" w sekcji „Jak to działa", kafelek w „Co dostajesz", pływający przycisk `+`
(`StickyCta`) oraz linki w stopce.

Desktop (`md:` i wyżej) ma na to miejsce, więc pokazuje oba wejścia z nazwami:
tekstowe „Zaloguj się" i zielone „Dołącz".

### `/profil` — nowy dom opcji z dawnego hamburgera

Zalogowany na mobile, chcąc przełączyć motyw, wejść do panelu admina albo zobaczyć swoje
obiekty, robi to na `/profil` (`app/profil/page.tsx`), nie w nagłówku:

| Sekcja | Warunek | Źródło |
|---|---|---|
| Moje statystyki | zawsze | link do `/gracz/[id]` |
| Moje obiekty | `hasManagedVenue(userId)` (`lib/api.ts`) | zarządza ≥1 obiektem |
| Wygląd (jasny/ciemny) | `next-themes` załadowany | `useTheme()`, ten sam wzorzec co w `Header.tsx` |
| Panel administratora | `useAdmin()` | lista z `lib/adminLinks.ts` — ta sama, co w `AdminMenu` na desktopie |
| Wyloguj się | zawsze | istniało już wcześniej |

`lib/adminLinks.ts` i `lib/api.ts#hasManagedVenue` to wspólne źródła prawdy między
`Header.tsx` (desktop) a `/profil` (mobile) — jedna lista tras, jedno zapytanie.

---

## Szkic kreatora meczu

Kreator (`app/wydarzenia/nowe/page.tsx`) zapamiętuje wypełniany formularz w
`localStorage` przez **12 godzin** (`lib/eventDraft.ts`, `EVENT_DRAFT_TTL_MS`) — jeśli
organizator wyjdzie w trakcie (np. sprawdzić godzinę wynajmu) i wróci, formularz stoi tam,
gdzie go zostawił, zamiast zerować się do stanu początkowego.

- **Odtwarzanie**: raz, przy montowaniu. **Pomijane całkowicie** przy wejściu z `?group=`
  albo `?fieldId=` — te parametry mają własne efekty prefill i kolidowałyby z odtworzonym
  szkicem; wejście z linku obiektu/grupy to świadomy start od nowa.
- **Data w przeszłości**: jeśli odtworzona data blokowałaby krok 2 (`isPast()`), podmieniana
  jest na jutro — reszta szkicu zostaje.
- **Pasek informacyjny**: „Wróciliśmy do Twojego szkicu (N minut/godzin temu)" +
  „Zacznij od nowa" (czyści `localStorage` i resetuje formularz do stanu początkowego).
- **Kasowanie**: po udanej publikacji meczu, automatycznie.

---

## Układ `/moje-gry`

Cztery zakładki w URL (`?tab=`): **Nadchodzące** (`nadchodzace`) / **Historia**
(`historia`) / **Zaproszenia** (`zaproszenia`) / **Obserwowane** (`obserwowane`).
`SLUG_TO_TAB`/`TAB_TO_SLUG` w `app/moje-gry/page.tsx` — nieznany `?tab=` cicho wraca do
„Nadchodzące", nie rzuca błędem.

Zakładka „Nadchodzące" renderuje **te same komponenty co pulpit zalogowanego**
(`components/home/dashboard/`), zamiast własnej, osobno utrzymywanej listy:
`InvitesSection` (limit 3, link do zakładki „Zaproszenia") → `NextMatchCard` →
`MyMatchesSection`. Sekcje „Twoje grupy" i „Otwarte mecze" **nie** są tu powtórzone —
mają własne strony (`/grupy`, `/wydarzenia`).

**Zakładka „Obserwowane"** to osobna lista `EventBrowseCard` (wzorem „Historii"), nie
sekcja pulpitu — obserwowane mecze mają teraz **jedno** miejsce, nie dwa: wcześniej
`ObservingSection` renderowała się też inline pod „Nadchodzące", co dublowało tę samą
informację w dwóch miejscach tej samej strony.

Różnica względem pulpitu: `MyMatchesSection` dostaje `limit={null} href={null}` — pełna
lista bez obcięcia do 2 pozycji i bez linku „Wszystkie" wracającego na tę samą stronę.

Brak osobnego pustego stanu dla „Nadchodzące": `NextMatchCard` ma własny („Nie masz
zaplanowanych gier" + „Stwórz mecz" / „Znajdź grę"), więc pokrywa przypadek zerowej
aktywności bez drugiej kopii tego ekranu.

Nagłówek „Twoje mecze" i przycisk „+ Nowy mecz" zniknęły ze strony — mecz tworzy się
z FAB-a (`+`) w dolnej nawigacji, dostępnego z każdego ekranu na mobile.

---

## Układ `/wydarzenia` — filtry, sortowanie, sekcje dzienne

Widok jest rozdzielony na dwie warstwy: **`EventsListView.tsx`** (sama treść) i
**`EventsListClient.tsx`** (`<Header/>` + widok). Podział jest po to, żeby ten sam widok
mógł posłużyć za tło ekranu logowania — patrz niżej.

**Nagłówek zależy od tego, kto patrzy.** Zalogowany na mobile (Header ma tu schowany
pasek, patrz wyżej) dostaje jeden wiersz: pole szukania (placeholder **„Znajdź grę"**,
bez osobnego `<h1>`) + `MobileIdentityRow` (dzwonek, awatar); plakietka „Zaproszenia N"
schodzi pod spód, bo na 360px szerokości cała czwórka nie mieści się bezpiecznie w
jednej linii. Wylogowany (dowolna szerokość) i zalogowany na desktopie widzą klasyczny
układ: `<h1>Znajdź grę</h1>` + plakietka, potem osobny wiersz szukania z placeholderem
„Nazwa, boisko albo dzielnica…". Oba warianty pola szukania są osobnymi blokami JSX
(nie jednym elementem sterowanym media query) — dokładnie ten sam wzorzec, co mobile/
desktop gałęzie w `Header.tsx`.

| Element | Zachowanie |
|---|---|
| Chipsy sportu | emoji **+ nazwa**, źródłem `FOCUS_SPORTS`; „piłka nożna" łapie też `futsal`; zostają zawsze widoczne, poza modalem |
| Przycisk **„Filtry"** | otwiera `FilterSheet` (modal w stylu Booking) z sekcjami Kiedy / Sortuj / Odległość |
| Przełączniki inline | „Wolne miejsca" (odsiewa komplety), „Za darmo" (`costGrosze === 0`) — zostają obok przycisku „Filtry", nie w modalu |
| „Kiedy" *(w modalu)* | Kiedykolwiek / Dzisiaj / Jutro / Ten tydzień / **Weekend** (najbliższa sobota i niedziela) |
| „Sortuj" *(w modalu)* | Najbliższy termin *(domyślnie)* / **Najbliżej mnie** / Najwięcej wolnych miejsc |
| „Odległość" *(w modalu, nowość)* | chipsy `< 1 km` / `< 2` / `< 5` / `< 10` / `< 15`, pojedynczy wybór |
| Szukanie | po tytule, sporcie, boisku i **dzielnicy**, przez `foldText` — „pilka" znajduje „piłka" |
| Sekcje dzienne | Dzisiaj / Jutro / W tym tygodniu / Później — **tylko** przy sortowaniu po terminie |
| Stronicowanie | 20 pozycji + „Pokaż więcej"; licznik resetuje się przy zmianie filtrów |

**Modal filtrów działa na szkicu, nie na żywym stanie** (styl Booking: wybierz kilka
rzeczy, potem zatwierdź). Otwarcie kopiuje bieżące `dateFilter`/`sortBy`/`radiusKm` do
`draftDate`/`draftSort`/`draftRadius`; dotykanie opcji w modalu zmienia wyłącznie szkic.
Przycisk zatwierdzenia pokazuje na żywo `Pokaż N meczów` (licznik z draftu, promień
pomijany w podglądzie, dopóki nie jest znana pozycja użytkownika) i dopiero jego
kliknięcie commituje szkic do prawdziwego stanu — wtedy, jeśli trzeba, pyta raz o zgodę
na lokalizację (ten sam `getCurrentLocation()`/`geoErrorMessage()` co dawniej przy
bezpośrednim „Sortuj → Najbliżej mnie"; przy odmowie sortowanie i promień wracają do
wartości domyślnych). „Wyczyść" resetuje szkic bez zamykania modala; zamknięcie przez
tło/X/Escape odrzuca szkic bez dotykania prawdziwych filtrów.

Sekcje dzienne wyłączają się przy sortowaniu po odległości i po liczbie miejsc: dwa
porządki naraz („po czasie" w nagłówkach, „po dystansie" w treści) wprowadzałyby w błąd.

Logika filtrowania, grupowania, sortowania i promienia (`filterByRadius`) żyje w
`lib/eventFilters.ts` — w komponencie nie dałoby się jej przetestować.

**Modal filtrów** (`components/ui/FilterSheet.tsx`) jest wspólny z mapą boisk
(`VenueExplorer.tsx`) — jedna powłoka (portal do `<body>`, bottom sheet na mobile,
wyśrodkowana karta od `md:`), różna wyłącznie treść sekcji. **Pigułki filtrów**
(`components/ui/FilterPill.tsx`: `PillDropdown`, `TogglePill`) też są wspólne z mapą.

### `/logowanie` na tle listy meczów

`app/logowanie/page.tsx` renderuje pod kartą formularza **prawdziwy** `EventsListView`
(`components/auth/LoginBackdrop.tsx`), przykryty mgiełką `bg-black/20` + delikatnym
rozmyciem. `/logowanie` **zostaje zwykłą trasą**, nie modalem przechwytującym: większość
wejść na ten ekran to twarde `window.location.href`, których intercepting route i tak by
nie złapał, a trasa musi działać po odświeżeniu i z linku w mailu.

Tło jest dekoracją i jest całkowicie bierne: `pointer-events-none`, `overflow-hidden`,
`aria-hidden` **oraz `inert`**. Samo `aria-hidden` nad kontenerem pełnym odnośników
byłoby błędem dostępności — czytnik ekranu ich nie widzi, ale Tab dalej w nie wchodzi.
React 18 nie zna propa `inert` (doszedł w 19), więc atrybut ustawiany jest przez `ref`.

---

## Układ `/grupy/[id]`

Trasa jest rozdzielona na serwerowy `page.tsx` (z `generateMetadata`) i
`GroupDetailClient.tsx`. Metadane są tu istotne, bo **strona grupy jest celem linku
zaproszenia** `/g/[kod]` — bez nich każde udostępnienie pokazywało generyczny tytuł
całej aplikacji.

Układ od góry: hero z okładką (nazwa + plakietki sport / miasto / liczba członków) →
„Najbliższy mecz" (dla członka) → zakładki **Mecze / Skład** → przyklejony pasek z jedną
główną akcją („Dołącz do grupy" albo „Stwórz mecz w grupie"), odsunięty od dolnej
nawigacji przez `var(--bottom-nav-h)`.

**Wejście z linku zaproszenia.** `/g/[kod]` przekierowuje na `/grupy/[id]?join=1` i tak
było od zawsze — ale nikt tego parametru nie czytał. Teraz, gdy `?join=1` jest w adresie
**i** użytkownik nie należy do grupy, nad wszystkim pojawia się baner „Masz zaproszenie
do *nazwa*" z przyciskiem dołączenia; pasek na dole wtedy się nie dubluje.

Zakładka trzyma stan w URL (`?tab=sklad`), ale przez `window.history.replaceState`,
**nie** `router.replace` jak na `/moje-gry`. Powód: `/moje-gry` jest trasą statyczną
i nawigacja nic nie kosztuje, a `/grupy/[id]` jest dynamiczna — każde `router.replace`
byłoby round-tripem po dane z serwera (łącznie z `generateMetadata`), przez co adres
w praktyce w ogóle się nie zmieniał.

Członkostwo pochodzi z **osobnego** zapytania `isGroupMember()`, nie z listy członków:
gdy dogrywka danych padnie, członek grupy nie zobaczy przycisku „Dołącz do grupy".

---

## Układ `/mapa` — szukanie, filtry, powrót z boiska

**Szukanie po tekście działa poza bieżącym kadrem.** Wcześniej pole szukania filtrowało
wyłącznie `allFields` — to, co i tak było już wczytane dla widocznego fragmentu mapy: przy
oddaleniu (tryb skupisk) ta lista jest pusta, więc szukanie nic nie znajdowało; przy
przybliżeniu ograniczało się do tego, co widać, więc wpisanie miasta spoza kadru też nic
nie dawało. Od dwóch znaków zapytania (debounce 300 ms) `VenueExplorer` woła
`searchExplorerFields()` z `lib/api.ts` — funkcję, która już istniała (używają jej
pickery lokalizacji), tylko nigdy nie była tu wpięta — i mapa robi `fitBounds` do
wyników. Tryb skupisk wyłącza się na czas aktywnego szukania niezależnie od przybliżenia.

**Powrót ze strony boiska wraca na ten sam obiekt.** Karta „Zobacz boisko" (`VenueCard`)
linkuje teraz z `?wroc=/mapa?boisko=<id>` zamiast gołego `/boisko/<slug>`. Strona boiska
(`VenueDetailClient.tsx`) już umiała wrócić pod dowolny adres z parametru `wroc`, a
`VenueExplorer` już umiał obsłużyć `?boisko=<id>` po wejściu z linku (`boiskoZLinku`) —
brakowało tylko połączenia obu gotowych mechanizmów.

**Filtry — przycisk „Filtry" + modal, jak na `/wydarzenia`.** Sport i dwa przełączniki
(„Gry dziś", „Otwarte gry") zostają zawsze widoczne; Typ obiektu i Nawierzchnia
przenoszą się do `FilterSheet` (ten sam współdzielony komponent, patrz „Układ
`/wydarzenia`"), bo są drugorzędne i rzadziej dotykane:

| Filtr | Gdzie | Uwaga |
|---|---|---|
| Sport | inline, dropdown | źródło `MAP_FILTER_SPORTS` (`lib/sports.ts`) — **6** opcji, nie 4: dołożone `wielofunkcyjne` (4118 obiektów) i `piłka ręczna` (806), które miały już kolorową pinezkę na mapie, ale nie dało się ich wybrać w filtrze |
| „Gry dziś" | inline, przełącznik | bez zmian |
| „Otwarte gry" *(nowość)* | inline, przełącznik | obiekt ma co najmniej jeden mecz spełniający `isEventJoinable()` i nieodwołany — ta sama definicja „otwarte", co na `/wydarzenia` |
| Typ obiektu | w modalu | lista bez zmian, tylko przeniesiona z zawsze-widocznego dropdownu |
| Nawierzchnia *(nowość)* | w modalu | checklist: Trawa naturalna / Sztuczna trawa / Nawierzchnia twarda / Piasek / Beton / Mączka ceglana; etykiety przez `surfaceLabel()` z `lib/labels.ts` |

**Dlaczego Typ obiektu przestał być zawsze widoczny, a Nawierzchnia się pojawiła:**
`venue_type` ma dziś **98,3%** publicznych obiektów jako `NULL` (import z OSM go nie
ustawia) — wybranie jakiegokolwiek konkretnego typu wyglądało jak zepsuta wyszukiwarka,
bo odsiewało niemal cały katalog. `surface` ma dane w **37%** wierszy z realnym
zróżnicowaniem (trawa, nawierzchnia twarda, piasek, beton, sztuczna trawa, mączka) — to
jest facet, który realnie coś filtruje, mimo że wcześniej nie dało się po nim szukać.
Kolumna `surface` dołączona do okrojonego `EXPLORER_COLS` w `lib/api.ts` (istniała w
tabeli, po prostu nie była pobierana) — zero migracji.

Modal ma tę samą mechanikę szkicu co na `/wydarzenia`: wybory w „Typ obiektu"/
„Nawierzchnia" aplikują się dopiero po „Pokaż N obiektów", „Wyczyść" resetuje szkic bez
zamykania. Renderowany **raz** na komponent (nie raz na sidebar desktopu i raz na
mobilny overlay) — oba przyciski „Filtry" otwierają ten sam, współdzielony stan.

Filtr nawierzchni i przełącznik „Otwarte gry" działają **tylko w trybie pojedynczych
obiektów** (przybliżenie ≥ próg skupisk) — w trybie skupisk (oddalona mapa) nie są
przekazywane do `getExplorerClusters()`, dokładnie tak jak już wcześniej działało
„Gry dziś". Sport i Typ obiektu działają w obu trybach — RPC `mapa_skupiska` przyjmuje
generyczne tablice `p_sporty`/`p_typy`, więc nowe wartości sportu przechodzą bez żadnej
zmiany funkcji.

**Zalogowany na mobile** dostaje w tym samym pływającym wierszu co pole szukania również
`MobileIdentityRow` (dzwonek + awatar) — Header na tej trasie chowa swój pasek, patrz
„Górny pasek nawigacji" wyżej.

---

## Powiadomienia — co realnie istnieje

Wbrew starszym notatkom kanał powiadomień **jest zbudowany**:

| Element | Gdzie |
|---|---|
| Tabela `notifications` | migracja `025` |
| Logika | `lib/notifications.ts` |
| UI (dzwonek) | `components/layout/NotificationBell.tsx`, renderowany w `Header.tsx` |
| E-mail | Edge function `notify-game-alert` → Resend |
| SMS | Edge function `send-event-sms` → SMSAPI + Twilio |
| Zaproszenia cykliczne | Edge function `send-invites` |

Czego brakuje: **wyzwalacza przy utworzeniu gry w grupie**. Jedyna ścieżka powiadomienia
o nowej grze to `game_alerts` (promień + sport), a ta jest ukryta flagą
`SHOW_GAME_ALERTS`. To [luka 2 wobec wizji](./wizja.md#3-luki).

---

## Czego NIE ma

Zapora przed zmyślaniem. Poniższe **nie istnieje** w kodzie — jeśli piszesz dokumentację
albo odpowiadasz na pytanie o aplikację, nie zakładaj, że to działa:

- **Auto-awans z listy rezerwowej.** Zwolnione miejsce jest **oferowane** pierwszej
  osobie z rezerwy, która musi je sama przyjąć — nikt nie trafia do składu po cichu
  ([domena.md](./domena.md#zwolnione-miejsce-oferta-nie-auto-awans)). Nie „naprawiać".
- **Trzeci poziom widoczności meczu** („widoczne dla grupy"). `events.visibility` to
  wyłącznie `private` / `public`.
- **Powiadomienie dla członków grupy o nowej grze.**
- **MVP** w statystykach. Jedyne wystąpienie słowa to tekst nagrody na `/turniej`.
- **Rankingi publiczne.**
- **Ocena umiejętności, poziom zaawansowania, dopasowywanie gier do poziomu.**
- **Odznaki** — poza znaczkiem „rzetelny gracz".
- **Realny przepływ pieniędzy** (BLIK/Stripe). Aplikacja rejestruje, kto zapłacił —
  nie przelewa.
- **Wynajem sędziego.**
- **Lista graczy pod `/gracze`** — to redirect.
- **Osobny backend, API, kontrolery.** Frontend rozmawia z Supabase bezpośrednio.
- **Automatyczne uruchamianie migracji.**

### Martwy kod

| Plik | Uwaga |
|---|---|
| `components/map/MapView.tsx` | nic nie importuje |
| `components/map/LeafletMapImpl.tsx` | nic nie importuje |
| `components/map/EventsMapView.tsx` | nic nie importuje |
| `components/map/EventsMapImpl.tsx` | nic nie importuje |
| `components/home/NearbyGames.tsx` | kompletny, nigdzie nie renderowany |
| `components/home/landing/PhoneFrame.tsx` | ramka telefonu wokół zrzutu ekranu; podgląd na landingu rysuje dziś makiety w JSX (`PhoneCarousel`), więc nikt tego nie importuje |
| tabela `games` | zastąpiona przez `events` w `002` |

**Aktywna mapa to `VenueExplorer.tsx`** (strona `/mapa`) oraz pickery lokalizacji.
