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

**Drobne moduły `lib/` bez własnej sekcji tutaj** — po co służą: `lib/legal.ts` (dane
usługodawcy dla `/prywatnosc` i `/regulamin`, jedno miejsce do uzupełnienia);
`lib/eventWizard.ts` (walidacja kroków kreatora meczu, w tym `validatePayments` —
numer BLIK i zniżka karty sportowej — wydzielona z `app/wydarzenia/nowe/page.tsx`
pod testy); `lib/eventDraft.ts` (szkic kreatora w `localStorage`, TTL 12 h — patrz
[funkcje.md](./funkcje.md#szkic-kreatora-meczu)); `lib/eventTitle.ts` (jedyne miejsce,
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
bo zbiór publicznych wydarzeń jest już cały w pamięci; ikona klastra reużywa
`clusterDivIcon()` z `mapIcons.ts` — ten sam wygląd co klastry boisk, zamiast domyślnej,
nieostylowanej ikony Leafleta; współdzielona przez widok mapy
w `/wydarzenia` (`components/map/GamesMapCanvas.tsx`, własny `<MapContainer>`) i tryb
„Pokaż gry" w `VenueExplorer.tsx` (ten sam `<MapContainer>` co boiska)); `lib/sports.ts
#MAP_FILTER_SPORTS` (sporty jako filtr facylitów na mapie, szerszy niż `FOCUS_SPORTS` —
dokłada `wielofunkcyjne`/`piłka ręczna`, które mają pinezki na `/mapa`, ale nie były
wcześniej filtrowalne); `lib/api.ts#EXPLORER_COLS` (okrojone kolumny pobierane dla
pinezek `/mapa` — dołączono `surface`, żeby dało się po niej filtrować, patrz
[funkcje.md](./funkcje.md#układ-mapa--szukanie-filtry-powrót-z-boiska));
`components/ui/FilterSheet.tsx` (modal filtrów w stylu Booking, wspólny dla
`/wydarzenia` i `/mapa` — portal do `<body>`, bottom sheet na mobile);
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
pojemność.

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

---

## Grupy

`lib/groups.ts`. Stała ekipa: sport, miasto, okładka, członkowie, mecze grupy.
Dołączanie przez link zaproszenia `/g/[code]`.

**`events.group_id` steruje listowaniem, nie dostępem.** Przypisanie meczu do grupy
sprawia, że pojawia się on na liście meczów grupy — ale widoczność meczu nadal wynika
wyłącznie z `events.visibility` (`private` / `public`). Trzeciego poziomu widoczności
nie ma — to [luka wobec wizji](./wizja.md#3-luki).

---

## Wyniki i statystyki

`match_results` + `player_goals` (gole i asysty per gracz) + RPC `get_player_stats`.
`MatchResultData` obsługuje trzy kształty wyniku: bramki, sety siatkarskie, statystyki
koszykarskie.

Reputacja: `reliabilityPct()` (`lib/eventFeatures.ts`) liczy frekwencję. Znaczek
„rzetelny gracz" wymaga ≥5 rozegranych gier i 0 nieobecności (`app/gracz/[id]/page.tsx`).

Statystyki **pomijają** uczestników ze statusem `observing`.
