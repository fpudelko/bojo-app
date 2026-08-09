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
| Płatności | `track_payments`, `show_payment_status` | Podział kosztów (organizator), karta „Twoja płatność" (uczestnik) |
| Bramkarze | `goalkeepers_enabled`, `max_goalkeepers` | Osobny limit; nadmiarowi na rezerwę |
| Akceptacja zapisów | `require_approval` | Zapis nie zajmuje miejsca do akceptacji |
| Goście bez konta | `allow_guest_adds` | Uczestnicy mogą dopisywać gości |
| Kod dołączenia | `join_code` | Wejście przez `/d/[code]` |
| Przejęcie wpisu gościa | `claim_token` | Osoba dopisana ręcznie wiąże wpis z kontem przez `/gracz/przejmij/[token]` |
| Potwierdzenie SMS | `require_sms_confirmation`, `confirmation_deadline_h` | **ukryte — `SHOW_SMS_FEATURES`** |

**„Twoja płatność" — uczestnik widzi, ile ma zapłacić.** Do niedawna kwotę po
uwzględnieniu zniżki kartowej i status opłacone/nieopłacone widział wyłącznie
organizator w panelu „Podział kosztów". Karta na stronie meczu
(`EventDetailClient.tsx`, `costGrosze > 0 && !isOwner && event.showPaymentStatus &&
myConfirmed && !myConfirmed.isReserve`) liczy cenę przez `priceForParticipant()` —
ten sam wzorzec co panel organizatora, jedno źródło prawdy. Rezerwowy nie widzi tej
karty: jeszcze nie ma za co płacić, dopóki nie wejdzie do składu.

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

**Jeden przycisk „Zaproś z ekipy" na stronie, nie dwa.** Do niedawna były dwa — przy
liczniku wolnych miejsc i osobno w sekcji „Zaproś znajomych" — z różnymi ikonami i różnymi
warunkami widoczności. Zostaje wyłącznie ten przy liczniku (`!isFull`, ikona `Users`);
sekcja niżej na stronie ma dziś tylko udostępnianie linku.

**Kto zaprosił, kto odpowiedział — widok organizatora.**
`components/events/EventInvitesStatus.tsx`, tylko `isOwner` (RLS na
`event_player_invites` i tak nie przepuści reszty — SELECT widzi zaproszony, organizator
i admin). Lista imion z awatarami i statusem: Czeka / Dołączył(a) / Nie tym razem. Nazwy
dociąga `getEventInvitesWithNames()` (`lib/playerInvites.ts`) drugim zapytaniem do
`profiles` — `event_player_invites` ma klucz obcy do `auth.users`, nie do `profiles`, więc
PostgREST nie potrafi tego wbudować jednym joinem. Reguła „uczestnictwo bije wcześniejszą
odmowę" (`lib/inviteStatus.ts`, pod testem) — ktoś mógł kliknąć „Nie tym razem" i mimo to
dołączyć innym kanałem; `dismissed_at` sprawdza się dopiero, gdy w składzie go nie ma.

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

**Kompaktowy wordmark „bojo" na mobile — `/moje-gry`, `/grupy`, `/grupy/[id]`, widok
wydarzenia.** Te trasy zostawiają pasek Header (nie mają `MobileIdentityRow` we własnej
treści), a zalogowany na mobile ma tam dziś pusty lewy slot — logo (`LogoPill`) jest
`hidden md:block`. Nowy prop `Header({ showMobileWordmark })` wypełnia ten slot
tekstowym linkiem „bojo" (`font-display font-bold text-primary-700`) do `/`, bez zmiany
wysokości paska (`h-12` na mobile zostaje). Przekazywany na `app/moje-gry/page.tsx`,
`app/grupy/GroupsClient.tsx`, `app/grupy/[id]/GroupDetailClient.tsx` i
`app/wydarzenia/[id]/EventDetailClient.tsx` — nigdzie indziej.

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
- **Zapis dopiero po pierwszej realnej zmianie**: efekt zapisujący szkic pomija swoje
  pierwsze uruchomienie po hydratacji (`useRef` `isFirstSave`) — bez tego zapisywał czyste
  wartości domyślne przy samym wejściu na stronę, więc kolejna wizyta w oknie 12h TTL
  pokazywała baner odtworzenia mimo braku jakiejkolwiek edycji.
- **Pasek informacyjny**: jedna linia „Wróciliśmy do Twojego szkicu (N minut/godzin temu).
  Zacznij od nowa" + osobny krzyżyk. „Zacznij od nowa" czyści `localStorage` i resetuje
  formularz do stanu początkowego; krzyżyk tylko chowa baner na czas tej wizyty
  (lokalny `useState`, nie dotyka `localStorage` ani TTL) — pojawi się znów po odświeżeniu,
  jeśli szkic wciąż jest ważny.
- **Kasowanie**: po udanej publikacji meczu, automatycznie.

Pole `nazwaWlasnaMiejsca` (nazwa dla pinezki spoza katalogu) jest w `EventDraftValues`
**opcjonalne**, a wersja schematu została na `v: 1`. To celowe: `loadEventDraft` odrzuca
szkic przy `parsed.v !== 1`, więc podbicie wersji unieważniłoby każdy formularz wypełniany
w chwili wdrożenia. Odczyt robi `?? ''`. Pokryte testem w `eventDraft.test.ts`. Tak samo
opcjonalne — i z tego samego powodu — jest `grupaId` (ekipa wybrana w kroku 3).

---

## Kreator meczu — co widać na którym kroku

**Wordmark „bojo" w pasku.** Kreator montuje `<HideBottomNav />`, więc bez wordmarku
zalogowany na telefonie nie miał stamtąd żadnego wyjścia „do domu". Oba `<Header />`
w `app/wydarzenia/nowe/page.tsx` (brama logowania i właściwy kreator) dostają
`showMobileWordmark` — ten sam prop co `/moje-gry`, `/grupy`, `/wydarzenia/[id]`.
Wysokość paska bez zmian (`h-12`, sticky stepper na `top-12`).

**Krok 1 — propozycja ostatniego boiska.** `lib/lastVenue.ts` zapamiętuje ostatnio
wybrany obiekt z katalogu (`localStorage`, klucz `bojo_ostatnie_boisko_v1`, TTL 60 dni,
guardowany `try/catch` jak `eventDraft.ts`). Zapis następuje po udanej publikacji,
**przed** `clearEventDraft()`, i tylko gdy miejsce pochodziło z katalogu — pinezka własna
nie ma `id`. Odczyt pokazuje chip „Ostatnio: «nazwa» — Użyj", widoczny wyłącznie gdy
miejsce nie jest jeszcze wybrane. To **propozycja, nie autowybór**: ciche ustawienie
miejsca meczu jest najgorszą możliwą pomyłką do przeoczenia.

**Krok 2 — „Czas na decyzję z rezerwy" bez chowania.** Pole stoi na stałe pod „Liczbą
miejsc" (opcje 1/3/6/12/24 h, domyślnie 3). Wcześniej siedziało pod rozwijanym „Więcej
opcji" — sekcja została w kodzie, ale nie ma dziś czego pokazać i się nie renderuje.
Odwrócenie ustalenia O-11 audytu, patrz [przeplyw-organizatora.md](./przeplyw-organizatora.md).
Obok steppera liczby miejsc stoi podpowiedź, że graczy dopisuje się po utworzeniu meczu,
na jego stronie, także bez konta.

**Krok 2 — kafelek „Wydarzenie cykliczne".** Obok pól daty/godziny, kafelek otwiera
`components/events/RecurringSettingsDialog.tsx` z dniem tygodnia wyliczonym z wybranej
daty (`lib/recurring.ts#dayOfWeekFromDate`) i suwakiem „powiadamiaj X dni wcześniej".
Kliknięcie aktywnego kafelka wyłącza cykliczność, ikona ołówka na aktywnym kafelku
ponownie otwiera modal. Ustawienia żyją wyłącznie w stanie kreatora — dopiero publikacja
meczu tworzy **niezależny** szablon w `recurring_events` (`createRecurringEvent`), bez
próby powiązania z konkretnym jednorazowym meczem, bo kolumna `events.recurring_event_id`
nie istnieje w schemacie. Po publikacji strona meczu pokazuje jednorazowy link do panelu
serii (`/cykliczne/{id}`) przez `?cykliczne=<id>` — ta trasa działa mimo że nawigacja do
`/cykliczne` jest schowana za `SHOW_RECURRING` (flagi chowają wejścia, nie trasy).
Zakres świadomie minimalny — patrz „Czego NIE ma" niżej.

**Krok 3 — mecz w ramach ekipy.** Wiersz pod kartami widoczności otwiera
`components/events/WybierzGrupeDialog.tsx` (bottom sheet od najmniejszych ekranów,
wyśrodkowana karta od `sm:`) z listą `getMyGroups()`. Wybór trafia do `createEvent`
jako `groupId`. Wiersz jest **osobny od widoczności**, bo przypisanie do ekipy jest
wobec niej ortogonalne: mecz grupy bywa publiczny. Wejście `?group=` preselekcjonuje
ten sam stan.

„Załóż ekipę"/„Załóż nową ekipę" **nie prowadzi na `/grupy/nowe`** — otwiera drugi tryb
tego samego dialogu, okrojony formularz (nazwa + sport) w tym samym oknie. Nawigacja na
osobną trasę wyrzucała organizatora z kreatora w połowie wypełniania; po `createGroup()`
+ `getGroup()` dialog wywołuje ten sam `onWybierz(grupa)` co wybór z listy — zamyka się
i wraca dokładnie na krok 3, z nowo założoną ekipą już wybraną.

**Powrót po publikacji.** „← Wróć" na stronie świeżo utworzonego meczu (`?utworzono=1`)
prowadzi na `/moje-gry`, nie `router.back()` — cofanie wracało do wypełnionego kreatora.
Wejścia z listy, mapy czy linku zachowują zwykłe „wstecz".

---

## Podsumowanie przed publikacją

Ostatni krok kreatora kończy się kartą **„Tak zobaczą to gracze"**
(`app/wydarzenia/nowe/PodsumowanieMeczu.tsx`, logika w `lib/eventSummary.ts`). Powód:
przycisk „Opublikuj mecz" stoi na kroku 3, a data, miejsce, skład i cena były ustawiane na
krokach 1–2 i w chwili publikacji nie były widoczne.

Sześć wierszy — Co / Kiedy / Gdzie / Skład / Koszt / Kto widzi — każdy z przyciskiem
„Zmień" wołającym `attemptGoToStep`. Cofanie nigdy nie waliduje, więc skok jest bezpieczny
z każdego wiersza. Siódmy wiersz to **organizator**: „Wyświetlasz się jako X" z edycją
inline przez `updateDisplayName`; gdy konto nie ma **pełnej** nazwy własnej (imię
i nazwisko — `lib/profileName.ts#isPelneImie`, nie tylko dowolnie niepuste pole), pole
startuje rozwinięte.

Trzy ostrzeżenia, które **nie blokują** publikacji (krok 3 celowo nie ma pól wymaganych —
`validateStep3` zwraca `{}`): mecz jest dzisiaj, miejsce zostało bez nazwy (same
współrzędne po nieudanym reverse geocodingu), cena bez wybranej metody płatności.

---

## Po publikacji: „Mecz gotowy — wyślij link"

Kreator przekierowuje na `/wydarzenia/{id}?utworzono=1`, a strona meczu pokazuje
organizatorowi odrzucalny panel: „Wyślij link ekipie" (pełna szerokość), pod nim „Kopiuj
link" i „Zaproś z ekipy", na dole jedno zdanie o konsekwencji wybranej widoczności.

Parametr czytany jest z `window.location.search` w `useEffect`, **nie** przez
`useSearchParams()` — ten hak wymusza na trasie prerenderowanej bail-out do CSR i wywala
produkcyjny build (pułapka opisana w `AGENTS.md`). Zaraz po odczycie parametr znika
z adresu przez `history.replaceState`, więc odświeżenie nie pokazuje panelu drugi raz.

Gdy kreator utworzył razem z meczem szablon cykliczny (kafelek na kroku 2), doszedł
`?cykliczne=<id>` — czytany tym samym `useEffect` i zdejmowany tak samo. Panel dostaje
wtedy dodatkowy link „Ustawiłeś powtarzanie co tydzień — zarządzaj serią" do
`/cykliczne/{id}`.

**Jeden link i jeden tekst dla całej aplikacji** — `lib/eventShare.ts`. `eventUrl()` zwraca
adres kanoniczny `/wydarzenia/{id}`, a nie krótki `/d/{kod}`: `robots.ts` trzyma `/d/` poza
indeksowaniem, więc crawlery Facebooka i WhatsAppa nie pobiorą Open Graph i taki link leci
na czat bez podglądu. `eventShareText()` składa cztery linie (sport i tytuł / dzień, data,
zakres godzin / miejsce z adresem / liczba miejsc i cena), a `shareEvent()` przekazuje je
do arkusza systemowego razem z adresem — osobno od tekstu, żeby podgląd linku działał.

Trasa `/d/[code]` zostaje żywa dla linków już rozesłanych; zniknęła tylko jako drugi,
konkurencyjny przycisk „Udostępnij" na tej samej stronie.

---

## Układ `/moje-gry`

Cztery zakładki w URL (`?tab=`): **Nadchodzące** (`nadchodzace`) / **Historia**
(`historia`) / **Zaproszenia** (`zaproszenia`) / **Obserwowane** (`obserwowane`).
`SLUG_TO_TAB`/`TAB_TO_SLUG` w `app/moje-gry/page.tsx` — nieznany `?tab=` cicho wraca do
„Nadchodzące", nie rzuca błędem. Pasek zakładek scrolluje się w bok (`overflow-x-auto`
z ukrytym scrollbarem, `shrink-0` na każdym przycisku) — cztery zakładki + dwie plakietki
liczników nie mieściły się zawsze na 360px.

Zakładka „Nadchodzące" renderuje **te same komponenty co pulpit zalogowanego**
(`components/home/dashboard/`), zamiast własnej, osobno utrzymywanej listy:
`InvitesSection` (limit 3, link do zakładki „Zaproszenia") → `NeedsPlayersSection` →
`NextMatchCard` → `MyMatchesSection`. Sekcje „Twoje grupy" i „Otwarte mecze" **nie** są tu
powtórzone — mają własne strony (`/grupy`, `/wydarzenia`).

**„Brakuje graczy"** (`NeedsPlayersSection`, `components/home/dashboard/DashboardSections.tsx`)
— organizowane, nadchodzące mecze, które jeszcze nie mają kompletu, sortowane od
najbliższego terminu. Odpowiada na pytanie, na które `/moje-gry` dotąd nie miało jak
odpowiedzieć: „na który z moich meczów nie zbiera się skład". Dane są już pobrane przez
`getMyParticipatedEvents()` (`participantsCount` liczy `toEvent()` z dołączonego
`event_participants`) — zero nowego zapytania. Renderuje `EventBrowseCard`, tak jak
`MyMatchesSection` niżej — to osobna, DODATKOWA sekcja, nie zamiana świadomie
scalonej listy „organizujesz + grasz" (patrz komentarz w `lib/myEvents.ts`).

**Zakładka „Obserwowane"** to osobna lista `EventBrowseCard` (wzorem „Historii"), nie
sekcja pulpitu — obserwowane mecze mają teraz **jedno** miejsce, nie dwa: wcześniej
`ObservingSection` renderowała się też inline pod „Nadchodzące", co dublowało tę samą
informację w dwóch miejscach tej samej strony.

Różnica względem pulpitu: `MyMatchesSection` dostaje `limit={null} href={null}` — pełna
lista bez obcięcia do 2 pozycji i bez linku „Wszystkie" wracającego na tę samą stronę.

Brak osobnego pustego stanu dla „Nadchodzące": `NextMatchCard` ma własny („Nie masz
zaplanowanych gier" + „Stwórz mecz" / „Znajdź grę"), więc pokrywa przypadek zerowej
aktywności bez drugiej kopii tego ekranu.

**`NextMatchCard` (wypełniony stan) renderuje `EventBrowseCard`** — ten sam komponent
karty co reszta sekcji „Twoje najbliższe mecze" i zakładka „Historia" — pod etykietą
„NAJBLIŻSZY MECZ", zamiast własnego, większego markupu (osobny pasek postępu, przycisk
„Udostępnij"). Konsekwencja: dedykowany przycisk „Udostępnij" na tej karcie zniknął —
mecz nadal da się udostępnić ze strony szczegółów wydarzenia. Pusty stan zostaje bez
zmian, to nie on był „za duży".

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

**Jeden pasek kafelków**, w tej kolejności, scrolluje się w bok gdy nie mieści się w
jednej linii (`overflow-x-auto` z ukrytym scrollbarem):

| Element | Zachowanie |
|---|---|
| **„Sortuj"** *(dropdown)* | `PillDropdown` (`components/ui/FilterPill.tsx`), single-select, aplikuje się **natychmiast** po kliknięciu opcji (nie przez szkic modala): Najbliższy termin *(domyślnie)* / **Najbliżej mnie** (pyta o lokalizację od razu, pokazuje „Szukam Cię…" w trakcie) / Najwięcej wolnych miejsc |
| **„Filtry"** *(przycisk → modal)* | otwiera `FilterSheet` z czterema suwakami: Kiedy / Odległość / Cena / Wolne miejsca |
| **Sport** *(dropdown)* | `PillDropdown`, multi-select, źródło `FOCUS_SPORTS` (4 opcje); „piłka nożna" łapie też `futsal` |
| „Wolne miejsca" *(toggle)* | odsiewa komplety (`participantsCount < maxPlayers`) — **inny** filtr niż suwak „Wolne miejsca" w modalu, patrz niżej |
| „Za darmo" *(toggle)* | `costGrosze === 0` |

**Cztery suwaki w modalu** (`components/ui/RangeSlider.tsx` — jeden generyczny suwak,
etykieta wartości nad nim, opisy skrajów pod spodem; reużywany też w trybie gier na
`/mapa`). Skrajna prawa pozycja = brak ograniczenia:

| Suwak | Zakres | Prawy skraj |
|---|---|---|
| Kiedy | Dzisiaj / Jutro / Ten tydzień / Ten miesiąc / Wszystko (5 pozycji) | Wszystko |
| Odległość | 1–20 km, krok 1 | Bez limitu |
| Cena | 0–100 zł, krok 5 | Bez limitu (0 zł = Za darmo) |
| Wolne miejsca | 0–14, krok 1 | 0 = dowolna liczba (nie ogranicza) |

Suwak „Wolne miejsca" w modalu to **próg minimum** (`freeSpots(e) >= N`,
`filterByMinFreeSpots()`), świadomie osobny od toggle'a „Wolne miejsca" w pasku (który
tylko odsiewa komplety) — oba filtry łączą się przez AND, gdy oba aktywne. „Kiedy" nie
ma już opcji „Weekend" (zastąpiona „Ten miesiąc" — `matchesDateFilter` case `'miesiac'`,
`isSameMonth()` z `date-fns`).

**Modal filtrów działa na szkicu, nie na żywym stanie** (styl Booking: wybierz kilka
rzeczy, potem zatwierdź). Otwarcie kopiuje bieżące `dateFilter`/`radiusKm`/
`maxPriceGrosze`/`minFreeSpots` do stanu szkicu; dotykanie suwaków zmienia wyłącznie
szkic. Przycisk zatwierdzenia pokazuje na żywo `Pokaż N meczów` i dopiero jego kliknięcie
commituje szkic do prawdziwego stanu — jeśli suwak Odległości jest ustawiony i pozycja
użytkownika jeszcze nie jest znana, pyta wtedy raz o zgodę na lokalizację (przy odmowie
promień wraca do wyłączonego). „Sortuj" ma **własny**, niezależny geo-trigger (patrz
tabela wyżej) — nie czeka na zatwierdzenie modala. „Wyczyść" resetuje szkic bez
zamykania modala (i przy okazji resetuje `sortBy` do „Najbliższy termin" — wcześniej
zostawał); zamknięcie przez tło/X/Escape odrzuca szkic bez dotykania prawdziwych filtrów.

**Licznik wyników nad listą usunięty** — zostaje tylko link „Wyczyść filtry", widoczny
wyłącznie gdy jest co czyścić.

| Element | Zachowanie |
|---|---|
| Szukanie | po tytule, sporcie, boisku i **dzielnicy**, przez `foldText` — „pilka" znajduje „piłka" |
| Sekcje dzienne | Dzisiaj / Jutro / W tym tygodniu / Później — **tylko** przy sortowaniu po terminie |
| Stronicowanie | 20 pozycji + „Pokaż więcej"; licznik resetuje się przy zmianie filtrów |

Sekcje dzienne wyłączają się przy sortowaniu po odległości i po liczbie miejsc: dwa
porządki naraz („po czasie" w nagłówkach, „po dystansie" w treści) wprowadzałyby w błąd.

Logika filtrowania, grupowania, sortowania, promienia, ceny i minimalnych wolnych miejsc
(`filterByRadius`, `filterByMaxPrice`, `filterByMinFreeSpots`) żyje w
`lib/eventFilters.ts` — w komponencie nie dałoby się jej przetestować. Ten sam plik
eksportuje `multiLabel`/`toggleInArray` (etykieta dropdownu multi-select, przełącznik
wartości w tablicy) — reużywane przez sportowy dropdown na `/wydarzenia` **i** na
`/mapa` w trybie gier.

**Modal filtrów** (`components/ui/FilterSheet.tsx`) jest wspólny z mapą boisk
(`VenueExplorer.tsx`) — jedna powłoka (portal do `<body>`, bottom sheet na mobile,
wyśrodkowana karta od `md:`), różna wyłącznie treść sekcji. **Pigułki filtrów**
(`components/ui/FilterPill.tsx`: `PillDropdown`, `TogglePill`) też są wspólne z mapą.

### Widok mapy w `/wydarzenia` (mobile-only)

Przycisk obok dzwonka powiadomień (mobile, zalogowany) przełącza treść strony między
listą a mapą — **to nie jest nawigacja na `/mapa`**, tylko stan komponentu
(`viewMode: 'lista' | 'mapa'`) w tym samym `EventsListView`. Desktop zawsze pokazuje
listę (ma już osobny link „Mapa boisk" w nawigacji) — przełącznik jest `md:hidden`.

Pigułka „Sortuj" **nie pokazuje się** w tym widoku — na mapie nie ma listy do
sortowania, chowa się razem z przełączeniem na `viewMode === 'mapa'` (`sortBy` samo
w sobie zostaje bez zmian, po prostu nie jest tu eksponowane w UI).

Mapa (`components/map/GamesMapCanvas.tsx`, ładowany przez `next/dynamic({ ssr: false })`)
renderuje pinezki dla **całego już przefiltrowanego zbioru** (`sorted` z pipeline'u
strony) — bez własnego zapytania ograniczonego do widocznego kadru: zbiór publicznych
wydarzeń jest już w całości w pamięci (`getPublicEvents()`, bez limitu). Klastrowanie
przez `L.markerClusterGroup` (`leaflet.markercluster`) w nowym, współdzielonym
`components/map/GamesMarkersLayer.tsx` — ten sam komponent montowany też wewnątrz
`VenueExplorer.tsx` w trybie „Gry", patrz „Układ `/mapa`" niżej. Mapa robi
`fitBounds` na cały zbiór przy każdej zmianie filtrów.

**Pinezka pojedynczego meczu** to kółko w kolorze sportu (`sportColor()`) z emoji
sportu w środku — odpowiada wprost na „jaki sport", bez potrzeby legendy — i etykietą
„kiedy + godzina" pod spodem (`matchWhenLabel(date, time)`: dziś · 18:00 / jutro · 18:00
/ w piątek · 20:30 / 12 wrz · 18:00, ten sam format co gdzie indziej w apce, np.
`NextMatchCard`). Cena i reszta szczegółów zostają
w panelu po dotknięciu — na samej pinezce więcej tekstu byłoby nieczytelne. Klaster
(kilka meczów blisko siebie) pokazuje kolorowe kółko z liczbą, tym samym
`clusterDivIcon()` co klastry boisk na `/mapa`.

Dotknięcie pinezki otwiera dolną kartę `EventBrowseCard` (ten sam komponent co lista),
bez natywnych popupów Leaflet:
- **Swipe w lewo/prawo** na karcie przełącza na kolejny/poprzedni mecz w tej samej
  kolejności co pinezki (`swipeEventId()` w `lib/eventFilters.ts` — indeks w `rows`,
  zawija się na końcach listy). Wykrywanie gestu: `lib/useSwipe.ts` (próg 50px, wymaga
  wyraźnej przewagi ruchu poziomego nad pionowym, żeby nie kolidować ze scrollem).
- **Dotknięcie mapy poza pinezką zamyka kartę** — `GamesMarkersLayer` nasłuchuje
  `map.on('click', …)` i czyści zaznaczenie; kliknięcie samej pinezki nie dociera do
  tego listenera, bo Leaflet nie propaguje kliknięcia markera do mapy.
- **Przycisk „Zlokalizuj mnie"** (prawy dolny róg) — `components/map/LocateMeButton.tsx`,
  wspólny z `/mapa` (patrz niżej), ikona `LocateFixed` (celownik), nie pinezka.

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

### Gdzie ląduje zalogowany

Domyślny cel po zalogowaniu to **`/wydarzenia`** — lista meczów, czyli to, po co
użytkownik przyszedł. `?next=` (brama kreatora, strona boiska, grupa) ma pierwszeństwo.
`AuthForm.tsx` deklarował ten cel od dawna, ale logowanie Google idzie przez
`app/auth/callback/page.tsx`, który jako jedyny domyślał `/` — stąd rozjazd.

Konsekwencja: baner „Gracze zobaczą Cię jako…" (`UzupelnijProfilBanner`) renderuje się
**także na `/wydarzenia`**, nie tylko na pulpicie. Bez tego konto bez imienia — typowo
Google bez `full_name` — nie zobaczyłoby go nigdy. Powiadomienie z migracji `070` tej
luki nie zamyka: wyzwalacz jest `AFTER INSERT ON auth.users`, więc dotyczy wyłącznie
nowych kont, a migracja świadomie nie uzupełnia wstecz.

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

**Filtry — przycisk „Filtry" + modal, jak na `/wydarzenia`.** Sport i przełącznik
„Gry dziś" zostają zawsze widoczne; Typ obiektu i Nawierzchnia przenoszą się do
`FilterSheet` (ten sam współdzielony komponent, patrz „Układ `/wydarzenia`"), bo są
drugorzędne i rzadziej dotykane:

| Filtr | Gdzie | Uwaga |
|---|---|---|
| Sport | inline, dropdown | źródło `MAP_FILTER_SPORTS` (`lib/sports.ts`) — **6** opcji, nie 4: dołożone `wielofunkcyjne` (4118 obiektów) i `piłka ręczna` (806), które miały już kolorową pinezkę na mapie, ale nie dało się ich wybrać w filtrze |
| „Gry dziś" | inline, przełącznik | bez zmian |
| Typ obiektu | w modalu | lista bez zmian, tylko przeniesiona z zawsze-widocznego dropdownu |
| Nawierzchnia *(nowość)* | w modalu | checklist: Trawa naturalna / Sztuczna trawa / Nawierzchnia twarda / Piasek / Beton / Mączka ceglana; etykiety przez `surfaceLabel()` z `lib/labels.ts` |

„Otwarte gry" (obiekt ma co najmniej jeden mecz, na który da się jeszcze dołączyć) było
tu przez chwilę jako osobny przełącznik — usunięte jako zbędne obok „Gry dziś" i trybu
„Gry | Obiekty" (patrz niżej), którego tryb „Gry" pokazuje realnie otwarte mecze wprost jako pinezki.

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

**Licznik „Pokaż N obiektów" w trybie skupisk** (domyślny widok całej Polski, mapa
oddalona) liczy się z `wKadrze` (suma z kółek skupisk, uwzględnia już filtr sportu),
nie z `allFields` — w tym trybie `allFields` jest zawsze pustą tablicą (obiekty
pobiera się dopiero po przybliżeniu, patrz niżej), więc liczenie z niej dawało zawsze
„Pokaż 0 obiektów" niezależnie od tego, ile realnie było w kadrze. Typ obiektu
i Nawierzchnia i tak nie mają w tym trybie efektu (brak per-obiektowego rozbicia
w danych ze skupisk), więc podgląd pokazuje to, co faktycznie widać na mapie.

Filtr nawierzchni działa **tylko w trybie pojedynczych obiektów** (przybliżenie ≥ próg
skupisk) — w trybie skupisk (oddalona mapa) nie jest przekazywany do
`getExplorerClusters()`, dokładnie tak jak już wcześniej działało „Gry dziś". Sport
i Typ obiektu działają w obu trybach — RPC `mapa_skupiska` przyjmuje
generyczne tablice `p_sporty`/`p_typy`, więc nowe wartości sportu przechodzą bez żadnej
zmiany funkcji.

**Zalogowany na mobile** dostaje w tym samym pływającym wierszu co pole szukania również
`MobileIdentityRow` (dzwonek + awatar) — Header na tej trasie chowa swój pasek, patrz
„Górny pasek nawigacji" wyżej.

**Przycisk „Zlokalizuj mnie"** (prawy dolny róg) ma ikonę `LocateFixed` (celownik) —
wcześniej był tu `MapPin` (pinezka), myląca ikona dla akcji „pokaż moją okolicę".
Wspólny komponent `components/map/LocateMeButton.tsx`, patrz niżej.

### Tryb gier — przełącznik „Gry | Obiekty"

Segmentowany przełącznik (`components/ui/SegmentedToggle.tsx`) na początku paska
przełącza **cały** pasek i **cały** `<MapContainer>` między dwoma trybami, bez
remontowania mapy (zoom/pan usera zostaje, tylko podmieniają się warstwy pinezek).

Wcześniej był to `TogglePill` „Pokaż gry" — wyłączony pill nie mówił, w jakim trybie
mapa jest teraz, tylko czego brakuje. Oba tryby są równorzędne, więc widać oba naraz;
semantyka i URL bez zmian („Gry" = dotychczasowe `?gry=1`).

`SegmentedToggle` jest generyczny (dwie opcje `{ value, label }`, `role="radiogroup"`),
z kontenerem `grid grid-cols-2` — wskaźnik ma stałą szerokość połowy kontenera, więc
przy `flex` szerszy tekst przesunąłby podświetlenie obok przycisku, który podświetla.

| | „Obiekty" (domyślnie) | „Gry" |
|---|---|---|
| Pasek | Sport(6, `MAP_FILTER_SPORTS`) / Filtry (Typ+Nawierzchnia) / Gry dziś | Filtry (suwaki) / Sport(4, `FOCUS_SPORTS`) / Wolne miejsca / Za darmo |
| Pinezki | boiska, `MapLayer`/`WarstwaSkupisk` (bez zmian) | mecze, `GamesMarkersLayer` (współdzielony z widokiem mapy w `/wydarzenia`, patrz wyżej — emoji sportu + etykieta „kiedy", swipe w panelu, zamykanie kliknięciem w puste miejsce mapy) |
| Źródło danych | `getExplorerFields`/`getExplorerClusters` (viewport-scoped) | `events` — **to samo**, co już pobierane wyżej dla `fieldStats`; zero nowego zapytania |
| Karta wyniku (mobile/sidebar) | `VenueCard` | `EventBrowseCard` |
| Modal „Filtry" | Typ obiektu + Nawierzchnia (bez zmian) | Kiedy / Odległość / Cena / Wolne miejsca (te same suwaki co `/wydarzenia`) |

**Sortuj nie pojawia się w tym trybie** — `/mapa` jest zawsze widokiem mapy (w
odróżnieniu od `/wydarzenia`, gdzie ta sama pigułka ma sens na liście), więc kolejność
pinezek/karty sidebara zostaje na stałe chronologiczna (`gamesSort` to dziś stała
`'termin'`, bez UI do zmiany) — nie warto było duplikować UI, którego i tak nie ma gdzie
sensownie użyć na mapie.

Stan trybu gier (`gamesSort`, `gamesDate`, `gamesRadius`, `gamesMaxPriceGrosze`,
`gamesMinFreeSpots`, `gamesOnlyFreeSpots`, `gamesOnlyNoCost`) jest **lokalny**, nie w URL
— spójnie z tym, że `/wydarzenia` też nie trzyma swoich filtrów w adresie. Jedyny stan
trybu w URL to sam przełącznik: `?gry=1`, ten sam wzorzec co `today`/`open`.

Filtr `sports` jest **współdzielony** między oboma trybami (ten sam parametr URL
`?sport=`). Przełączenie na „Gry" ma guard: jeśli w `sports` jest wartość spoza
`FOCUS_SPORTS` (np. `wielofunkcyjne` — sensowna tylko jako opis obiektu, żaden mecz nigdy
nie ma takiego sportu), filtr się czyści zamiast po cichu zerować wyniki.

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

Wpisy do `notifications` powstają wyłącznie z wyzwalaczy w bazie — tabela ma polityki
SELECT i UPDATE dla własnych wierszy i **żadnej polityki INSERT**, więc przeglądarka nie
może wpisać powiadomienia nawet sobie. Dziś jest ich pięć: oferta zwolnionego miejsca
(`062`), akceptacja zapisu i zmiana terminu (`065`), imienne zaproszenie (`067`) oraz
**odwołanie meczu i konto bez nazwy** (`070`).

`NotificationBell` linkuje powiadomienie do meczu przez `event_id`, a te bez `event_id` —
przez mapę `TYP_NA_TRASE` (dziś: `uzupelnij_profil` → `/profil`). Bez niej renderowały się
jako martwy, nieklikalny wiersz.

Czego brakuje: **wyzwalacza przy utworzeniu gry w grupie**. Jedyna ścieżka powiadomienia
o nowej grze to `game_alerts` (promień + sport), a ta jest ukryta flagą
`SHOW_GAME_ALERTS`. To [luka 2 wobec wizji](./wizja.md#3-luki).

---

## Plakietka „Wczesny etap" na landingu

Pozycje w `components/home/landing/content.ts` mogą mieć opcjonalne pole
`wczesnyEtap: true`. Karta renderuje się wtedy wyciszona (`opacity-80`, ikona
`bg-slate-100 text-slate-400`) i dostaje plakietkę `WczesnyEtapBadge` pod tytułem.
To **nie jest** `disabled` ani wyszarzenie do nieczytelności — funkcja działa, tylko nie
w pełnej skali, a karta ma dalej sprzedawać.

Dziś oznaczone są dwie:

| Pozycja | Dlaczego |
|---|---|
| `LANDING_STEPS[2]` „Brakuje ludzi? Otwórz mecz" | otwartych gier bywa mało — obietnica „społeczność dobierze skład" nie ma jeszcze pokrycia |
| `LANDING_VALUES[4]` „Boiska w jednym miejscu" | lokalizacje są kompletne, ale nawierzchnia i typ obiektu wypełnione w mniejszości wierszy |

`LANDING_STEPS` renderuje się w **dwóch** miejscach: `LandingHowItWorks.tsx` (landing)
i `OnboardingSection` w `DashboardSections.tsx` (pulpit przy zerowej aktywności). Dane są
wspólne, markup nie — plakietkę trzeba postawić w obu, dlatego jest osobnym komponentem.

Pusty stan `NextMatchCard` uprzedza tym samym tonem, że otwartych gier bywa mało
i szybszą drogą jest własny mecz plus link do ekipy.

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
- **Pełna integracja cyklicznych wydarzeń z kreatorem jednorazowych meczów.** Kafelek
  „Wydarzenie cykliczne" na kroku 2 tworzy niezależny szablon w `recurring_events` —
  bez trwałego linku do konkretnego jednorazowego meczu (`events.recurring_event_id`
  nie istnieje w schemacie) i bez realnego ekranu edycji szablonu (`/cykliczne/[id]/edytuj`
  to zaślepka „w przygotowaniu"). Zadanie w [BACKLOG.md](../BACKLOG.md).

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
