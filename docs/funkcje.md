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

Zakładka „Nadchodzące" na `/moje-gry` renderuje **te same komponenty co pulpit
zalogowanego** (`components/home/dashboard/`), zamiast własnej, osobno utrzymywanej
listy: `InvitesSection` (limit 3, link do zakładki „Zaproszenia") → `NextMatchCard` →
`MyMatchesSection` → `ObservingSection`. Sekcje „Twoje grupy" i „Otwarte mecze" **nie**
są tu powtórzone — mają własne strony (`/grupy`, `/wydarzenia`).

Różnica względem pulpitu: `MyMatchesSection` i `ObservingSection` dostają
`limit={null} href={null}` — pełna lista bez obcięcia do 2 pozycji i bez linku
„Wszystkie" wracającego na tę samą stronę. `ObservingSection` dostaje też własny
`title="Obserwowane"` (na pulpicie: „Obserwujesz") i `subtitle` z wyjaśnieniem, że
obserwowanie nie rezerwuje miejsca — dokładnie tekst, który wcześniej był tu wpisany
ręcznie.

Brak osobnego pustego stanu dla zakładki: `NextMatchCard` ma własny („Nie masz
zaplanowanych gier" + „Stwórz mecz" / „Znajdź grę"), więc pokrywa przypadek zerowej
aktywności bez drugiej kopii tego ekranu.

Nagłówek „Twoje mecze" i przycisk „+ Nowy mecz" zniknęły ze strony — mecz tworzy się
z FAB-a (`+`) w dolnej nawigacji, dostępnego z każdego ekranu na mobile.

---

## Układ `/wydarzenia` — filtry, sortowanie, sekcje dzienne

Widok jest rozdzielony na dwie warstwy: **`EventsListView.tsx`** (sama treść) i
**`EventsListClient.tsx`** (`<Header/>` + widok). Podział jest po to, żeby ten sam widok
mógł posłużyć za tło ekranu logowania — patrz niżej.

| Element | Zachowanie |
|---|---|
| Chipsy sportu | emoji **+ nazwa**, źródłem `FOCUS_SPORTS`; „piłka nożna" łapie też `futsal` |
| „Kiedy" | Kiedykolwiek / Dzisiaj / Jutro / Ten tydzień / **Weekend** (najbliższa sobota i niedziela) |
| „Sortuj" | Najbliższy termin *(domyślnie)* / **Najbliżej mnie** / Najwięcej wolnych miejsc |
| Przełączniki | „Wolne miejsca" (odsiewa komplety), „Za darmo" (`costGrosze === 0`) |
| Szukanie | po tytule, sporcie, boisku i **dzielnicy**, przez `foldText` — „pilka" znajduje „piłka" |
| Sekcje dzienne | Dzisiaj / Jutro / W tym tygodniu / Później — **tylko** przy sortowaniu po terminie |
| Stronicowanie | 20 pozycji + „Pokaż więcej"; licznik resetuje się przy zmianie filtrów |

„Najbliżej mnie" pyta o zgodę na lokalizację przez `getCurrentLocation()`; przy odmowie
pokazuje komunikat z `geoErrorMessage()` i **wraca do sortowania po terminie**, żeby lista
nie została bez porządku. Mecz bez współrzędnych ląduje na końcu, ale nie wypada z wyników.

Sekcje dzienne wyłączają się przy sortowaniu po odległości i po liczbie miejsc: dwa
porządki naraz („po czasie" w nagłówkach, „po dystansie" w treści) wprowadzałyby w błąd.

Logika filtrowania, grupowania i sortowania żyje w `lib/eventFilters.ts` — w komponencie
nie dałoby się jej przetestować.

**Pigułki filtrów** (`components/ui/FilterPill.tsx`: `PillDropdown`, `TogglePill`) są
wspólne z mapą boisk (`VenueExplorer.tsx`), skąd zostały wyciągnięte. Panel rozwijany
renderuje się przez portal do `<body>`, bo pasek filtrów bywa `overflow-x-auto`
i przyciąłby menu.

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
