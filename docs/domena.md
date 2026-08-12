# Modele domenowe i granice architektury

Rzeczy, które trzeba wiedzieć **przed** zmianą kodu — bo są nieoczywiste i już raz kogoś
ugryzły. Stan funkcji i flagi → [funkcje.md](./funkcje.md). Schemat bazy →
[baza-danych.md](./baza-danych.md).

---

## Granice architektury

Uzasadnienia, których grep nie pokaże. Stack i diagram są w [README.md](../README.md).

**Nie ma własnego backendu.** Frontend rozmawia z Supabase bezpośrednio, autoryzacja
jest w całości w Row Level Security. Konsekwencja: nie da się „dodać endpointu" — nowa
operacja na danych to funkcja w `frontend/src/lib/` plus polityka RLS w migracji. Jeśli
operacja wymaga uprawnień, których użytkownik nie ma, właściwe narzędzie to funkcja
`SECURITY DEFINER` w bazie (RPC), nigdy obejście po stronie klienta.

**Komponenty nie omijają `lib/`.** Zapytanie do Supabase w komponencie to błąd — reguły
domenowe (np. liczenie pojemności meczu) mają istnieć w jednej kopii i być testowalne.

**Jedyny wyjątek: `app/api/geocode/`** — serwerowy proxy do Nominatim, bo przeglądarka
nie może ustawić nagłówka `User-Agent`, a Nominatim go wymaga. To nie jest zalążek
backendu; nie dokładać tam tras.

**Mappery `toEvent` / `toField` to granica typów** (`lib/events.ts`, `lib/api.ts`):
jedyne miejsce, gdzie `snake_case` bazy spotyka `camelCase` aplikacji. Dziś rzutowanie
bez walidacji runtime — Zod jest na liście długu ([strategia.md §5](./strategia.md#5-dług-techniczny)).

**Jedno środowisko (prod).** Każdy merge do master idzie na żywo. Domena kanoniczna:
`bojo.pl` (fallback w `layout.tsx`, `robots.ts`, `sitemap.ts` — nowe miejsca używają tej
samej wartości). Migracje uruchamia się ręcznie → [baza-danych.md](./baza-danych.md).

**Pierwsze zadanie cykliczne w repo: `pg_cron`, migracja `073`.** Do tej pory wszystko
działo się z klienta albo z wyzwalacza SQL — nic nie odpalało się samo, bez niczyjej
wizyty. Auto-tworzenie terminów serii (patrz „Serie wydarzeń cyklicznych" niżej) wymaga
działania bez organizatora w pobliżu, bo RLS na `events` przepuszcza INSERT tylko jako
`auth.uid() = organizer_id`. `pg_cron` bywa niewłączony na danym projekcie Supabase —
migracja to sprawdza i pomija harmonogram zamiast się wywrócić, więc funkcja degraduje
się do ręcznego wywołania, nie przestaje istnieć.

**Drobne moduły `lib/` bez własnej sekcji tutaj** — po co służą: `lib/legal.ts` (dane
usługodawcy dla `/prywatnosc` i `/regulamin`, jedno miejsce do uzupełnienia);
`lib/eventWizard.ts` (walidacja kroków kreatora meczu, w tym `validatePayments` —
numer BLIK i zniżka karty sportowej — wydzielona z `app/wydarzenia/nowe/page.tsx`
pod testy); `lib/eventDraft.ts` (szkic kreatora w `localStorage`, TTL 12 h — patrz
[funkcje.md](./funkcje.md#szkic-kreatora-meczu));
`lib/profileName.ts` (nazwa, pod którą użytkownik pokazuje się innym: `displayName`,
`firstName`, `avatarUrl`, `nazwaZEmaila`, `brakNazwy`, `isPelneImie` — mieszkają tu, a nie
w `auth.tsx`, bo Vitest nie transformuje `.tsx` przy `jsx: preserve`, a to właśnie te
funkcje decydują, co zobaczy obcy człowiek na stronie meczu; `auth.tsx` je re-eksportuje,
więc importy `from '@/lib/auth'` działają bez zmian);
`lib/eventShare.ts` (`eventUrl` + `eventShareText` + `shareEvent` — jeden adres i jeden
tekst udostępnienia dla całej aplikacji, patrz
[funkcje.md](./funkcje.md#po-publikacji-mecz-gotowy--wyślij-link));
`lib/eventSummary.ts` (`zbudujPodsumowanie` — wiersze karty „Tak zobaczą to gracze"
na ostatnim kroku kreatora, patrz
[funkcje.md](./funkcje.md#podsumowanie-przed-publikacją));
`lib/inviteStatus.ts` (`inviteStatus`/`compareByInviteStatus` — status imiennego
zaproszenia na mecz: uczestnictwo bije wcześniejszą odmowę, czyli `dismissed_at`
sprawdza się dopiero, gdy zaproszonego nie ma w `event_participants`; wydzielone
z komponentu po tym, jak przegląd kodu złapał tu odwróconą kolejność, patrz
[funkcje.md](./funkcje.md#zaproszenia-na-mecz)); `lib/eventTitle.ts` (jedyne miejsce,
które liczy domyślną nazwę meczu, gdy tytuł jest pusty — `defaultEventTitle` /
`eventDisplayTitle`, zastąpiło pięć niezależnych kopii tej samej logiki);
`lib/adminLinks.ts` (lista tras panelu admina, współdzielona przez `AdminMenu`
w `Header.tsx` i sekcję „Panel administratora” na `/profil`); `lib/api.ts#hasManagedVenue`
(czy użytkownik zarządza obiektem — steruje „Moje obiekty” w headerze i na `/profil`);
`lib/eventFilters.ts` (filtrowanie, grupowanie i sortowanie listy `/wydarzenia` —
zakres dat, sekcje dzienne, kolejność po realnym starcie meczu; wydzielone z komponentu
pod testy, tak jak `eventWizard.ts`); `lib/plural.ts` (polska odmiana przez liczbę —
zastąpiła regułę `n < 5`, która myliła się na 12–14); `lib/searchText.ts` (`foldText`
składa polskie znaki, żeby „pilka" znajdowało „piłka"); `lib/geo.ts#distanceKm`
(odległość haversine, wspólna dla sortowania „najbliżej mnie" i wykrywania duplikatów
w panelu admina); `lib/groups.ts#setGroupCover` (zapis okładki grupy — jedyna mutacja
grupy, która wcześniej szła inline w JSX);
`lib/bottomNavVisibility.tsx` (kontekst chowający dolny panel nawigacji — patrz
[funkcje.md](./funkcje.md#dolny-panel-nawigacji-mobile)); `lib/useMyInvites.ts`
(zaproszenia na mecz, patrz [funkcje.md](./funkcje.md#zaproszenia-na-mecz));
`lib/eventFilters.ts#filterByRadius` (filtr promienia na `/wydarzenia` — wiersz bez
policzonej odległości wypada, bo promień bez tego nic by nie znaczył);
`lib/eventFilters.ts#filterByMaxPrice`/`#filterByMinFreeSpots` (suwaki Cena/Wolne miejsca
w modalu filtrów, `/wydarzenia` i tryb gier na `/mapa` — patrz
[funkcje.md](./funkcje.md#układ-wydarzenia--filtry-sortowanie-sekcje-dzienne));
`lib/eventFilters.ts#multiLabel`/`#toggleInArray` (etykieta dropdownu multi-select i
przełącznik wartości w tablicy — współdzielone przez sportowy dropdown na `/wydarzenia`
i `/mapa`); `DateFilter` w tym samym pliku ma dziś `'miesiac'` zamiast `'weekend'`
(`matchesDateFilter` liczy `isSameMonth()` z `date-fns`) — zestaw pozycji suwaka „Kiedy";
`components/ui/RangeSlider.tsx` (jeden generyczny suwak — etykieta wartości nad nim,
opisy skrajów pod spodem — reużywany w czterech filtrach na `/wydarzenia` i w trybie gier
na `/mapa`, wzorowany na suwaku promienia w `AlertSetupDialog`);
`components/map/GamesMarkersLayer.tsx` (klastrowana warstwa pinezek meczów,
`L.markerClusterGroup`, dane wchodzą jako prop — bez własnego fetcha viewport-scoped,
bo zbiór publicznych wydarzeń jest już cały w pamięci; pinezka pojedynczego meczu ma
emoji sportu (`sportEmoji()`) i etykietę „kiedy" (`matchWhenLabel()` z `lib/eventDates.ts`,
bez godziny); ikona klastra reużywa `clusterDivIcon()` z `mapIcons.ts` — ten sam wygląd
co klastry boisk, zamiast domyślnej, nieostylowanej ikony Leafleta; kliknięcie mapy poza
pinezką (`map.on('click', …)`, marker nie propaguje własnego kliknięcia do mapy) zamyka
zaznaczenie — `onSelect` przyjmuje `null`; współdzielona przez widok mapy
w `/wydarzenia` (`components/map/GamesMapCanvas.tsx`, własny `<MapContainer>`) i tryb
„Pokaż gry" w `VenueExplorer.tsx` (ten sam `<MapContainer>` co boiska));
`lib/eventFilters.ts#swipeEventId` (który mecz pokazać po swipe w panelu — ta sama
kolejność co pinezki, zawija się na końcach) razem z `lib/useSwipe.ts` (wykrywanie
poziomego gestu touchstart→touchend, próg 50px, ignoruje ruch bardziej pionowy niż
poziomy, żeby nie kolidować ze scrollem); `components/map/LocateMeButton.tsx` (przycisk
„pokaż moją okolicę", ikona `LocateFixed` — wcześniej `MapPin`, mylące dla tej akcji —
wspólny dla `/mapa` i widoku mapy w `/wydarzenia`, pozycja sterowana propem `className`,
bo kontekst pełnoekranowej mapy i mapy osadzonej w karcie mają różne bezpieczne
odstępy); `lib/sports.ts
#MAP_FILTER_SPORTS` (sporty jako filtr facylitów na mapie, szerszy niż `FOCUS_SPORTS` —
dokłada `wielofunkcyjne`/`piłka ręczna`, które mają pinezki na `/mapa`, ale nie były
wcześniej filtrowalne); `lib/api.ts#EXPLORER_COLS` (okrojone kolumny pobierane dla
pinezek `/mapa` — dołączono `surface`, żeby dało się po niej filtrować, patrz
[funkcje.md](./funkcje.md#układ-mapa--szukanie-filtry-powrót-z-boiska));
`components/ui/FilterSheet.tsx` (modal filtrów w stylu Booking, wspólny dla
`/wydarzenia` i `/mapa` — portal do `<body>`, bottom sheet na mobile);
`components/ui/FilterPill.tsx#PillDropdown` (rozwijana pigułka — Sortuj, Sport na obu
stronach) ma stałą szerokość panelu (`PANEL_WIDTH = 240`), żeby dało się policzyć
bezpieczną pozycję **przed** wyrenderowaniem: przycisk blisko prawej krawędzi ekranu
wcześniej wyrównywał panel do swojej lewej krawędzi, co wypychało kolumnę z ptaszkami
wyboru poza widoczny obszar — teraz panel dosuwa się do prawej krawędzi ekranu
z marginesem zamiast do lewej krawędzi przycisku;
`components/layout/MobileIdentityRow.tsx` (dzwonek + awatar w jednym wierszu, zastępuje
pasek `Header` tam, gdzie strona sama go chowa na mobile dla zalogowanych — patrz
[funkcje.md](./funkcje.md#górny-pasek-nawigacji--inny-dla-zalogowanych-na-mobile)).

---

## Wydarzenie ↔ użytkownik: dwie niezależne osie

Relacja użytkownika do meczu to **dwie osie, nie jedna etykieta** (`lib/events.ts:701`):

```ts
interface MyEventRelation {
  isOrganizer: boolean;   // czyj to mecz — trwała cecha
  status: MyEventStatus;  // jaki mam udział — zmienny
}
```

```ts
type MyEventStatus =
  | 'none'       // brak relacji — domyślne „Dołącz"
  | 'invited'    // ktoś mnie zaprosił imiennie, czeka na odpowiedź
  | 'pending'    // poprosiłem o dołączenie, organizator jeszcze nie zaakceptował
  | 'observing'  // RSVP „maybe" — obserwuję, nie zajmuję miejsca, nie liczę się do statystyk
  | 'reserve'    // zapisany, czekam na zwolnienie miejsca
  | 'playing';   // zapisany i trzymam miejsce
```

**Nie zwijać tego do jednej etykiety.** Można organizować mecz i w nim grać, albo
organizować bez grania — to dwa różne przypadki i UI musi je rozróżniać.

`'invited'` pochodzi z tabeli `event_player_invites` (migracja `060`, `lib/playerInvites.ts`)
— `getMyParticipationMap()` (`lib/events.ts:936-945`) dopisuje ten status, gdy istnieje
nieodrzucone zaproszenie, a użytkownik nie ma jeszcze żadnego wiersza w
`event_participants` dla tego meczu. Odpowiedź na zaproszenie to zwykłe dołączenie /
obserwowanie na stronie meczu — nie ma osobnego „accept" w bazie. Gdzie to widać w UI →
[funkcje.md § Zaproszenia na mecz](./funkcje.md#zaproszenia-na-mecz).
Nie mylić z `event_invites` (migracja `036`, `lib/invites.ts`) — zaproszenia po e-mailu
z tokenem, martwy kod, nic go nie importuje.

### Skąd bierze się status

Prywatna `statusFromRow()` (`lib/events.ts:707`). Kolejność sprawdzeń ma znaczenie:

```ts
if (row.pending_approval) return 'pending';
if (row.rsvp === 'maybe')  return 'observing';
return row.is_reserve ? 'reserve' : 'playing';
```

Czyli: oczekujący na akceptację jest `pending`, **nawet jeśli** ma `rsvp = 'maybe'`.

---

## Reguły pojemności

Do limitu miejsc liczą się **wyłącznie** wiersze `event_participants` spełniające:

```
is_reserve = false AND pending_approval = false
```

Reguła jest **celowo zdublowana** w trzech funkcjach: `joinEvent`, `addGuest`,
`confirmFromMaybe`. Zmieniając jedną, sprawdź pozostałe — rozjazd między nimi oznacza,
że mecz przepełni się jedną ścieżką, a drugą nie.

Konsekwencje:
- Przy `require_approval = true` dołączenie **nie zajmuje miejsca** do czasu akceptacji.
- „Obserwuję" (`rsvp = 'maybe'`) nie zajmuje miejsca.
- Limit bramkarzy (`max_goalkeepers`, domyślnie 2, tylko gdy `goalkeepers_enabled`)
  spycha nadmiarowych na rezerwę.

### Zwolnione miejsce: oferta, nie auto-awans

Gdy ktoś się wypisze, rezerwowy **nie wskakuje automatycznie**. Miejsce zostaje
**zaproponowane** pierwszej osobie z rezerwy, która musi sama kliknąć **„Wchodzę"**
albo **„Odpuszczam"**.

**Nikt nigdy nie trafia do składu po cichu** — to świadoma decyzja produktowa.
Nie zamieniać tego na automatyczny awans.

Mechanika (migracja `058`):

| Element | Gdzie |
|---|---|
| Okno na decyzję | `events.reserve_claim_hours` (1–72 h, domyślnie 3) |
| Aktywna oferta | `event_participants.claim_offered_at` |
| Przepuścił (odrzucił lub nie zdążył) | `event_participants.claim_passed` |
| Utrzymanie kolejki | funkcja `sync_reserve_claim(event_id)`, `SECURITY DEFINER` |

Kolejka rusza się przy **wejściu na stronę meczu** — nie ma backendu ani crona, więc
`sync_reserve_claim` jest wołane z klienta (`syncReserveClaim` w `lib/events.ts`) i musi
być idempotentne. Funkcja wygasza przeterminowaną ofertę i przekazuje miejsce dalej.

Od migracji `062` funkcja dopisuje też wpis do `notifications` w momencie ustawienia
oferty — bez tego rezerwowy dowiadywał się o zwolnionym miejscu wyłącznie wtedy, gdy
sam odświeżył stronę meczu, co w praktyce marnowało jego okno na decyzję. To wciąż
tylko powiadomienie w skrzynce w appce (`NotificationBell`), nie push/SMS/e-mail.

Miejsce pod aktywną ofertą **liczy się jako zajęte** — ktoś z zewnątrz nie podbierze go
rezerwowemu w trakcie jego okna (`joinEvent` dolicza oferty do zajętości).

Osoba, która przepuściła, **zostaje na liście** (organizator wciąż może ją awansować
ręcznie), ale nie blokuje kolejki. Goście bez konta są pomijani — nie mają jak kliknąć.

---

## Self-service zapis gościa bez konta

Niezalogowany gracz może zapisać się na mecz bez zakładania konta, podając imię i e-mail.
Tworzy to wpis gościa (`is_guest = true`, `user_id = NULL`, `guest_email = ...`) z losowym
`claim_token` wygenerowanym triggerem `nadaj_token_gosciowi()` (migracja `066`).

**Reguły pojemności** — gość liczy się normalnie do limitu miejsc (`is_reserve = false AND pending_approval = false`),
wyląduje na rezerwie jeśli mecz pełny, identycznie jak zalogowany gracz.

**Przejęcie wpisu** — zaraz po zapisie ekran zachęty (`EventDetailClient.tsx`) oferuje
dwie ścieżki, obie bez ponownego wpisywania imienia/maila i bez dodatkowego kliku
potwierdzenia:
- **Hasło** — `handleCreateAccountFromGuest()` woła `signUpWithEmail()` (imię i e-mail
  z formularza zapisu), a gdy sesja jest od razu aktywna (bez wymogu potwierdzenia
  e-maila), od razu też `przejmij_wpis_goscia()` — user ląduje wprost na stronie meczu.
- **Google** — `signInWithGoogle()` z `next=/gracz/przejmij/[token]?auto=1`.

Parametr `?auto=1` na `/gracz/przejmij/[token]` (`PrzejmijClient.tsx`) każe stronie
przejąć wpis automatycznie, gdy user jest już zalogowany — zamiast czekać na klik
„To ja — potwierdzam". Bez `?auto=1` (np. link wysłany SMS-em przez organizatora)
strona zachowuje się jak dotąd — wymaga świadomego potwierdzenia tożsamości.

Gdy Supabase wymaga potwierdzenia e-maila (`needsConfirmation = true`), przejęcie nie
może nastąpić od razu — `auth.uid()` jeszcze nie istnieje. User zostaje na stronie
meczu (wpis gościa już tam jest, widoczny bez konta), a link w mailu potwierdzającym
(niesie ten sam `?auto=1`) dokańcza przejęcie po kliknięciu.

**Gdy podany e-mail ma już konto** — `signUpWithEmail()` rzuca błąd „już istnieje"
(`mapAuthError()` w `lib/auth.tsx`). Rzuca go w dwóch przypadkach: klasyczny błąd
Supabase „already registered", oraz — gdy w projekcie włączona jest ochrona przed
enumeracją e-maili (ustawienie w Dashboardzie, `signUp()` wtedy nie rzuca błędu, tylko
zwraca fałszywy sukces z pustą tablicą `identities`) — wykryte po `data.user.identities
.length === 0` (migracja `085`, ta sama zmiana naprawia to samo w zwykłej rejestracji
przez `/logowanie`). Ekran zachęty przełącza wtedy to samo pole hasła z rejestracji na
logowanie (`handleSignInFromGuest()`): po udanym `signInWithEmail()` przejęcie następuje
od razu, tak samo jak przy rejestracji.

**Ten sam e-mail nie może zapisać się dwa razy na ten sam mecz** — `dolacz_do_meczu_
jako_goscie()` (migracja `085`) sprawdza to na starcie, przed liczeniem pojemności:
nieprzejęty wpis z tym e-mailem w tym meczu → zwraca jego istniejący `claim_token`
zamiast tworzyć duplikat (idempotentnie, pokrywa też podwójny klik przy słabym
połączeniu); już przejęty wpis, albo konto z tym e-mailem dołączone normalnie
(zalogowane) → `RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.'`.

Frontend rozróżnia te dwie ścieżki. Migracja `086` dodała do zwracanego wiersza kolumnę
`already_joined` (true przy idempotentnym zwrocie tokenu) — gdy `handleJoinAsGuest()`
w `EventDetailClient.tsx` dostanie `alreadyJoined: true`, ekran zachęty pokazuje nagłówek
„Wcześniej dołączyłeś do tej gry." zamiast „Zapisano!"/„Świetnie! Jesteś w składzie.",
reszta (trzy wartości, Google, hasło) bez zmian — to wciąż e-mail bez konta. Gdy zamiast
tego przyjdzie wyjątek `'Jesteś już zapisany na ten mecz.'` (co zawsze oznacza istniejące
konto — obie gałęzie SQL, które go rzucają, wymagają wcześniejszego `auth.uid()`), pokazuje
się inny, uproszczony ekran: bez listy korzyści i formularza zakładania konta, tylko
przycisk „Zaloguj się" (`/logowanie?next=<ścieżka meczu>`) i link „Pomiń, zobacz skład".

**Gdy gość zamknie ekran bez logowania (albo w ogóle nie doszedł do tego kroku)** —
wpis zostaje jako gość, ale migracja `084` po cichu kojarzy go z kontem po e-mailu
i wysyła powiadomienie (typ `niepotwierdzony_wpis_goscia`, dzwonek w `Header`) z
gotowym linkiem `/gracz/przejmij/[token]`. Dwa wyzwalacze pokrywają obie kolejności:
- `event_participants` → `auth.users`: nowy wpis gościa, e-mail pasuje do JUŻ
  istniejącego konta — powiadomienie trafia od razu.
- `auth.users` → `event_participants`: nowe konto, e-mail pasuje do wcześniej
  zapisanych nieprzejętych wpisów gościa — powiadomienie(a) trafiają po rejestracji.

Świadomie **bez automatycznego przejęcia** — sam SQL nigdy nie ustawia `user_id` bez
`auth.uid()`. Inaczej ktokolwiek wpisujący cudzy e-mail w formularzu gościa mógłby
podpiąć dowolny mecz pod nieswoje konto bez zgody jego właściciela. Powiadomienie
tylko *proponuje* — klik w link i świadome potwierdzenie na `/gracz/przejmij/[token]`
(albo `?auto=1`, patrz wyżej) nadal robią całą pracę.

**Rate limiting** — brak je na MVP. Jeśli spam, dodać captchę (reCAPTCHA v3) do formularza,
albo edge function do pilnowania po e-mailu (wymaga dostępu do IP).

Migracje: `082_guest_self_signup.sql`, `083_fix_guest_signup_claim_token.sql` (naprawia
„ambiguous column reference" w `RETURNING`), `084_powiadomienie_o_koncie_z_wpisem_goscia.sql`,
`085_zapobiegaj_duplikatom_wpisu_goscia.sql`, `086_juz_dolaczony_flaga.sql` (kolumna
`already_joined` w wyniku RPC).

---

## Propozycje składów

Uczestnik może zaproponować podział na drużyny, reszta go popiera (👍), a organizator
przenosi wybraną propozycję na realne składy (migracja `059`).

**Propozycja niczego nie zmienia w składzie.** Dopóki organizator jej nie zatwierdzi,
`event_participants.team` pozostaje nietknięte — propozycja żyje w osobnych tabelach
(`team_proposals`, `team_proposal_picks`, `team_proposal_votes`).

Podział ról:

| | Organizator | Uczestnik |
|---|---|---|
| Panel realnych składów (`TeamsPanel`) | ✅ ustawia wprost | ❌ |
| „Zaproponuj składy" | ❌ — nie musi, ustawia sam | ✅ dopóki składy nieopublikowane |
| Poparcie propozycji (👍) | ✅ | ✅ |
| „Zatwierdź" | ✅ wyłącznie on | ❌ |
| Usunięcie propozycji | ✅ każdą (moderacja) | ✅ tylko własną |

Zatwierdzenie idzie przez `accept_team_proposal(proposal_id)` (`SECURITY DEFINER`,
sprawdza organizatora w środku): czyści poprzedni podział i wpisuje przypisania
z propozycji, żeby zatwierdzony układ był pełnym obrazem, a nie nakładką.

Jedna aktywna propozycja na osobę i mecz — kolejna zastępuje poprzednią, żeby lista
nie zapełniła się wariantami tego samego autora.

---

## RSVP „Obserwuję"

W bazie to `rsvp = 'maybe'` (`049_participant_rsvp.sql`). Znaczenie:

- nie zajmuje miejsca w składzie,
- nie liczy się do statystyk gracza (`055_stats_exclude_observing.sql`),
- nie trafia do historii meczów.

Przejście z obserwowania w granie: `confirmFromMaybe()` — i dopiero ono sprawdza
pojemność. Funkcja przyjmuje te same decyzje co zwykłe dołączanie: rolę
(`asGoalkeeper`, z osobnym limitem bramkarzy) i sposób płatności (`payment_method`,
`has_sports_card`, `sports_card_provider`). Bez tego obserwujący, który klikał
„Dołącz", trafiał do składu jako gracz w polu i bez deklaracji płatności —
z pominięciem pytań, które dostaje każdy inny uczestnik.

### Kolumny skasowane migracją `064` — nie wstawiaj ich z powrotem

`064_usun_statusy_uczestnika.sql` usunęła z `event_participants` kolumny `status`
i `confirmed_at`. Kod jeszcze przez chwilę je wstawiał, przez co PostgREST odrzucał
**każdy** insert (`PGRST204`): organizator nie trafiał do własnego składu, „Dołącz"
i „Dopisz osobę bez konta" nie działały. Awaria była cicha, bo insert organizatora
w `createEvent` ignorował `error`.

Strażnikiem jest `__tests__/eventsSchema.test.ts` — czyta źródło `lib/events.ts`
i przewraca się, gdy któryś insert do `event_participants` znów ustawi skasowaną
kolumnę. TypeScript tego nie złapie: obiekt insertu nie jest typowany schematem bazy.

---

## Płatności

`lib/payments.ts`. Organizator wybiera akceptowane metody (`blik`, `gotowka`, `inne`)
i akceptowane karty sportowe (`multisport`, `fitprofit`, `medicover`, `inne`).

**Kwota zniżki jest opcjonalna i to jest istotne semantycznie:**

| `sports_card_discount_grosz` | Znaczenie |
|---|---|
| liczba | Zniżka o tę kwotę |
| `null` | „Zniżka jest, ale zapytaj organizatora" — **nie** „brak zniżki" |

Powód: zniżki z kart w realnym świecie są zbyt różne (procent, dzienne limity, zależność
od obiektu), żeby wymuszać jedną liczbę.

Przy pierwszym wpisaniu kosztu większego od zera kreator zaznacza **Gotówkę**, jeśli żadna
metoda nie jest jeszcze wybrana (jednorazowo — świadome odznaczenie wszystkiego zostaje).
Powód: `validatePayments()` nie wymaga ani jednej metody, więc dało się opublikować mecz
z ceną i bez informacji, jak ją uregulować. Pusty zestaw daje ostrzeżenie, nie blokadę —
płatność można ustalić poza aplikacją.

**Zawsze licz cenę przez `priceForParticipant()`** — nigdy nie odejmuj ręcznie. Funkcja
zwraca trzy pola i wszystkie trzy trzeba obsłużyć w UI:

```ts
{
  priceGrosze: number,           // ile zapłacić
  discountApplied: boolean,      // zniżka policzona
  discountUnspecified: boolean,  // ma kartę, ale kwota nieznana → pokaż „zapytaj organizatora"
}
```

`sportsCardLabel()` podstawia własną nazwę karty organizatora zamiast generycznego
„Inna karta”.

⚠️ **Pułapka nazw:** kolumny to `cost_grosz` i `sports_card_discount_grosz` (bez „e"),
pola TS to `costGrosze` i `sportsCardDiscountGrosze`.

**Numer do BLIKA — kto go widzi.** `canSeeBlikPhone()` (`lib/payments.ts`): organizator
widzi go zawsze, uczestnik ze składu dopiero `BLIK_PHONE_REVEAL_MINUTES` (60) przed
startem meczu — nagłówek strony meczu jest publiczny i indeksowalny, więc numer
prywatnego telefonu nie wystawia się komukolwiek od razu. **Jeden świadomy wyjątek:**
okno „Dołączam” z wyborem metody BLIK pokazuje numer natychmiast, niezależnie od czasu
do meczu — bez niego nie da się zapłacić przy zapisie. `minutesUntilStart()`
(`lib/eventDates.ts`) liczy dystans czasowy; ujemna wartość (mecz już trwa) też
odsłania numer.

⚠️ **To bramka wyłącznie w interfejsie.** Kolumna `events.blik_phone` przyjeżdża
w całym wierszu `events` (RLS jest wierszowe, `toEvent` robi `select('*')`), więc numer
da się odczytać z ruchu sieciowego, mimo że UI go nie renderuje. Twarde odcięcie
wymaga widoku albo uprawnień kolumnowych — zadanie w [BACKLOG.md](../BACKLOG.md).

Format wpisywania: `formatBlikPhone()` przycina do 9 cyfr polskiego numeru i grupuje
je 3-3-3 w trakcie pisania (obcina też prefiks `+48`/`48`, gdy zostaje sensowna
długość). `validatePayments()` (`lib/eventWizard.ts`) blokuje publikację/zapis meczu,
gdy: wybrano BLIK, a numer ma inną liczbę cyfr niż 9, albo zniżka karty jest wyższa
niż koszt od osoby. Reguły działają tylko dla płatnego meczu (`costPln > 0`) — darmowy
mecz nie ma żadnych ograniczeń płatności do sprawdzenia.

**Agregaty do badge'a rozliczenia na liście i w nagłówku meczu.**
`EventItem.unpaidCount` (liczone w `toEvent()` z już pobranego, zagnieżdżonego
`event_participants(..., has_paid)` — zero nowego zapytania) i
`MyEventRelation.hasPaid` (własny wiersz uczestnictwa w `getMyParticipatedEvents()`)
zasilają badge „Rozliczono"/„X nie zapłaciło" (organizator) i „Zapłacono"/„Zapłać"
(gracz) na `EventBrowseCard` i w nagłówku `EventDetailClient.tsx` — widoczne tylko
dla wydarzeń, które już się rozpoczęły (`eventStarted`); wcześniej w tym samym miejscu
jest cena.

---

## Grupy

`lib/groups.ts`. Stała ekipa: sport, miasto, okładka, członkowie, mecze grupy.
Dołączanie przez link zaproszenia `/g/[code]`.

**`events.group_id` steruje listowaniem, nie dostępem.** Przypisanie meczu do grupy
sprawia, że pojawia się on na liście meczów grupy — ale widoczność meczu nadal wynika
wyłącznie z `events.visibility` (`private` / `public`). Trzeciego poziomu widoczności
nie ma — to [luka wobec wizji](./wizja.md#3-luki).

---

## Serie wydarzeń cyklicznych

`lib/recurring.ts`, `lib/series.ts`. Od migracji `073` (`events.recurring_event_id →
recurring_events.id`) termin cykliczny jest prawdziwą serią, nie niezależną kopią.

**Podział ról — dlaczego dwie tabele, nie jedna z flagą.** Duplikowanie całego schematu
`events` w `recurring_events` byłoby jednym źródłem prawdy o dwie kolumny za dużo:

- **szablon** (`recurring_events`) jest właścicielem WYŁĄCZNIE reguły powtarzania: dzień
  tygodnia, godzina, miejsce, limit miejsc, widoczność, wyprzedzenie
  (`notify_days_before`). Edycja szablonu (`/cykliczne/[id]/edytuj`) zmienia tylko te pola.
- **ostatni termin serii** (`events` z najpóźniejszym `event_date` przy danym
  `recurring_event_id`) jest żywym wzorcem WSZYSTKIEGO INNEGO: ceny, metod płatności,
  bramkarzy, akceptacji zapisów, grupy. Nowy termin — ręczny czy automatyczny — dziedziczy
  stamtąd, nie z szablonu.

Konsekwencja, którą łatwo przeoczyć: **szablon sam w sobie nigdy nie mówi, ile kosztuje
gierka.** Pierwszy termin serii (bez poprzednika) startuje z domyślnych `createEvent()` —
darmowy, bez metod płatności. Cena wchodzi do serii dopiero, gdy ktoś ją ustawi NA
TERMINIE i wybierze zakres „to i przyszłe"/„cała seria" (patrz niżej) — to wtedy trafia
też do organizatora patrzącego tylko na `/cykliczne/[id]`, który sam z siebie ceny nie
pokazuje (bo jej nie ma — to własność terminu, nie szablonu).

**Auto-tworzenie.** Funkcja SQL `utworz_nalezne_terminy_serii()` (migracja `073`,
`SECURITY DEFINER`) sprawdza co godzinę (`pg_cron`, jeśli włączony w Supabase) każdy
aktywny szablon: liczy najbliższe wystąpienie `day_of_week`, i jeśli mieści się
w `notify_days_before` i jeszcze nie istnieje — tworzy je przez `utworz_termin_serii()`.
To samo RPC woła `spawnEventInstance()` z przeglądarki (przycisk „Utwórz termin" na
`/cykliczne/[id]`) — ręczne i automatyczne tworzenie idą jedną ścieżką, więc nie mogą się
rozjechać. Bez `pg_cron` seria żyje wyłącznie z ręcznych kliknięć — degradacja,
nie awaria.

**`event_date` nigdy nie jest własnością serii.** Nawet przy zbiorczej edycji (zakres „to
i przyszłe" / „cała seria" — `components/events/ZakresEdycjiSerii.tsx`,
`lib/series.ts#terminyWZakresie`) data zmienia się wyłącznie na edytowanym terminie.
Wspólna data absolutna dla wielu terminów jest sprzeczna sama w sobie; przesunięcie całej
gierki na inny dzień tygodnia to zmiana REGUŁY (szablon), nie zbiorcza zmiana dat.

**„Przyszłe" liczy się po dacie terminu, nie po kolejności wstawiania** — terminy można
dopisać ręcznie poza kolejnością (dowolna data na `/cykliczne/[id]`), więc pozycja w tabeli
nic nie mówi o tym, czy mecz jeszcze się nie odbył.

---

## Wyniki i statystyki

`match_results` + `player_goals` (gole i asysty per gracz) + RPC `get_player_stats`.
`MatchResultData` obsługuje trzy kształty wyniku: bramki, sety siatkarskie, statystyki
koszykarskie.

⚠️ **`player_goals` jest martwym duplikatem** — `EventDetailClient.tsx` z niej czyta
(fallback `initialGoals` dla `MatchResultForm`), ale nic dziś do niej nie zapisuje.
Jedyne aktywnie zapisywane źródło goli/asyst jest `match_results.result_data.scorers`
(`type: 'goals'`) — stamtąd liczy się też gol przy nazwisku w składzie (`golyMap`
w `EventDetailClient.tsx`).

**Suma goli/asyst u strzelców nie może przekroczyć wyniku końcowego.**
`MatchResultForm` (`family === 'goals'`) blokuje zapis, gdy `Σ scorers.goals >
scoreA + scoreB` albo `Σ scorers.assists > scoreA + scoreB` — górna granica asyst to
łączna liczba goli w meczu, bo strzelcy nie mają przypisania do drużyny (walidacja
per-drużyna nie jest możliwa przy obecnym modelu danych).

**Nazwy drużyn: A/B w bazie, „Niebiescy"/„Czerwoni" + N/C w UI** — `lib/teamLabels.ts`
jest jedynym źródłem etykiet, używanym identycznie w składzie (`TeamsPanel`,
`PublishedTeamsCard`) i w wyniku (`MatchResultForm`). Dane w `event_participants.team`
i `match_results.score_a/score_b` zostają literami.

Reputacja: `reliabilityPct()` (`lib/eventFeatures.ts`) liczy frekwencję. Znaczek
„rzetelny gracz" wymaga ≥5 rozegranych gier i 0 nieobecności (`app/gracz/[id]/page.tsx`).

Statystyki **pomijają** uczestników ze statusem `observing`.
