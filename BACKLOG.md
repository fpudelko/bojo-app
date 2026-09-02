# BOJO — backlog

Co jest **zbudowane, ale schowane**, gdzie **kod nie nadążył za wizją** oraz pomysły
jeszcze niezrobione.

- Kierunek produktu: [docs/wizja.md](./docs/wizja.md) — **dokument nadrzędny**
- Stan implementacji: [docs/funkcje.md](./docs/funkcje.md)
- Roadmapa fazowa: [docs/strategia.md](./docs/strategia.md#6-roadmapa-fazowa)
- Audyt ścieżki organizatora: [docs/przeplyw-organizatora.md](./docs/przeplyw-organizatora.md)

_Ostatnia aktualizacja: 2026-08-22_

---

## PRZESŁANKA STRATEGICZNA (2026-08-15) — czytaj przed planowaniem

**Mięsem na start są ekipy grające regularnie. Otwarte gry to „później".**
Decyzja właściciela, świadomie inna niż założenie
[rewizji 2026-08](./docs/rewizja-2026-08.md), która traktowała stałe ekipy jako segment
„Marcina", czyli takiego, co nie przyjdzie. Rewizja zostaje jako zapis analizy z tamtą
przesłanką — ale tam, gdzie obie się rozjeżdżają, **obowiązuje ta sekcja**.

Co z tego wynika, wprost:

| Pozycja | Rewizja mówiła | Teraz |
|---|---|---|
| Gry cykliczne (`SHOW_RECURRING`) | do skasowania | **zostają** — flaga włączona od migracji `073`, kod już poszedł w tę stronę |
| „Półka, która nie umie być pusta" + `SHOW_GAME_ALERTS` | jedna z pięciu rzeczy do zbudowania | **schodzi na później** — to agenda otwartych gier |
| Przejęcie profilu gościa (claim) | pierwsze | **nadal kluczowe** — w stałej ekipie ci sami goście wracają co tydzień, więc ta sama strata powtarza się 50× w roku, nie raz |
| Web-push (PWA) | do skasowania („kanał powrotu dla użytkowników, których nie ma") | **wraca jako priorytet** — stała ekipa to dokładnie kohorta, którą jest po co przypominać: te same 10 osób, ten sam czwartek, jedno pytanie „grasz?". Plan: [§8 „PWA + web-push"](#pwa--web-push--plan-priorytet-od-2026-08-15) |

Otwarte gry sprawdzamy tanio i ręcznie: właściciel wynajmuje orlik albo boisko do siatki
i organizuje kilka gier sam. To lepszy test popytu niż liczenie postów w grupach na
Facebooku — sprawdzany realnym meczem, nie szacunkiem.

---

## 0. Przepływ organizatora — co zostało po audycie 2026-08-08

Pełny audyt (26 ustaleń `O-1`…`O-26`, wraz z rozdziałem „co zostaje bez zmian i dlaczego")
→ [docs/przeplyw-organizatora.md](./docs/przeplyw-organizatora.md). Tutaj wyłącznie to,
czego jeszcze nie zrobiono — bez kopiowania treści, żeby obie listy się nie rozjechały.

`O-20`, `O-23`, `O-24`, `O-25` zrobione w drugiej rundzie (duplikat „Zaproś z ekipy"
usunięty, karta „Twoja płatność" dla uczestnika, sekcja „Brakuje graczy" na `/moje-gry`,
karta „Zaproszeni" ze statusem odpowiedzi). `O-26` zrobione trzecią rundą (2026-08-10):
usunięto nieosiągalny modal „Zgłoś uczestnika" (`submitReport`/`getEventReports`,
typy `ReportType`/`PlayerReport`), martwe `handleSendSms`/`smsBusy` w
`EventDetailClient.tsx` i cały plik `lib/invites.ts` (zero importów). Ta sama runda
naprawiła też goły link w zaproszeniu do przejęcia wpisu gościa — `kopiujLinkPrzejecia`
kopiował sam URL bez argumentu, ten sam błąd co `O-18`, tu nienaprawiony do teraz —
i dodała sygnał „N gości bez konta" nad składem oraz przycisk „Zaproś do Bojo" w
widoku po starcie meczu (`ParticipantsList`), gdzie wcześniej znikał całkowicie.
`O-28`…`O-31` zrobione czwartą rundą (2026-08-12): wyzwalacz powiadamiający organizatora
o zmianie stanu kompletu składu (migracja `079`), przycisk „Wyślij rozliczenie ekipie"
w panelu kosztów, powrót z logowania na stronę meczu otwiera od razu okno zapisu
(`?dolacz=1`), a zaproszenie do przejęcia wpisu gościa może wysłać też ten, kto
konkretnego gościa dopisał, nie tylko organizator. Zostaje:

| # | Co zostało | Gdzie |
|---|---|---|
| **O-10** | Krok 2 kreatora nadal niesie do 15 kontrolek przy 2 na kroku 1. „Więcej opcji" zdjęło jedną decyzję; osobnej przebudowy świadomie nie zakładamy — do rewizji, gdy będzie feedback od realnych organizatorów | `app/wydarzenia/nowe/page.tsx` |

Świadomie poza zakresem audytu i tej rundy: trzeci poziom widoczności (§1.1),
odmrażanie flag (§2), doręczanie powiadomień poza aplikacją (e-mail/push — wymaga
weryfikacji domeny `bojo.pl` w Resend, poza repo), cron dla wygasania oferty
zwolnionego miejsca (nie da się z repo sprawdzić, czy `pg_cron` jest włączony na
produkcji), domknięcie RLS na `events` (patrz §5 niżej).

---

## 1. Luki wobec wizji

Pozycje, w których dokument strategiczny obiecuje coś, czego kod nie robi. **Dokument
jest nadrzędny** — to są zadania, nie błędy w dokumencie.

### 1.1 Trzeci poziom widoczności meczu — ZDECYDOWANE bez zmiany schematu

Wizja wymienia trzy poziomy: prywatny / widoczny dla grupy / publiczny.
Kod ma dwa: `events.visibility` to CHECK `('private','public')` (`002_events_and_auth.sql`).

Decyzja z rundy „Grupy jako magnes na organizatora" (2026-08-14): **nie dokładamy**
trzeciej wartości do CHECK-a ani osobnej polityki RLS na `events` dla tego przypadku.
Zamiast tego nazwaliśmy i utrwaliliśmy dokumentacyjnie zachowanie, które już istniało:
`getMyGroupEvents()` (`lib/events.ts`) celowo pokazuje członkom grupy prywatne mecze
tej grupy na ich dashboardzie, a `getEventsByGroup()` listuje wszystkie mecze grupy
niezależnie od widoczności — czyli **prywatny mecz przypięty do grupy jest zawsze
widoczny dla jej członków**. Kreator meczu, edycja i strona meczu mówią to teraz wprost
pod kartą widoczności (`opisWidocznosciWGrupie()`, `lib/eventFeatures.ts`) — wcześniej
aplikacja tego nie mówiła, `llms.txt` twierdziło wprost „trzeciego poziomu widoczności
nie ma", a organizator musiał się domyślać. Pełny opis → [docs/domena.md §
Grupy](./docs/domena.md#grupy).

**Wciąż otwarte, świadomie poza tym zakresem:** ogólna polityka `Events readable by
all` na `events` ma nadal warunek `USING (true)` — każdy, także niezalogowany, może
odczytać wszystkie mecze, w tym prywatne. `getMyGroupEvents()` działa dziś **wyłącznie
dzięki tej luźnej polityce**. Domknięcie RLS na `events` bez jednoczesnej przebudowy tej
funkcji po cichu urwałoby mecze grupowe z list, bez błędu — patrz §5 niżej. To osobne
zadanie z osobnym ryzykiem, nie robimy go przy okazji.

### 1.2 Powiadomienie dla członków grupy o utworzeniu gry — ZROBIONE
Wizja stawia to jako część propozycji „Grupy — zastąpienie facebook/whatsapp". Bez
powiadomienia grupa nie zastępuje czatu, bo nikt nie wie, że gra powstała.

~~Kanał powiadomień istnieje — brakuje wyzwalacza przy `createEvent` z `group_id`~~
— migracja `072` (2026-08-09) dodała trigger `powiadom_o_nowym_meczu_w_grupie`:
każdy `INSERT` do `events` z ustawionym `group_id` wstawia powiadomienie
wszystkim członkom grupy poza organizatorem. Ten sam mechanizm (`SECURITY
DEFINER`, patrz `065`/`070`) powiadamia też organizatora o nowej prośbie o
dołączenie. Zostaje jako otwarte tylko to, co dokument opisywał osobno:
`game_alerts` (promień + sport, oparte o lokalizację, nie o członkostwo) wciąż
za flagą `SHOW_GAME_ALERTS` — to inna funkcja, nie ta sama luka.

### 1.3 Gry cykliczne ukryte flagą
Wizja wymienia je w pierwszej propozycji wartości, na równi z grami pojedynczymi.
`SHOW_RECURRING = false` nadal ukrywa wejścia w `Header.tsx`, `app/page.tsx`,
`app/moje-gry` — decyzja do podjęcia: odmrozić czy zapisać uzasadnienie ukrycia.

Kod **nie jest już kompletny w takim stopniu, jak wcześniej zapisano tutaj**: kreator
jednorazowego meczu (`app/wydarzenia/nowe/page.tsx`, krok 2) ma dziś kafelek „Wydarzenie
cykliczne" (`components/events/RecurringSettingsDialog.tsx`), który tworzy szablon
w `recurring_events` niezależnie od jednorazowego meczu — celowo minimalny zakres, patrz
[docs/funkcje.md#czego-nie-ma](./docs/funkcje.md#czego-nie-ma). Brakuje:

- kolumny `events.recurring_event_id` i realnego linkowania „następnego wydarzenia"
  (`lib/recurring.ts#getNextEventsForRecurring` dziś cicho zwraca puste — kolumna,
  której szuka to zapytanie, nigdy nie powstała w żadnej migracji),
- realnego ekranu `/cykliczne/[id]/edytuj` — dziś zaślepka „Ta funkcja jest jeszcze
  w przygotowaniu".

Zakres pełnej integracji: migracja dodająca `events.recurring_event_id`, naprawa
`spawnEventInstance()` żeby faktycznie linkowała, realny formularz edycji szablonu
(mógłby ponownie użyć komponentów pól z `components/events/`, tak jak dziś robią to
kreator i edycja jednorazowego meczu).

### 1.4 Rozliczenie po meczu — ZROBIONE
Propozycja brzmi „Rozliczysz ekipę w minutę". Wpis opisywał dwa problemy, oba naprawione:

- ~~po zakończeniu meczu panel „Podział kosztów" znikał~~ — warunek `!eventStarted`
  został zdjęty; panel renderuje się dziś przy `costGrosze > 0 && isOwner`
  (`EventDetailClient.tsx`).
- ~~uczestnik nie widział, ile ma zapłacić~~ — nowa karta „Twoja płatność" (kwota po
  uwzględnieniu zniżki kartowej przez `priceForParticipant()`, sposób płatności, status
  opłacone/nieopłacone), gated przez `event.showPaymentStatus` — pierwsze miejsce, które tę
  flagę odczytuje. To było ustalenie `O-23` z [audytu ścieżki organizatora](./docs/przeplyw-organizatora.md).

---

## 2. Ukryte za flagami

Jedno miejsce, jeden przełącznik. Pełna tabela z miejscami użycia →
[docs/funkcje.md](./docs/funkcje.md#flagi-funkcji).

| Flaga | Co chowa | Dlaczego schowane |
|---|---|---|
| `SHOW_CUP` | Turniej BOJO Cup — pasek ogłoszeń, TrustBar, link w nagłówku | Brak gotowego turnieju; nie obiecywać na zapas |
| `SHOW_GAME_ALERTS` | „Ustaw alert" o pasującej grze w okolicy | Historycznie: brak kanału dostarczania. **Powód nieaktualny** — kanał istnieje (§3), do ponownej decyzji |
| `SHOW_SMS_FEATURES` | Potwierdzenie SMS + przypomnienia | Brak podpiętej bramki SMS |
| `SHOW_RECURRING` | Gry cykliczne | Skupienie na meczach jednorazowych — patrz §1.3 |
| `FEATURE_RESERVATIONS` | Rezerwacje obiektów, panel menedżera | Brak partnerstw z obiektami. Można włączyć per obiekt przez `fields.booking_enabled` |

---

## 3. Kanał powiadomień — jest zbudowany

Wcześniejsze wersje tego pliku i `PRZEWODNIK.md` twierdziły, że powiadomień nie ma.
**To była nieprawda.** Istnieje:

| Element | Gdzie |
|---|---|
| Tabela `notifications` | migracja `025` |
| Logika | `lib/notifications.ts` |
| UI (dzwonek) | `components/layout/NotificationBell.tsx`, renderowany w `Header.tsx` |
| E-mail | Edge function `notify-game-alert` → Resend |
| SMS | Edge function `send-event-sms` → SMSAPI + Twilio |
| Zaproszenia cykliczne | Edge function `send-invites` |
| Web-push | Migracja `102` — tabela `push_subscriptions`, trigger na `notifications` → edge function `send-push` |

Web-push wysyłki są zbudowane (migracja `102`) — status wdrożenia na produkcji poza
zakresem tego wpisu.

---

## 4. Zbudowane, nieużywane, martwy kod

- **`components/home/NearbyGames.tsx`** — kompletny komponent „gry w pobliżu + alert",
  nigdzie nie renderowany. Do decyzji: wpiąć (po włączeniu alertów) albo usunąć.
- **`components/map/{MapView,LeafletMapImpl,EventsMapView,EventsMapImpl}.tsx`** — nic
  ich nie importuje. Aktywna mapa to `VenueExplorer.tsx`.
- **Tabela `games`** (`001`) — zastąpiona przez `events` (`002`), żaden kod jej nie używa.
- **`/gracze`** — trasa istnieje, ale to `redirect('/wydarzenia')`. Albo zbudować listę
  graczy, albo usunąć trasę.
- **`RemindersSection` / `AlertSetupDialog`** — renderowane tylko za flagami z §2.

---

## 5. Zadania techniczne

### 5.0 Katalog boisk — ~~naprawa danych, potem cała Polska~~ ZROBIONE (2026-08-06/07)

**Import całej Polski wszedł PR-em #109** (`scraper/import_osm_pbf.py` + workflow
`import-osm-polska.yml`, województwo po województwie). Przyczyny problemów 1–3 i 6
z audytu poniżej są usunięte **u źródła**, a nie łatane po fakcie:

- **ZERO AI** — sport i nawierzchnia wyłącznie z tagów OSM. Punkt 1 („sport skażony
  sąsiedztwem") brał się z `analyze_venues.py`, który doklejał sporty rozpoznane
  przez model z kafelka o boku ~150 m. Tego mechanizmu w nowym imporcie nie ma.
- **Nazwa ze złączenia przestrzennego** — „SP nr 12 — boisko piłkarskie, Świdnik"
  zamiast „Boisko sportowe" (punkt 6).
- **Miejscowość w adresie** — „ul. Poznańska" przestaje wyglądać na duplikat 12×
  (punkt 6, druga połowa).
- **Wymiary z geometrii poligonu**, mierzone zamiast zgadywanych ze zdjęcia.

Audyt niżej zostaje jako **zapis historyczny** — opisuje stan sprzed importu i tłumaczy,
dlaczego importer wygląda tak, jak wygląda. Nie jest listą zadań.

**Czego NIE da się sprawdzić z repo:** czy stare wiersze z `scraper.py` i analizy
satelitarnej nadal leżą obok tych z OSM. Właściciel potwierdził (2026-08-15), że stary
Poznań został ukryty.

<details><summary>Audyt 2026-08-03 — stan sprzed importu (zapis historyczny)</summary>

**Stan bazy (audyt 2026-08-03, 1484 obiekty: 723 publiczne, 702 organizer_only,
59 ukrytych).** Skrypty diagnostyczne i naprawcze: `supabase/audyt/`.

Znalezione, w kolejności ważności:

1. **`sport` skażony sąsiedztwem.** `analyze_venues.py` robi
   `update["sport"] = merged` — dokleja sporty wykryte przez AI do sportów z OSM.
   Model dostaje kafelek Mapbox zoom 18 (~150 m boku), czyli cały kompleks, i opisuje
   wszystko, co widzi. Kort obok boiska do koszykówki wpada do sportów tego boiska.
   Skutek: filtr „koszykówka" zwraca korty tenisowe. Odwracalne — `name` pochodzi
   z oryginalnego tagu OSM i nie było nadpisywane (`audyt/11-naprawa-sportow.sql`).
2. **Kontakty rozdane sąsiadom.** 56 maili na 1484 obiekty, część fałszywa:
   `osrodekrataje@posir.poznan.pl` siedzi m.in. na boisku w Dopiewie. enrich z web
   search szukał kontaktu dla obiektu bez nazwy własnej (`audyt/12-naprawa-kontaktow.sql`).
   Do tego artefakty modelu w bazie: `<cite index=…>`, `[email protected]`, markdown w URL.
3. **Adresy:** `park owa` (rozbite „Parkowa"), `ul. 187` / `ul. 32` (numery dróg
   wojewódzkich), samo `Poznań` przy obiekcie pod Środą Wlkp. (`audyt/13-naprawa-adresow.sql`).
4. **~13% obiektów to nie boiska** — model napisał to w `ai_notes`, ale
   `_ai_visibility()` chowa tylko przy jawnym `is_verified_venue = false`
   (`supabase/sprzatanie-boisk.sql`).
5. **Bramka publikacji za hojna** — `public` wymaga dziś „AI coś napisało", nie
   „wiemy coś pewnego". Do przepisania po naprawach 1–4.
6. **Nazwy generyczne** — ~35 z 60 obiektów w próbce to „Boisko sportowe" /
   „Boisko — piłka nożna". Duplikaty nazwa+adres (12× „ul. Poznańska") to NIE są
   duplikaty: to różne boiska w różnych gminach. Po współrzędnych klastrów jest tylko 8.

**Cel: cała Polska najniższym kosztem.** Analiza satelitarna AI na ~50 tys. obiektów
to $150–200 za przebieg i tak czy siak zgadywanka — **nie tędy droga na tym etapie**.

Tańsza ścieżka, do rozpisania:
- import z **Geofabrik `poland-latest.osm.pbf`** + `pyosmium` zamiast Overpass
  (Overpass na całą Polskę = timeout albo ban). Koszt: zero, tylko CPU
- PBF ma **geometrię**, nie sam punkt → wymiary i powierzchnia liczone z poligonu,
  a nie zgadywane ze zdjęcia; pin w centroidzie boiska
- nazwa własna, sport, nawierzchnia, oświetlenie, operator — z tagów OSM, za darmo
- AI **tylko** do jednego pytania („czy to w ogóle boisko"), na nowych obiektach,
  Haiku, i **bez prawa zapisu** do `sport` / `surface` / `map_visibility`
- zdjęcia: **Mapillary** (darmowe API, CC-BY-SA) zamiast Google Places Photos

Cron analizy satelitarnej zdjęty 2026-08-03 (chodził ~20×/mies. przez OR
w harmonogramie GitHuba). `fix-coords.yml` do usunięcia — forward-geocoding adresu
przesunął 59 pinezek nawet o 3 km (`supabase/przywroc-wspolrzedne.sql` cofa).

</details>

**Copy landingu i dashboardu (2026-08-04) już mówi o „całej Polsce", z wyprzedzeniem
względem tego zadania.** Świadoma decyzja: tworzenie meczu z pinezką gdziekolwiek na
mapie działa już dziś, więc obietnica ma pokrycie — tylko katalog boisk jeszcze nie.
Jedyne miejsce, które nazywa Poznań wprost, to FAQ (`components/home/landing/content.ts`,
pytanie „Gdzie działa Bojo?") — do zaktualizowania (albo pozostawienia bez zmian, jeśli
gęstość poza Poznaniem wciąż będzie odstawać), gdy ten import się domknie.

- [ ] **Zweryfikować stan migracji na produkcji.** W repo jest 60 migracji; stanu bazy
      nie da się odczytać z repo. Patrz [docs/baza-danych.md](./docs/baza-danych.md).
- [ ] **Adresy kontaktowe wciąż na `bojo.app`** — `kontakt@bojo.app` w `/regulamin`,
      `/prywatnosc`, `/turniej` oraz nadawca `noreply@bojo.app` w edge functions, przy
      domenie kanonicznej `bojo.pl`. Wymaga potwierdzenia, że skrzynki na `bojo.pl`
      istnieją, oraz weryfikacji domeny w Resend (SPF + DKIM).
- [ ] **Czyszczenie bazy boisk** — odsianie siłowni, kortów tylko-tenisowych, kartingów.
      Dziś filtr `RELEVANT_SPORTS` jest **po stronie klienta** (`VenueExplorer`).
      Docelowo: `map_visibility = 'hidden'` w bazie + panel admina do przeglądu.
- [ ] **Zod — walidacja danych z bazy** (mappery `toEvent`, `toField`).
- [ ] **Domknąć reguły dostępu w RLS na `events`** — część sprawdzana dziś po stronie
      przeglądarki. **Kolejność ma znaczenie:** naprawić `getMyGroupEvents()` PRZED
      dociągnięciem polityki na `events` (patrz ustalenie z 2026-08-04 niżej) —
      funkcja dziś zależy wyłącznie od luźnego warunku `true`, więc domknięcie RLS bez
      jednoczesnej przebudowy tej funkcji po cichu urwie mecze grupowe z list, bez błędu.
      **Nadal otwarte** po rundzie „Grupy jako magnes na organizatora" (2026-08-14) —
      świadomie poza jej zakresem, patrz §1.1 wyżej.
- [x] **`group_members` przyjmowało INSERT od każdego, kto znał UUID grupy —
      naprawione.** (2026-08-14) Polityka `"Users join groups"` z migracji `044`
      sprawdzała wyłącznie `auth.uid() = user_id`; `join_code` filtrował dopiero
      interfejs (`GroupsClient.handleJoin`), a same grupy są publicznie czytelne —
      każdy zapisany UUID wystarczał, żeby dołączyć bez znajomości kodu. Migracja `094`
      zdejmuje tę politykę: jedyne drogi wejścia to `dolacz_do_grupy_kodem()` (trzeba
      znać kod) i `dodaj_czlonka_do_grupy()` (trzeba mieć `can_manage_members`).
- [ ] **Numer do BLIKA nadal przyjeżdża w całym wierszu `events`.** `canSeeBlikPhone()`
      (`lib/payments.ts`) chowa numer w UI (organizator zawsze, uczestnik dopiero
      godzinę przed meczem), ale `toEvent()` robi `select('*')`, a RLS na `events` jest
      wierszowe — numer da się odczytać z ruchu sieciowego mimo że interfejs go nie
      pokazuje. Twarde odcięcie wymaga osobnego widoku bez `blik_phone` albo uprawnień
      kolumnowych, i przepisania selectów, które dziś czytają cały wiersz.
- [ ] **Build w CI** — po dodaniu sekretów `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` do
      repo dołożyć `npm run build` do `.github/workflows/ci.yml` (dziś build wymaga
      kluczy i dlatego jest poza CI).
- [x] **Mignięcie landingu u zalogowanego — naprawione ciasteczkiem-wskazówką.**
      (2026-08-04) Serwer wciąż nie ma prawdziwej sesji, ale `lib/auth.tsx` ustawia
      malutkie ciasteczko `bojo_sess=1` (bez tokenu — patrz `lib/sessionHint.ts`)
      przy `SIGNED_IN`/`TOKEN_REFRESHED`, kasuje przy `SIGNED_OUT`. `app/page.tsx`
      czyta je przez `cookies()` i renderuje szkielet dashboardu (`AppHomeSkeleton.tsx`)
      zamiast landingu, gdy wskazówka mówi „zalogowany". Nieaktualna wskazówka
      samo-naprawia się przy pierwszym `getSession()`. Prawdziwa sesja serwerowa
      (`@supabase/ssr` + `middleware.ts`) to wciąż osobny, większy krok — patrz niżej.
- [ ] **`@supabase/ssr` + `middleware.ts`** — właściwe zamknięcie tematu sesji
      serwerowej, otwierające drogę do prawdziwego SSR redirectu i serwerowego
      renderowania danych dashboardu. Odłożone od ciasteczka-wskazówki wyżej, bo
      dotyka klienta Supabase używanego przez ~44 pliki i może wymusić przepisanie
      callbacku Google (`app/auth/callback`) na route handler z PKCE — flow logowania
      to zbyt duże ryzyko, żeby jechało w tym samym PR-ze co UI. Warunek wstępny:
      `npm run build` w CI (dziś poza pipeline'em — patrz pozycja wyżej) — inaczej
      błąd w `middleware.ts` wyjdzie dopiero na produkcji (jedno środowisko, każdy
      merge idzie na żywo).
- [ ] **`syncReserveClaim` nie ma crona.** Kolejkę ofert dla rezerwowych (`733cf49`,
      `058_reserve_claim.sql`) rusza wyłącznie wejście na stronę meczu
      (`/wydarzenia/[id]`) — jeśli nikt nie wejdzie, oferta nie wygasa i miejsce nie
      trafia do kolejnej osoby. Dashboard świadomie NIE woła tego RPC przy każdym
      otwarciu `/` (zapis do bazy przy każdej wizycie każdego użytkownika byłby zbyt
      kosztowny) — liczniki miejsc na kartach dashboardu mogą więc być nieaktualne,
      dopóki ktoś nie wejdzie w konkretny mecz.
- [ ] **Potwierdzone na produkcji przez Supabase MCP (2026-08-04):** polityka RLS
      `Events readable by all` na `events` ma warunek `true` — każdy, także
      niezalogowany, może odczytać WSZYSTKIE mecze, w tym prywatne. Kod dołączenia
      (`join_code`) chroni tylko w UI, nie w bazie — potwierdza to punkt „Domknąć
      reguły dostępu w RLS" wyżej, tym razem z realnym zapytaniem, nie tylko
      podejrzeniem. `getMyGroupEvents()` (mecze grup, w tym prywatne — `lib/events.ts`)
      działa dziś **wyłącznie dzięki tej luźnej polityce**: gdy ktoś RLS domknie, ta
      funkcja po cichu zacznie zwracać mniej wierszy, bez błędu.
- [x] **`event_participants.claim_token` jest czytelny dla każdego.** ZROBIONE
      migracją `127` (2026-09-02) — i szerzej, niż opisywał ten punkt: razem z tokenem
      z zasięgu ról API wyszły `guest_email`, `guest_phone`, `phone`
      i `confirmation_token`. Zamiast domykać RLS (co urwałoby publiczny skład meczu)
      poszły uprawnienia KOLUMNOWE: `REVOKE SELECT ON event_participants` + `GRANT
      SELECT (lista)`. Token wydaje `token_wpisu_goscia()` — organizatorowi albo osobie,
      która gościa dopisała. Pilnują tego asercje w `supabase/test/rls.sql`.
      Pozycja o `events` (`USING (true)`) zostaje otwarta — to osobne ryzyko, patrz §1.1.
      Oryginalny opis:

- [ ] ~~**`event_participants.claim_token` jest czytelny dla każdego.**~~ Polityka
      `Participants readable by all` ma warunek `USING (true)`, więc token przejęcia
      wpisu gościa (migracja `066`) da się odczytać z ruchu sieciowego dla dowolnego
      meczu, nie tylko przez link, który wysłał dopisujący. Token jest projektowany
      jako sekret na okaziciela — jak `join_code` — więc samo to nie jest regresją, ale
      warto to uwzględnić przy domykaniu RLS na `event_participants` (spójne z pozycją
      o `events` wyżej).

### Bugi UI — zgłoszone z testów na urządzeniu (2026-08-03)

- [x] **Sticky CTA „Stwórz mecz" zasłaniało stopkę na landingu.** (2026-08-03)
      Przyczyna: `Landing` dopełnia własne sekcje (`pb-24`), ale `SiteFooter` jest
      rodzeństwem `<main>` w `app/page.tsx` — poza tym dopełnieniem. Naprawione:
      `StickyCta` obserwuje teraz również stopkę (`#site-footer`) i chowa się, gdy
      ta wejdzie w widok. Na dole strony jest już `LandingFinalCta`, więc sticky bar
      nic tam nie wnosił.

- [ ] **Strona główna wygląda pusto, gdy nie ma otwartych meczów.**
      `LandingOpenGames` zwraca `null` przy zerze pasujących gier (świadoma decyzja:
      pusty stan gorszy niż brak sekcji) — ale wtedy landing traci sekcję i robi się
      rzadki. Do przemyślenia razem z pozycją niżej.

      **Uwaga strukturalna, ważniejsza niż sam wygląd:** sekcja filtruje
      `taken < maxPlayers`, czyli **pokazuje tylko mecze z wolnymi miejscami**.
      Skoro celem produktu jest, żeby mecze zdobywały komplet, to przy powodzeniu
      ta sekcja będzie pusta **tym częściej, im lepiej idzie**. Sam filtr trzeba
      przemyśleć — np. pokazywać też pełne mecze (jako dowód, że apka żyje, z jasnym
      oznaczeniem „komplet"), albo zastąpić sekcję czymś innym, gdy brak wolnych miejsc.

### Bezpieczeństwo (wdrożone — pilnować)
- Telefony i e-maile zescrapowane z OSM **ukryte domyślnie**; widoczność per obiekt
  włącza admin (`contact_visible`, migracja `033`). Egzekwowane na poziomie DB.
- `/admin`, `/api`, `/d/`, `/g/` wyłączone z indeksowania (`robots.ts`). Kody dołączenia
  są jedyną kontrolą dostępu do prywatnych meczów — nie mogą trafić do wyszukiwarki.
- Mecze prywatne nie emitują JSON-LD (`lib/structuredData.ts`, pokryte testem).

---

## 6. Turniej — stan i co zostało

**Zbudowane** (wbrew wcześniejszej wersji tego pliku, która listowała to jako TODO):
`lib/tournaments.ts` (455 linii), 6 tabel `tournament_*` (`029`–`031`), trasy `/turniej`,
`/turniej/rejestracja`, `/turniej/drabinka`, `/turniej/druzyna/[teamId]`,
`/turniej/druzyna/[teamId]/dolacz`, RPC `tournament_team_count`, `shared_availability_days`,
`admin_team_contacts`. Rejestracja drużyn, składy, terminarz, drabinka, zgłaszanie
i potwierdzanie wyników — działa. Ukryte flagą `SHOW_CUP`.

**Zakres: 3 sporty — piłka nożna, koszykówka, siatkówka plażowa.**

> ⭐ **Siatkówka plażowa to główny przypadek użycia** — więcej osób robi turnieje
> plażówki niż hali. Halową siatkówkę traktujemy jako zwykły sport meczowy.

| Sport | Format domyślny | Rozmiar | Uwaga |
|---|---|---|---|
| **Siatkówka plażowa** ⭐ | pucharowy | 2v2 / 4v4 | główny przypadek; boiska już na mapie |
| Piłka nożna | grupy → puchar | 5v5 / 7v7 | trzeba wielu boisk lub slotów czasowych |
| Koszykówka | pucharowy | 3v3 | streetball, najpopularniejszy format amatorski |

### Zostało do decyzji
- [ ] Wizualizacja drabinki na mobile (drzewko jest trudne na małym ekranie)
- [ ] Powiadomienia: wylosowano drabinkę / kiedy następny mecz
- [ ] Płatność za drużynę (re-użyć `trackPayments`)
- [ ] Lista wielu turniejów — dziś model zakłada jeden aktywny (`getActiveTournament`)

---

## 7. SEO / GEO — treści (praca ludzka, nie kod)

Warstwa techniczna (JSON-LD, canonical, robots, sitemap, metadata) jest w kodzie.
Poniższe wymagają pisania treści lub działań poza repo — wg badań GEO (Princeton,
KDD 2024) to one dają największy wzrost cytowalności w wyszukiwarkach AI:

- [x] **Sekcja FAQ na stronie głównej** — widoczne pytania i odpowiedzi z FAQPage
      schema, dodane w ramach redesignu landingu (2026-08-03):
      `components/home/landing/{LandingFaq,content}.tsx`, `lib/structuredData.ts`
      (`faqJsonLd`). Treść widoczna i schema dzielą jedno źródło (`LANDING_FAQ`),
      pilnowane testem `src/__tests__/landingContent.test.ts`.
- [x] ~~Strona `/o-nas`~~ (E-E-A-T) — kim jesteśmy, dlaczego budujemy Bojo, kontakt, model
      biznesowy, atrybucja OSM. Doszły też trzy siostrzane strony pod tę samą strategię:
      `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq` (2026-08-13). **Usunięta** — strona
      treści bez wystarczającej wartości dla organizatora, sprzątnięta w ramach szlifowania
      przepływu organizatora.
- [x] **Dane własne jako treść** (GEO: statystyki podnoszą cytowalność ~40%) — sekcja
      `LandingStats` na stronie głównej pokazuje liczby zaszyte w `LANDING_STATS`
      (`components/home/landing/content.ts`), aktualizowane ręcznie.
      ⚠️ **Sprostowanie (2026-08-13):** ten wpis wcześniej twierdził, że liczbę boisk liczy
      `lib/landingStats.ts`/`getPublicVenueCount()` przy renderze — **te pliki nie istnieją**.
      `LANDING_STATS.sportsValue` i spółka to statyczne literały, nie zapytanie do bazy.
      Licznik z bazy zostaje pomysłem, nie zrobioną rzeczą.
- [ ] **Obecność zewnętrzna / backlinki** — profile w katalogach, grupy FB, prasa
      lokalna, współprace z obiektami. Najsilniejszy sygnał klasycznego SEO; buduje
      się miesiącami, poza repo.
- [ ] **Core Web Vitals** — zmierzyć po wdrożeniu (PageSpeed Insights) i dopiero na
      podstawie pomiaru decydować o optymalizacjach.

### 7b. Z audytu SEO/GEO (2026-08-23)

Pełne uzasadnienie, gotowe copy i kod → [docs/seo-geo-strategia.md](./docs/seo-geo-strategia.md).
Numeracja `D*` odsyła do listy długu w rozdziale 0 tamtego dokumentu.

**PILNE — osobny PR, nie czeka na resztę:**

- [x] **Metadane prywatnego meczu wyciekają** (D1) — **zrobione, nieodhaczone do
      2026-08-25** (audyt SEO/GEO runda 2). `eventMeta.ts#metadataDlaMeczu()` filtruje
      po `visibility` — mecz niepubliczny (albo nieistniejący) dostaje `robots: {index:
      false, follow: false}` i żadnego pola z nazwą, terminem ani miejscem. JSON-LD
      chronione było od początku (`structuredData.ts:83`), metadane dogonione. Test:
      `src/__tests__/eventMetadata.test.ts` — trzy warianty `visibility` × dwie asercje
      (brak wycieku w treści, `robots`/`canonical` poza indeksem).
- [x] **„Zarezerwuj termin" w opisie 32 tys. stron obiektów** (D2) — **zrobione,
      nieodhaczone do 2026-08-25**. `boisko/[id]/page.tsx:193-196` opisuje wprost w
      komentarzu, dlaczego frazy nie ma: „rezerwacje siedzą za wyłączoną flagą
      FEATURE_RESERVATIONS, a to zdanie szło do wyszukiwarek przy każdej z ponad
      30 tysięcy stron obiektów". `description` dziś kończy się na „Zobacz nadchodzące
      mecze i zbierz skład na Bojo."
- [x] **Podwójny sufiks `| Bojo | Bojo`** (D3) — **zrobione, nieodhaczone do
      2026-08-25**. Sufiks został wyłącznie w `openGraph.title` (gdzie `title.template`
      z `layout.tsx` się nie stosuje); `title` widoczny w karcie wyników idzie bez niego.
      Test: `eventMetadata.test.ts` — „nie dokłada ręcznego sufiksu «| Bojo»".
- [x] **Trasy techniczne i za flagami otwarte dla robotów** (D4) — **zrobione,
      nieodhaczone do 2026-08-25**. `robots.ts` ma dziś 18 wpisów `DISALLOW`:
      `/auth/`, `/logowanie`, `/zglos-blad`, kreatory i `/*/edytuj`, `/turniej`,
      `/cykliczne`, `/obiekt`, `/rezerwacje`, `/gracz/`. Test:
      `src/__tests__/robots.test.ts` — enumeruje dokładnie tę listę i osobno
      pilnuje, że trasy publiczne (`/wydarzenia`, `/boisko`, `/mapa`…) NIE trafiają
      do wykluczeń — regresja w drugą stronę.

**Quick winy:**

- [x] **Serwerowy `<h1>`, opis i nawigacja na `/boisko/[id]`** (D5, D6, D7; zrobione
      2026-08-23). Nagłówek obiektu wyniesiony do `NaglowekObiektu` w
      `VenueDetailClient.tsx` i renderowany w OBU stanach — także w stanie ładowania,
      czyli w HTML, który dostaje crawler. Nazwa i adres przychodzą propsami z `page.tsx`.
      Ukryty blok `itemProp` usunięty: był obejściem braku treści, a treść schowana przed
      człowiekiem i podana robotowi jest sygnałem spamu. Doszły widoczne linki do huba
      wojewódzkiego, huba sportu i `/jak-dziala-bojo` — hub wojewódzki przestaje być
      sierotą, więc **to zamyka też Fazę 2b**. Zweryfikowane na atrapie PostgREST-a:
      strona oddaje `<h1>`, opis, adres i 27 linków wewnętrznych.
      Przy okazji tytuł przestał odmieniać miejscownik regułą („piłka nożna w Poznań" →
      „piłka nożna, Poznań") — odmiany nie da się wyprowadzić z reguły, dlatego
      `content/miasta.ts` trzyma ją jako dane.
- [x] **Stopka na wszystkich stronach publicznych** (D9, zrobione 2026-08-23) — doszła na
      `/boiska/[sport]`, `/boiska/woj/[x]`, `/wydarzenia` i `/grupy`. **Bez `/mapa`**: ta trasa
      ma `h-[100dvh] overflow-hidden`, więc stopka byłaby tam przycięta — mapa potrzebuje
      innego rozwiązania niż stopka. `/boisko/[id]` dostaje ją razem z serwerowym renderem
      (pozycja niżej).
- [x] **Link z landingu do hubów katalogu** (D8, zrobione 2026-08-23) — rozwiązane grupą
      „Boiska" w `SiteFooter`: sześć hubów sportowych z KAŻDEJ strony ze stopką, nie tylko
      z landingu. Zostaje otwarte: link z hubu sportu prowadzi nadal zawsze do
      `/[sport]/poznan` (`boiska/[sport]/page.tsx`), a D18 (serwerowy render otwartych gier
      i boisk na landingu) to osobna pozycja niżej.
- [ ] **Pomiar bazowy przed jakąkolwiek optymalizacją** — Search Console + 40 promptów
      (Załączniki A i B strategii).
- [x] **Ujednolicić liczbę obiektów w katalogu** (D13, zrobione 2026-08-24) —
      dwa komentarze w kodzie ze sztywną, już nieaktualną liczbą „32 684" zastąpione
      tą samą frazą „ponad 30 000" co w treści widocznej dla użytkownika
      (`content/dlaczego.ts`, `llms.txt`). Datowany zapis w BACKLOG (36 268, ten wpis)
      zostaje jako historia, nie konkuruje z liczbą bieżącą.
- [x] **`.in('seo_tier',[1,2])` zamiast `.neq(…, 3)`** (D12, zrobione 2026-08-24) —
      przy okazji zweryfikowane wprost w migracji `112`: `fields.seo_tier` jest
      `SMALLINT NOT NULL DEFAULT 3` z `CHECK IN (1, 2, 3)`, więc `NULL` jest niemożliwy
      na poziomie bazy, nie tylko przefiltrowany tym zapytaniem — silniejsze uzasadnienie
      niż w pierwotnym D12. `priorytetDlaTier()` zawężone do `1 | 2`, martwa gałąź
      i jej test usunięte.

**Średnioterminowe:**

- [x] **Bramka `scripts/audyt-robota.mjs` w CI** (zrobione 2026-08-23) — pobiera stronę
      zwykłym `fetch`, bez JS, i sprawdza `<h1>`, podwojony sufiks w tytule, `description`
      wraz z frazami zakazanymi (parsowanymi z `content/zakazaneFrazy.ts`, jedno źródło),
      linki wewnętrzne i `noindex`. Krok w zadaniu `test` w `ci.yml`, reużywa builda.
      **Ograniczenie:** na atrapach kluczy trasy żyjące z danych sprawdzane są miękko —
      stronę obiektu twardo weryfikuje dopiero przebieg przeciwko produkcji
      (`node scripts/audyt-robota.mjs --baza https://bojo.pl`).
- [x] **Akapit bezpośredniej odpowiedzi na landingu** (zrobione 2026-08-24) —
      `LandingDirectAnswer.tsx`, komponent serwerowy zaraz pod hero, przed statystykami.
- [x] **Sekcje odróżniające Bojo od systemów rezerwacji** (zrobione 2026-08-24) —
      nowa sekcja w `content/jakDziala.ts` (`bojo-a-rezerwacje`), nowa sekcja w
      `content/dlaczego.ts` (`trzy-rzeczy`), nowe pytanie w `content/faq.ts` (kategoria
      `podstawy`).
- [x] **Strona kalkulatora podziału kosztu boiska** (zrobione 2026-08-24) —
      `/kalkulator-kosztow-boiska`, strona statyczna (bez `useSearchParams()`, bez
      zapytań do bazy), kalkulator kliencki. Liczy WYŁĄCZNIE `perPlayerPriceGrosze()`
      i `priceForParticipant()` z `lib/payments.ts` — pierwsza to nowo wydzielony
      odpowiednik formuły z kreatora meczu (`app/wydarzenia/nowe/page.tsx`), druga to
      ta sama funkcja co na stronie meczu. Orkiestracja w `lib/kalkulatorKosztow.ts`
      (testowalna bez renderowania), treść w `content/kalkulator.ts`. Zweryfikowane
      end-to-end w prawdziwej przeglądarce (Playwright): 280 zł / 14 graczy = 20,00 zł,
      zmiana na 10 graczy → 28,00 zł, 3 graczy z kartą i zniżką 5 zł → 23,00 zł.
- [x] **`alternateName` + `disambiguatingDescription` w `Organization`** (zrobione
      2026-08-26) — **pozycja była zablokowana niesłusznie**. Do rundy 3 stała tu jedna
      pozycja czekająca na Jana, choć 5a od początku rozdziela trzy pola: `alternateName`
      i `disambiguatingDescription` opisują Bojo samo w sobie i nie zależą od niczego
      poza repo; na profilach czeka **wyłącznie `sameAs`** (pozycja niżej). Przez dwie
      rundy nie dopisał ich nikt, bo spłaszczenie do jednej pozycji ukryło, że dwa
      z trzech pól są odblokowane. `lib/structuredData.ts#siteJsonLd` niesie dziś oba;
      `disambiguatingDescription` mówi wprost, że wpis dotyczy aplikacji, a nie
      potocznego słowa oznaczającego boisko. Zweryfikowane w surowym HTML z lokalnego
      builda produkcyjnego (`curl` bez JS, `"alternateName":["Bojo.pl","aplikacja
      Bojo"]` w JSON-LD strony głównej). Test: `structuredData.test.ts` — pole istnieje
      i mówi o aplikacji, plus asercja, że `sameAs` NIE zostało dopisane na zapas.
- [ ] **`sameAs` w `Organization`** — **to jest ta część, która realnie czeka na
      pozycję „Trzy profile poza domeną" (Jan).** Puste albo zmyślone `sameAs` jest
      gorsze niż jego brak: wskazuje crawlerowi pustkę i kosztuje zaufanie, które to
      pole ma budować (docs/seo-geo-strategia.md, 5a). Dopisać w tym samym miejscu
      (`lib/structuredData.ts#siteJsonLd`, komentarz przy `areaServed` mówi gdzie)
      dopiero wtedy, gdy profile realnie istnieją — wtedy usunąć też asercję
      „nie deklaruje sameAs" z `structuredData.test.ts`.
- [x] **Zdanie ujednoznaczniające w nagłówkach `llms.txt` i `llm-context.md`**
      (zrobione 2026-08-26, 5e punkt 2) — proponowane w rundzie 1, nigdy niedopisane.
      Model czytający którykolwiek z tych plików na zimno dostaje rozstrzygnięcie
      kolizji nazwy w nagłówku, zanim zacznie zgadywać z treści.
- [x] **Potwierdzenia graczy w `amenityFeature`** (zrobione 2026-08-24) —
      `venueAmenityFeatures()` w `lib/structuredData.ts`, quorum współdzielone z
      `AnkietyObiektu.tsx` przez `lib/potwierdzeniaObiektu.ts#najlepszePotwierdzenie`/
      `QUORUM_POTWIERDZEN` — jeden próg dla treści widocznej i danych strukturalnych.
- [x] **Linkowanie poziome hubów i akapity wprowadzające na `/boiska/*`**
      (zrobione 2026-08-24) — `/boiska/[sport]` linkuje do 16 województw,
      `/boiska/woj/[x]` linkuje do pozostałych 15 województw i sześciu hubów
      sportowych (wspólne źródło `HUBY_KATALOGU_SPORTOWYCH` w `lib/sports.ts`,
      zastępujące trzy niezależne kopie tej samej listy). Akapit generowany
      z danych w `content/boiska.ts`, wzorem `content/miasta.ts`.

**Długoterminowe:**

- [x] ~~Nowy próg indeksacji obiektów~~ **ODRZUCONE 2026-08-25** — decyzja właściciela:
      nie zmniejszamy indeksu. Obiekty w katalogu są dziś przede wszystkim pinezkami na
      mapie; dodatkowe dane (potwierdzenia, mecz) są plusem, nie warunkiem obecności
      w wyszukiwarce. `seo_tier`/`oblicz_seo_tier()` (migracja `112`) zostają bez zmian.
- [x] **`/boiska/[sport]/[miasto]`** (zrobione 2026-08-25) — warstwa katalogu między
      hubem krajowym a wojewódzkim, ograniczona tabelą `miasta_priorytetowe`. Próg
      jakości **ustalony ręcznie przez właściciela: minimum 3 obiekty** (Tier 1 lub 2)
      dla danej pary sport+miasto (`lib/hubMiasta.ts#PROG_OBIEKTOW_HUB_MIASTA`) — nie
      jest to próg z odrzuconej pozycji wyżej, tylko niezależna decyzja liczbowa.
      Poniżej progu i przy błędzie zapytania do bazy strona zwraca 404 (`notFound()`),
      nigdy 500 — degradacja wzorem `resolveField()` w `boisko/[id]/page.tsx`.
      Linkowanie w obie strony (4b): `/boiska/[sport]` → miasta powyżej progu (tylko
      strona 1), nowa strona → hub sportu, hub województwa i `/[sport]/[miasto]` (gdy
      oba istnieją dla tego miasta). `sitemap.ts` dokłada pary sport×miasto powyżej
      progu, zdegradowane do pustej listy przy niedostępnej bazie, tak jak
      `sitemap-boiska/[plik]/route.ts`. `KATALOG_SPORT_MAP` wydzielony do
      `lib/sports.ts` — trzeci konsument tej samej siódemki sportów.
- [x] **Polityka cyklu życia strony meczu** (zrobione 2026-08-25) — miniony publiczny
      mecz przestaje być indeksowalny (`robots: {index: false, follow: true}` w
      `eventMeta.ts#metadataDlaMeczu()`, próg `isPast()` z kreatora meczu), ślad zasila
      stronę obiektu jako zdanie „Na tym obiekcie odbyło się już N meczów…"
      (`content/opisObiektu.ts#zdanieORozegranychMeczach()`), widoczne od pierwszego
      rozegranego meczu, licznik w `boisko/[id]/page.tsx#getPlayedMatchesCount()`.
- [x] **Widget „najbliższe mecze na tym obiekcie"** dla zarządców (zrobione 2026-08-25) —
      `/widget/boisko/[id]`, fragment do osadzenia w `<iframe>` na stronie obiektu (bez
      Header/SiteFooter/dolnej nawigacji), z linkiem powrotnym do Bojo (`target="_top"`) —
      to jest cały mechanizm wzmianki i linku z domeny o lokalnym autorytecie. Kod do
      wklejenia generuje `lib/widget.ts#kodOsadzeniaWidgetu()`, kopiowany przyciskiem
      „Kod widgetu" w `/admin/outreach`, do zaoferowania w tej samej rozmowie zamiast
      prośby o link. Globalne UI Bojo (baner cookies, zachęta do instalacji PWA, modal
      onboardingu, rejestracja service workera) wyłączone na trasie `useJestWidget()` —
      bez tego zarządca zobaczyłby baner cookies Bojo wewnątrz WŁASNEJ witryny.
      Wysokość iframe stała (420px, przewijana w środku) — auto-resize przez
      `postMessage` między domenami zostaje pomysłem, nie zrobioną rzeczą.
- [x] ~~Wkład zwrotny do OpenStreetMap~~ **ODRZUCONE 2026-08-25** — decyzja właściciela:
      nie ma potrzeby oddawać danych zwrotnie do OSM. Ryzyko licencyjne (ODbL) zostaje
      nieaktualne, bo nic nie jest wydawane na zewnątrz.

**Runda 2 (2026-08-25) — dług, którego tabela wyżej nigdy nie objęła**
(docs/seo-geo-strategia.md, rozdział 0, D10/D11/D14/D15/D17):

- [x] **D10** — priorytety `/mapa`, `/wydarzenia`, `/grupy` w `sitemap.ts` obniżone
      poniżej stron treści (były równe albo wyższe, mimo że te trzy trasy są dla
      robota puste). Test: `sitemapPriorytety.test.ts`.
- [x] **D11** — huby `/boiska/[sport]` i `/boiska/woj/[x]` listowały obiekty bez
      filtra `seo_tier`, wydając budżet skanowania na strony Tier 3 (`noindex`).
      Zapytania wydzielone do `lib/hubKatalogu.ts#obiektyHubuSportu`/
      `obiektyHubuWojewodztwa`. Test: `hubKatalogu.test.ts`.
- [x] ~~D14~~ — **SPROSTOWANIE, nie naprawa**: `/boiska/inne` poza sitemapem
      i linkowaniem hubów jest decyzją z 2026-08-24 (`lib/sports.ts`), nie
      przeoczeniem. Kod bez zmian.
- [x] **D15** — paginacja hubów (`?strona=N`) nie miała `noindex`; strony 2+
      dostają dziś `robots: {index: false, follow: true}`
      (`lib/hubKatalogu.ts#metadanePaginacjiHuba`). Test: `hubKatalogu.test.ts`.
- [x] **D17** — martwy obrazek OG (`poznan-satellite.jpg` w `layout.tsx`, nigdy
      nierenderowany — nadpisywała go konwencja plikowa `opengraph-image.tsx`).
      Usunięty razem z plikiem. Test: `ogImageJednoZrodlo.test.ts`.

**Runda 2, Partia 2 (2026-08-25) — quick winy cytowalności**
(docs/seo-geo-strategia.md, rozdział 3):

- [x] **Nagłówki `<h3>` w FAQ** (3d) — `MiniFaq.tsx` owijał pytania w gołe `<summary>`
      bez struktury nagłówków na pięciu stronach naraz. Test: `faqNaglowki.test.ts`.
- [x] **Dwa nowe pytania FAQ, sprawdzone pojedynczo** (3d) — z czterech propozycji
      z rundy 1 dwie były już pokryte istniejącą treścią (dopisanie byłoby
      duplikatem, nie przyrostem gęstości), dwie realne luki dodane: „Czy da się
      prowadzić zapisy bez zakładania grupy?" i „Skąd wiadomo, czy na boisku jest
      oświetlenie?" (opisuje mechanizm potwierdzeń UGC, wcześniej nieopisany
      w żadnym FAQ).
- [x] **LANDING_STATS i dezambiguacja marki w treści — zweryfikowane, bez zmian
      w kodzie** (3a) — `LandingDirectAnswer.tsx` (poz. 10) już rozwiązuje oba
      problemy naraz. Werdykt rundy 1 o statystykach się nie zmienił.
- [ ] **Deduplikacja tabeli porównawczej na `/dlaczego-bojo`** (3c, pozycja 28
      w roadmapie) — ten sam tekst w DOM dwa razy (`md:hidden` karty + `hidden
      md:block` tabela). Wymaga przebudowy znacznika (UI), nie treści — świadomie
      poza zakresem Partii 2.

**Runda 2, Partia 3 (2026-08-25) — fosa: F4 zbudowane, F1/F2 sprostowane**
(docs/seo-geo-strategia.md, rozdział 8):

- [x] **F4 — „czy tu się w ogóle gra, i kiedy"**: strona obiektu i JSON-LD
      dostały datę ostatniego rozegranego meczu obok samej liczby (F3 dawało
      tylko licznik). `getOstatnieMecze()` w `boisko/[id]/page.tsx` (jedno
      zapytanie zamiast dwóch — `count: 'exact'` liczy niezależnie od
      `.limit(1)`), drugi argument `zdanieORozegranychMeczach()` opcjonalny,
      więc żadne dotychczasowe wywołanie się nie zmienia. Zero meczów → nadal
      `null`, żadnej daty — zasada „brak danych jako brak danych" bez wyjątków.
      Test: `opisObiektu.test.ts`.
- [x] **F1 sprostowane, nie naprawione** — fosa nie zależy od odrzuconego progu
      indeksacji (4c/poz. 19); potwierdzenia UGC są fosą same w sobie i są już
      w całości zbudowane (poz. 18). Skorygowano też wiersz `ItemList` w 5d
      (D11 naprawione istniejącym tieringiem, nie odrzuconym 4c) i próg
      sukcesu „90 dni" w 7b (zależał od 4c).
- [x] **F2 wycofane z listy fosy** — całość opierała się na 4c. Bez zastępnika
      na siłę: to, co zostaje z intencji, żyje dalej w F1 i F4.
- [ ] **Ekspozycja aktywności na poziomie katalogu** (filtr „obiekty z
      potwierdzoną aktywnością") — świadomie NIE teraz. Przy ~40 obiektach
      z jakimkolwiek meczem na 36 tys. w katalogu taki filtr pokazywałby
      prawie pustą listę (R1). Wraca, gdy liczba meczów urośnie o rząd
      wielkości.

**Runda 3 (2026-08-26) — resztki i domknięcie dryfu**
(docs/seo-geo-strategia.md, rozdział 0 i 9):

- [x] **Zaszyty Poznań w linku z hubu sportu** (reszta D8) — `/boiska/[sport]`
      prowadził zawsze do `/[sport]/poznan`, więc osiem z dwunastu landingów
      sport+miasto (Warszawa, Kraków) nie miało żadnego wejścia z serwisu, a ktoś
      szukający gry w Krakowie dostawał link do Poznania. Lista idzie dziś z `MIASTA`
      (`content/miasta.ts`) — z tej samej stałej, z której `generateStaticParams()`
      landingu buduje strony, a `dynamicParams = false` gwarantuje, że innych nie ma;
      nie da się więc wskazać strony nieistniejącej ani zapomnieć o nowym mieście.
      **Rozważana alternatywa — usunięcie linku — odrzucona:** strony istnieją i są
      najgęściej zalinkowaną częścią serwisu (rozdz. 0), więc problemem był zły cel
      linku, nie sam link. Zweryfikowane w surowym HTML (`curl` bez JS: trzy adresy
      w HTML hubu) i przebiegiem 12 × HTTP 200 na wszystkich landingach.
      Test: `hubSportuMiasta.test.ts`.
- [x] **Tabela roadmapy w rozdziale 9 doprowadzona do stanu kodu** — dziewięć wierszy
      (1, 3–9, 13) stało nieprzekreślonych, choć BACKLOG opisywał je jako zrobione.
      Dokładnie ten rozjazd plan/kod, dla którego powstał rozdział 0 — tym razem
      w samym dokumencie. Każdy wiersz odhaczony z dowodem (ścieżka i linia albo
      wynik przebiegu); wiersz 6 odhaczony **z zastrzeżeniem**, że dowodem jest kod,
      a nie produkcja.
- [x] **Znacznik „Stan na:" w `llm-context.md` doprowadzony do prawdy i objęty
      walidatorem** — deklarował `45 tabel` (baza ma **53**, policzone na schemacie
      postawionym od zera przez `baza-testowa.sh`) i `775 testów` (jest **827**).
      `check:docs` sprawdzał wyłącznie numer migracji, więc reszta znacznika dryfowała
      po cichu przez dwie rundy. Sekcja 9 walidatora sprawdza dziś **całość**: format,
      datę (odrzuca datę z przyszłości), numer migracji i liczbę tabel liczoną
      z migracji (`CREATE TABLE` minus `DROP TABLE` — wynik zgodny co do nazwy
      z realnym schematem). Liczba testów **wypadła ze znacznika**, bo jako jedyna
      nie da się zweryfikować statycznie, a pole niesprawdzalne jest właśnie tym,
      które zdryfowało. **Ograniczenie zapisane wprost w kodzie:** nieaktualnej daty
      w przeszłości nic nie odróżni od poprawnej — świeżości pilnują migracja
      i liczba tabel, które wymuszają dotknięcie znacznika.
- [x] **`AGENTS.md`: „463 testy" → 827** — liczba zmierzona przy okazji, nie
      przepisana.
- [x] **Deduplikacja tabeli porównawczej na `/dlaczego-bojo`** (pozycja 28, zrobione
      2026-08-26) — strona renderowała `TABELA_POROWNAWCZA` DWA razy: raz jako karty
      (`md:hidden`), raz jako tabelę (`hidden md:block`). Człowiek widział jedną
      wersję, bo drugą chowało CSS; robot dostawał obie, więc dziesięć wierszy razy
      trzy pola szło do HTML-a podwójnie. Dziś jeden `<table>`: wiersz jest blokiem
      (kartą) na telefonie i wraca do `table-row` od `md:` w górę, wyłącznie przez
      warianty `min-width`. Nagłówki kolumn zostają schowane na telefonie — tak samo
      jak w poprzedniej wersji kartowej, więc a11y nie traci nic, co miała.
      **Bramka, nie tylko poprawka:** `audyt-robota` dostał szósty test —
      `duplikatyTresci()` wykrywa fragment tekstu widocznego dłuższy niż 40 znaków,
      który występuje w HTML-u więcej niż raz. Sprawdzone w obie strony: na buildzie
      sprzed poprawki wykrywa **5 powtórzonych fragmentów** na `/dlaczego-bojo`,
      po poprawce **0**. Wygląd zweryfikowany osobno i mocniej, niż zrobiłoby to
      CI: zrzut sekcji `#roznice` z buildu przed i po, w tym samym środowisku,
      na telefonie (390px) i na komputerze (1280px) — **identyczny co do bajtu**
      (to samo `sha256`). Ten sam obraz, o połowę mniej DOM-u. Skrypt czyta wyłącznie tekst (skrypty i style wypadają),
      więc JSON-LD — który celowo powtarza treść strony i tak ma być — nie daje
      fałszywego alarmu.

**Ocena rundy 3: dalsza praca w kodzie SEO/GEO nie ma już sensu.** Uzasadnienie
liczbowe pod tabelą roadmapy w `docs/seo-geo-strategia.md`, rozdział 9. W skrócie:
z 28 pozycji roadmapy 21 jest zrobionych, 2 odrzucone, 5 otwartych — a wszystkie trzy
o wpływie „wysoki" są poza repozytorium (Jan). Pomiar bazowy po trzech rundach nadal
wynosi zero, więc 21 wdrożonych zmian nie ma wartości wyjściowej, do której dałoby się
je odnieść. Wąskie gardło: pomiar, potem encja poza domeną, potem brak organizatorów.

**Dopisek 2026-08-29 — pomiar bazowy przestał być zerem, jedna poprawka z niego
wynikła.** Właściciel zmierzył Core Web Vitals na pięciu typach stron w przeglądarce
(`pagespeed.web.dev`) — pierwszy raz po trzech rundach (docs/seo-geo-strategia.md,
7a.1). Z rozwiniętego audytu „Ułatwienia dostępu" na `/boiska/pilka-nozna` wyszło
pięć elementów z niewystarczającym kontrastem WCAG AA; cztery naprawione mechanicznie
([PR #302](https://github.com/fpudelko/bojo-app/pull/302) — konkretne wartości
i uzasadnienie w 7a.1), dwa świadomie zostawione jako decyzja produktowa (linki
rozróżnialne wyłącznie po kolorze, za małe pola dotykowe). Zdanie „pomiar bazowy…
wynosi zero" wyżej jest już nieaktualne.

**Runda 4 (2026-09-01) — pierwsza runda oparta na pomiarze, nie na lekturze kodu**
(docs/seo-geo-strategia.md: 2c, 5f, rozdz. 8, rozdz. 9, Załącznik A):

- [x] **Tytuł i opis pod zapytanie markowe** (poz. 30) — pomiar z 2026-08-29 pokazał, że
      jedyne zapytania, na jakie Bojo się wyświetla, są markowe („co to bojo" 18 wyśw.,
      „bojo" 8, „bojo co to" 7) i mają **zerowy CTR przy pozycji 9,4**. Przyczyna była
      w treści, nie w pozycji: dawny tytuł („Bojo — zbierz ekipę, zagraj dziś | Boiska
      i mecze w Polsce") nie zawierał ani jednego słowa podważającego definicję
      słownikową „bojo = boisko" — wszystkie ją potwierdzały. Dziś tytuł niesie rzeczownik
      kategorii: „Bojo (bojo.pl) — aplikacja do organizowania amatorskich meczów", opis
      zaczyna się od nazwy encji. To samo na `/dlaczego-bojo` — drugiej i jedynej poza
      landingiem stronie w indeksie. Ciągi wyniesione do `content/metaWyszukiwarki.ts`,
      bo w `layout.tsx` nie dało się ich przetestować, a nie pilnował ich ŻADEN test.
      Test: `src/__tests__/tytulMarkowy.test.ts` (9 asercji, w tym regresja w drugą
      stronę: hasło podglądu linku i nazwa PWA mają NIE zlewać się z tytułem w SERP-ie).
      Zweryfikowane `curl` bez JS na surowym HTML obu stron.
- [x] **Sprostowanie: canonical na `/wydarzenia/[id]` NIE jest luką** — notatka rundy 4
      wymieniała jego brak jako dług; `eventMeta.ts#metadataDlaMeczu()` ustawia go dla
      meczu publicznego, a niepubliczny dostaje celowo samo `title` + `noindex`. Zapis
      poprawiony, żeby nikt nie „naprawiał" działającego kodu.
- [x] **Hipotezy pod „Przeglądanie agentowe" 2/3** (5f) — strona obiektu jest jedynym
      z pięciu zmierzonych typów z wynikiem 2/3, i ma 30 tys. adresów. Trzy hipotezy
      uszeregowane; najwyżej ta, że `SportsActivityLocation` w `boisko/[id]/page.tsx` to
      **jedyny JSON-LD w repo pisany inline, poza `lib/structuredData.ts`, i jedyny bez
      testu**. Rozstrzygnięcie zaprojektowane na 2 minuty (walidator danych
      strukturalnych, nie ponowny pomiar).
- [x] **Trzy profile poza domeną — z nazwy, z gotowym copy** (rozdz. 6.2) — pozycja 15
      stała trzy rundy, bo mówiła ogólnie „katalogi alternatyw". Dziś: AlternativeTo,
      strona firmy na LinkedIn, trzecie do wyboru przez Jana metodą, która sama jest
      pomiarem (zobaczyć, co modele cytują przy koszyku 1). Opis profilu gotowy
      w dwóch długościach, oba z jednego źródła co `DLACZEGO_ODPOWIEDZ`.
- [x] **Arkusz zapisu 40 promptów** (Załącznik A) — legenda skrótów, trzy pola wymagane
      przez sam Załącznik, zasady przebiegu. Ani jedno z 40 pytań nie zmienione.
- [x] **Odczyt propagacji sitemapy** (poz. 29, właściciel, 2026-09-01) — **„Wykryte
      strony" 0 → 32 400 natychmiast po odświeżeniu, zaindeksowane nadal 2.** Zamyka
      pytanie o mapy wojewódzkie: działają, `.in('seo_tier',[1,2])` przepuszcza ~32 tys.
      adresów zgodnie z projektem, a jedynym problemem był brak zgłoszenia. NIE zamyka
      pytania o R1 — „wykryte" znaczy tylko, że adres jest znany, nie że został pobrany
      i oceniony; przy nowej domenie bez linków przychodzących indeksacja 32 tys. adresów
      to tygodnie.
- [ ] **Odczyt sygnału R1** (poz. 29b) — **PRACA JANA, minuty, najwyższy wpływ w całym
      dokumencie.** Inny raport niż wyżej: `Indeksowanie → Strony`, pozycje „Wykryto —
      obecnie bez indeksu" i „Zeskanowano — obecnie bez indeksu". Jeśli za 2–4 tygodnie
      urosną do dziesiątek tysięcy przy niezmienionej liczbie zaindeksowanych, katalog
      jest oceniany jako treść masowa. Terminy: 2026-09-15 i 2026-09-29.
- [x] **Fakt unikalny dla obiektu bez meczów** (poz. 32, **ZBUDOWANE 2026-09-01**,
      decyzją właściciela po odczycie wyżej) — na obiekcie bez ani jednego meczu (99,9%
      katalogu) jedyne zdanie własne Bojo było **bajtowo identyczne na wszystkich
      36 268 stronach**, a wszystkie trzy linki wychodzące prowadziły do hubów: katalog
      był gwiazdą, nie siecią. Strona obiektu pokazuje dziś do sześciu innych boisk tego
      samego sportu w okolicy, najbliższe pierwsze, z odległością.
      `lib/pobliskieObiekty.ts` (`kadrWokol` + filtr `seo_tier IN (1,2)`, przycięcie po
      `distanceKm` — kadr jest kwadratem, więc bez tego lista mówiłaby „w okolicy"
      o obiekcie 11 km dalej), render w `OpisIPowiazane` w OBU gałęziach, także bez JS.
      Test: `pobliskieObiekty.test.ts`, 10 asercji — tego zachowania nie widać
      w interfejsie bez bazy z kilkoma obiektami tego sportu w promieniu 8 km.
      **NIEZWERYFIKOWANE:** wygląd i zawartość listy na prawdziwych danych — sesja nie ma
      dostępu do produkcji ani do stosu lokalnego (brak gniazda Dockera).

**Ocena rundy 4: wniosek rundy 3 broni się, ale nie z powodu, dla którego został
napisany.** Runda 3 mówiła „kod zrobił swoje, bo pomiar wynosi zero". Pomiar już nie
wynosi zera — i pokazał coś innego: **mapa witryny nigdy nie została zgłoszona**, więc
Google nie odrzucił 36 tys. stron, tylko o nich nie wiedział. Efekt rund 1–3 jest wciąż
PRZED pomiarem, nie po nim. Wąskie gardło bez zmian: brak organizatorów.

### 7a. Tierowanie katalogu boisk — Fazy 0-3 (2026-08-20 → 2026-08-22)

> **Uwaga (2026-08-23):** nagłówek mówił „ZROBIONE". Audyt pokazał, że Fazy 1 i 2b
> nie działają dla robota — ptaszki cofnięte, sprostowania przy pozycjach niżej.

Użytkownik wkleił obszerny plan SEO/GEO (tiered indexing, huby miast, programmatic
content, JSON-LD, crowdsourcing) dla katalogu boisk. Audyt kodu i produkcyjnej bazy
(wtedy 32 684 wiersze w `fields`, tylko 40 z meczem w całej historii, brak kolumn
city/voivodeship) pokazał, że część liczb z wklejonego planu nie zgadzała się
z rzeczywistością — pełne uzasadnienie w migracji `112_seo_tier_i_lokalizacja.sql`
i w sekcji „Tierowanie indeksacji katalogu boisk" w [funkcje.md](./docs/funkcje.md).
Katalog urósł międzyczasie do 36 268 wierszy; backfill lokalizacji przeszedł realnie
(3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3).

- [x] **Faza 0 — fundament danych i higiena.** `fields.city`/`voivodeship`/`seo_tier`,
      tabela `miasta_priorytetowe`, funkcja `oblicz_seo_tier()` + triggery promocji,
      `scraper/backfill_lokalizacja.py`, sitemap partycjonowany per województwo
      (`sitemap-boiska/[plik]/route.ts` + `sitemap-index.xml/route.ts`), `noindex` dla
      Tier 3, usunięcie `?wroc=` z linków wewnętrznych (`lib/powrot.ts`, sessionStorage
      zamiast query stringa). **Migracja `112` wymaga ręcznego uruchomienia na Supabase
      + ręcznego przebiegu `scraper/backfill_lokalizacja.py` per województwo** — bez
      backfillu wszystkie boiska zostają w Tier 3 (`noindex`).
- [x] **Faza 1 — fact-dense opis obiektu** (kod 2026-08-22, ptaszek cofnięty i **przywrócony 2026-08-23**, gdy opis zaczął renderować się serwerowo). Generator
      `content/opisObiektu.ts#opisObiektu()` — nie `lib/`, wzorem `content/miasta.ts`
      (`odpowiedzMiasta()`/`zdanieOKatalogu()`), bo to ta sama klasa: funkcja tworząca
      treść, nie logika domenowa. „Direct answer" akapit z danych obiektu (sport,
      miasto, nawierzchnia, oświetlenie, kryty/odkryty), wpięty w `/boisko/[id]`
      (`VenueDetailClient.tsx`, pod nagłówkiem) i w `description` JSON-LD
      (`SportsActivityLocation`) — jedno źródło. Próbka reprezentatywnych obiektów
      dopisana do wspólnej listy jednostek treści w `tresciStron.test.ts`
      (`content/zakazaneFrazy.ts`), nie osobny test — to czysty szablon, nie każdy
      z 36k+ wierszy wymaga sprawdzenia z osobna.

      ⚠️ **Sprostowanie (2026-08-23):** kod powstał i działa dla człowieka, ale
      **nie działa dla robota**, czyli tam, gdzie miał. `opis` jest przekazywany jako
      prop do `VenueDetailClient.tsx`, a ten do czasu `useEffect` zwraca szkielet
      (`VenueDetailClient.tsx:197`); `page.tsx` nie renderuje ani własnego `<h1>`, ani
      opisu (`boisko/[id]/page.tsx:300-329`). W HTML pierwszej odpowiedzi serwera są
      wyłącznie dwa `<script>` z JSON-LD. Dodatkowo `description` w metadanych obiecuje
      „zarezerwuj termin" (`page.tsx:180`) — funkcję za wyłączoną flagą. Do zamknięcia:
      serwerowy render nagłówka, opisu i nawigacji — [seo-geo-strategia.md](./docs/seo-geo-strategia.md), 3f.
- [x] **Faza 2 — huby miast poza Poznań** (zrobione 2026-08-22). Trasa przeniesiona
      z `/graj/[sport]/[miasto]` na `/[sport]/[miasto]` (301 ze starych adresów),
      miasta wyniesione do `content/miasta.ts` i rozszerzone o Warszawę i Kraków —
      dwanaście stron. **Blokada „warszaw"/„krak[oó]w" ZOSTAJE** wbrew wcześniejszemu
      zapisowi: siedzi w `ZAKAZANE_NA_LANDINGU`, a ta lista jest sprawdzana wyłącznie
      przeciw `components/home/landing/content.ts` — landing ma pozostać ogólnopolski,
      a strony miejskie żyją w `content/miasta.ts` i podlegają `ZAKAZANE_WSZEDZIE`.
      Pokrycie katalogu liczone geograficznie (`lib/api.ts#policzBoiskaWOkolicy`), **nie**
      z `city`/`seo_tier` — te są dziś puste w całej tabeli, patrz Faza 0.
- [x] **Faza 2b — huby wojewódzkie** (kod 2026-08-22, ptaszek cofnięty i **przywrócony 2026-08-23**, gdy link do huba trafił do HTML). `/boiska/woj/[wojewodztwo]`
      — NIE `/boiska/[wojewodztwo]`: Next.js nie pozwala dwóm dynamicznym segmentom na
      tym samym poziomie katalogu mieć różne nazwy, a `[sport]` już zajmuje
      `/boiska/[cokolwiek]`, więc `woj` jest literalnym segmentem pośrednim. Wzorem
      dzisiejszego `force-dynamic` `/boiska/[sport]` (bez prerenderu — te same powody
      skalowania co `/boisko/[id]`, patrz AGENTS.md; mazowieckie samo ma ponad 8 tysięcy
      boisk w pliku PBF). Nazwy w `lib/wojewodztwa.ts#WOJEWODZTWO_LABEL` (mianownik,
      bez odmiany przez przypadki — nagłówek unika fleksji przymiotnika z rozmysłem).
      16 stron dopisanych do `sitemap.ts`; `/boisko/[id]` linkuje do swojego huba
      (widoczny link + okruszek JSON-LD), gdy `city`/`voivodeship` już wypełnione.

      ⚠️ **Sprostowanie (2026-08-23):** zdanie o widocznym linku opisuje intencję, nie
      stan. Link z `/boisko/[id]` do huba leży w `VenueDetailClient.tsx:256`, czyli za
      bramką ładowania z Fazy 1 — w HTML go nie ma. Wszystkie 16 hubów jest dziś
      **osieroconych**: zero linków przychodzących z jakiejkolwiek strony, jedyne wejście
      to `sitemap.ts`. Okruszek w JSON-LD nie jest linkiem do przejścia. Do zamknięcia:
      serwerowa nawigacja na stronie obiektu i linkowanie poziome hubów —
      [seo-geo-strategia.md](./docs/seo-geo-strategia.md), 3f i 4b.
- [x] **Faza 3 — mikro-ankiety UGC** (zrobione 2026-08-22). `AnkietyObiektu.tsx` na
      `/boisko/[id]`, dwa pytania (oświetlenie tak/nie, nawierzchnia — sześć wartości
      jak `SURFACE_MAP`). NOWA tabela `potwierdzenia_obiektu` (migracja `123`), nie
      rozszerzenie `zgloszenia_bledow` (`099`) — inny odbiorca: tamto jest widoczne
      wyłącznie dla admina i trafia do moderacji, to jest publiczny zagregowany głos
      bez moderacji. Jeden głos na fakt na osobę (`UNIQUE`, `.upsert()`), wyświetlenie
      „potwierdzone przez N graczy" dopiero od quorum = 2. Świadomie **nic nie
      nadpisuje** w `fields` — decyzja o override zostaje otwartym punktem, patrz
      „Zgłaszanie błędów: w aplikacji i w danych obiektu" niżej.

## 8. Pomysły jeszcze niezbudowane

### ~~Przejęcie profilu gościa (claim)~~ — ZROBIONE (PR #104, migracja `066`)
Zrealizowane inaczej niż w szkicu niżej: token nadaje wyzwalacz w bazie (nie kod
aplikacji), trasa to `/gracz/przejmij/[token]`, a przejęcie obejmuje JEDEN wiersz,
nie klaster po `added_by + name`. Klaster zostaje jako możliwe rozszerzenie —
dziś człowiek dostaje link per mecz. Szkic oryginalny zostawiony niżej jako zapis
decyzji.

<details><summary>Pierwotny projekt</summary>

Projekt rozpisany w [docs/rewizja-2026-08.md](./docs/rewizja-2026-08.md) (dlaczego)
i w rozmowie 2026-08-04 (jak). Skrót mechaniki:

- `event_participants.claim_token` (unikalny, tylko wiersze gości) +
  `claimed_at`; token generowany przy `addGuest` i backfillem dla istniejących
- publiczna strona podglądu `/przejmij/[token]` — **bez logowania** pokazuje
  dorobek gościa (mecze, gole, kto dopisał) przez RPC `guest_claim_preview(token)`
  (`SECURITY DEFINER`, zwraca agregat, nie wiersze — nie okrąża RLS prywatnych meczów)
- przejęcie: RPC `claim_guest_profile(token)` — ustawia `user_id = auth.uid()`,
  `is_guest = false`, `claimed_at = now()`, nadpisuje `name` nazwą profilu;
  obejmuje CAŁY klaster wierszy `same added_by + lower(name)` (lista pokazana
  do potwierdzenia na stronie podglądu); wiersz w meczu, w którym przejmujący
  już ma własny udział, jest pomijany
- pojemność bez zmian (wiersz już liczony); statystyki zaczynają się liczyć
  same, bo `get_player_stats` filtruje `is_guest = false`, a `player_goals`
  idzie po `participant_id`
- dystrybucja: przycisk „Wyślij mu jego profil" przy wierszu gościa (widzi
  dopisujący i organizator) + baner po meczu „N gości bez konta"; ŻADNEJ
  automatycznej wysyłki — link niesie człowiek, który gościa zna
- miara sukcesu całego produktu: % wierszy gości z `claimed_at` (north star
  z rewizji — konwersja zaproszony → użytkownik)
- anty-nadużycia: token = sekret na okaziciela (model jak `join_code`),
  rate limit na RPC przez `check_rate_limit`; regeneracja tokenu — later

</details>


### PWA + web-push — ZROBIONE (weryfikacja 2026-09-02)

Plan niżej jest ZREALIZOWANY i zostaje wyłącznie jako zapis decyzji — pola do
odhaczenia w nim nie były aktualizowane, więc czytało się to jak zadanie do zrobienia.
Stan faktyczny w repo: `frontend/src/app/manifest.ts`, `frontend/public/sw.js`,
`components/RejestracjaSW.tsx`, `ZachetaInstalacji.tsx`, `PowiadomieniaPush.tsx`,
`lib/push.ts` i `lib/instalacja.ts`; po stronie bazy migracje `102` (tabela
`push_subscriptions`, wyzwalacz `trg_wyslij_push` na `notifications` przez `pg_net`),
`117` i `119`, funkcja brzegowa `supabase/functions/send-push/` oraz ustawienia
„czego nie chcę na telefon" (`109`, `lib/ustawieniaPowiadomien.ts`). `pg_net` i `pg_cron`
są na produkcji włączone (sprawdzone 2026-09-02).

Co z tego wynika dla planowania: **kanał doręczania poza aplikacją ISTNIEJE**, więc
zadania, które czekały „aż będzie push" (przypomnienia o meczu, `SHOW_GAME_ALERTS`,
doręczanie zaproszeń „z ekipy") nie mają już tej blokady. Brakuje wyłącznie ZEGARA —
patrz `O-39` w [audycie ścieżki organizatora](./docs/przeplyw-organizatora.md).

<details><summary>Pierwotny plan (2026-08-15)</summary>


Po co: stała ekipa to te same dziesięć osób w ten sam czwartek. Jedyne, czego brakuje
w ich tygodniu, to **doręczenie poza aplikacją** — dziś zaproszenie „z ekipy" czeka,
aż zaproszony sam otworzy Bojo. Push to jedyny darmowy kanał, który to załatwia,
i przy okazji domyka dziurę SMS-ów (`SHOW_SMS_FEATURES`) bez płacenia za wiadomość.

**Kanał powiadomień JUŻ ISTNIEJE** (§3): tabela `notifications`, `lib/notifications.ts`,
dzwonek, wyzwalacze w migracjach. Push nie jest nowym systemem — to **druga końcówka
doręczania** dla wierszy, które i tak powstają.

#### Etap 1 — instalowalność („apka na ekranie")

- [ ] `app/manifest.ts` (Next 14 App Router generuje `/manifest.webmanifest`):
      `name`, `short_name: "Bojo"`, `start_url: "/"`, `display: "standalone"`,
      `theme_color: "#15663E"` (ten sam co w `layout.tsx`), `background_color`.
- [ ] **Ikony — dziś ich nie ma w `public/`.** Potrzebne: 192×192, 512×512,
      512×512 `maskable` (Android przycina do koła — bez wariantu maskable logo
      dostaje obcięte rogi) oraz `apple-touch-icon` 180×180.
- [ ] `appleWebApp` w `metadata` — **iOS ignoruje ikony z manifestu** i czyta wyłącznie
      `apple-touch-icon`. Bez tego na iPhonie na ekranie głównym ląduje zrzut strony.
- [ ] Minimalny service worker w `public/sw.js` + rejestracja po montażu.

**Świadomie BEZ trybu offline.** SW ma obsłużyć `push` i `notificationclick`, nic więcej.
Service worker cache'ujący HTML potrafi serwować stary build po deployu, a aplikacja
żyjąca z bazy pokazywałaby wtedy nieaktualne składy — gorsze niż brak offline'u.
Z tego samego powodu **nie bierzemy `next-pwa`** (słabo utrzymywany pod App Router)
ani Serwista: do samego pusha żaden z nich nie jest potrzebny.

#### Etap 2 — infrastruktura push

- [ ] Para kluczy **VAPID**. Publiczny → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
      prywatny → sekret Edge Functions (**nie do repo**, patrz `.env` w `.gitignore`).
- [ ] Migracja `092_push_subscriptions.sql`: `user_id`, `endpoint` (UNIQUE),
      `p256dh`, `auth`, `created_at`, `last_seen`. RLS: właściciel widzi i kasuje
      wyłącznie swoje wiersze.
- [ ] Zapis subskrypcji przez `zaktualizujJedenWiersz()` / zwykły insert z `lib/` —
      **nie z komponentu** (granica z AGENTS.md).
- [ ] Edge function `send-push` (Deno + `web-push`), wzorowana na `send-event-sms`.
      Endpoint, który zwróci `410 Gone`, kasujemy z tabeli — inaczej lista subskrypcji
      puchnie o martwe wpisy.

#### Etap 3 — podpięcie i moment proszenia o zgodę

- [ ] Wyzwalacz na `INSERT INTO notifications` → `send-push`. Dzięki temu push dziedziczy
      wszystkie istniejące powody powiadomień, bez dublowania logiki.
- [ ] **Kiedy prosić o zgodę.** Nie przy wejściu. Przeglądarka daje jedno pytanie —
      po odmowie nie da się zapytać ponownie bez grzebania w ustawieniach. Prosimy
      w chwili, gdy powód jest oczywisty: **tuż po dołączeniu do meczu** albo po
      utworzeniu ekipy. Musi to być reakcja na kliknięcie — bez gestu użytkownika
      przeglądarka odrzuci prośbę.
- [ ] Zachęta do instalacji: własny przycisk na `beforeinstallprompt` (Android/Chrome)
      oraz instrukcja „Udostępnij → Do ekranu początkowego" dla iOS, gdzie tego
      zdarzenia nie ma.

#### Czego to NIE załatwi

**iOS dostaje web-push dopiero od 16.4 i wyłącznie dla PWA dodanej do ekranu
głównego.** Użytkownik iPhone'a w Safari nie dostanie powiadomienia, dopóki nie
zainstaluje — i o tym trzeba mówić wprost w interfejsie, zamiast obiecywać push
wszystkim. To jest też powód, dla którego etap 1 musi być zrobiony porządnie, a nie
„jakoś": na iOS instalacja jest warunkiem kanału, nie ozdobnikiem.

#### Weryfikacja

`e2e/wizualne.spec.ts` sprawdzi, że manifest się serwuje i SW rejestruje; samego
doręczenia pusha Playwright nie pokaże — to test ręczny na dwóch telefonach
(Android + iPhone po instalacji).

</details>

---

### Zamykanie zapisów po komplecie (decyzja produktowa do wdrożenia)
Dziś: gdy ktoś się wypisze, miejsce natychmiast wraca do puli i zajmuje je **pierwsza
osoba, która kliknie „Dołącz"** — również ktoś z zewnątrz, z pominięciem listy rezerwowej.

Docelowo: **komplet = koniec zapisów.** Po zwolnieniu miejsca zapisy zostają zamknięte,
a organizator decyduje — pyta rezerwowych albo klika **„Otwórz zapisy"**. Spójne
z istniejącą decyzją o **braku auto-awansu z rezerwy** (patrz `docs/domena.md`): to gracz
musi wiedzieć, że wchodzi do gry, a nie wskoczyć tam po cichu.

Zakres: flaga na `events` (np. `signups_open`), zamknięcie przy osiągnięciu kompletu,
przycisk dla organizatora, komunikat dla wchodzących („zapisy zamknięte — zapytaj
organizatora"), przemyślenie interakcji z listą rezerwową.

**Styka się z „Otwórz dla okolicy" (migracja `097`, `docs/domena.md § Czy gramy`)** —
oba dotyczą tego, co dzieje się z wolnym miejscem w meczu ekipy. Otwarcie dla okolicy
zamienia PRYWATNY mecz z brakiem ludzi w PUBLICZNY, żeby dosięgnąć kogoś spoza ekipy;
to zadanie dotyczy tego, kto dostaje pierwszeństwo do zwolnionego miejsca WEWNĄTRZ
already-otwartego zapisu. Niezależne mechanizmy, ale przy projektowaniu warto sprawdzić,
czy „Otwórz dla okolicy" na skompletowanym meczu (mało sensowne — nie ma wolnych miejsc)
powinno być wyłączone tak samo, jak to zadanie chce wyłączyć zapisy po komplecie.

**Priorytet #1 z rundy „Czy gramy?" (2026-08-15): Web-push (PWA).** Jedyny element,
który jednocześnie odblokowuje: powiadomienia o meczu ekipy poza aplikacją (dziś panel
„Kto milczy" i tak kończy na obejściu — kopiowaniu gotowego tekstu na WhatsAppa, bo
kanału w samym Bojo nie ma), realne działanie „Zaproś z ekipy" (patrz niżej), `SHOW_GAME_ALERTS`
(powód ukrycia już nieaktualny) i większość zastosowań SMS-a. Dopiero z nim zdanie
„grupa zastępuje WhatsAppa" (`docs/wizja.md`) przestaje być obietnicą bez pokrycia.
Rozpisany plan: [§8 „PWA + web-push"](#pwa--web-push--plan-priorytet-od-2026-08-15).

- **Onboarding / pierwsza gra** — co widzi świeży user bez gier w okolicy
- **Rankingi publiczne** i **odznaki** (strzelec miesiąca, 100h na boisku) — wizja §B
- **Ocena umiejętności i dopasowywanie gier do poziomu** — wizja §B
- **MVP meczu** — wizja wymienia obok goli i asyst, w kodzie nie istnieje
- **Realny przepływ pieniędzy** (BLIK/Stripe) — dziś tylko rejestrowanie, kto zapłacił
- **Wynajem sędziego** — wizja §A
- **Wyszukiwarka** boisk po nazwie/dzielnicy na mapie
- **Statystyki sezonowe** dla stałych ekip
- **Agent kontaktowy** — automat wysyłający maile do obiektów i podpowiadający następny
  ruch w CRM

### Zaproszenia „z ekipy" nie mają doręczenia poza aplikacją
Organizator klika „Zaproś z ekipy" na stronie meczu (`lib/playerInvites.ts`) i wygląda
to na wysłane zaproszenie — w rzeczywistości to tylko wiersz w `event_player_invites`,
widoczny zaproszonemu dopiero, gdy sam otworzy Bojo. Zero SMS-a, e-maila czy pusha.
Dziś obchodzone przez to, że organizator i tak rozsyła link ręcznie (`navigator.share`),
ale to znaczy, że „Zaproś z ekipy" nie skraca nic ponad to, co już robi „Udostępnij".
Realny fix to ten sam kanał, którego brakuje SMS-om i alertom gry (`SHOW_SMS_FEATURES`,
`SHOW_GAME_ALERTS`) — patrz pozycja „Web-push (PWA)" wyżej.

Osobno, już naprawione: sam przycisk **dublował się na stronie meczu** (`O-20`
w [audycie ścieżki organizatora](./docs/przeplyw-organizatora.md)) — dwa wejścia, różne
ikony, różne warunki widoczności. Zostaje jeden, przy liczniku wolnych miejsc. Ślepy
zaułek dialogu przy braku jakiejkolwiek grupy (tekst „załóż grupę" bez linku) też
naprawiony wcześniej.

### Rewizja `SHOW_RECURRING` pod kątem strategii „organizator"
Mecze cykliczne (`lib/recurring.ts`, `app/cykliczne/*`) są w pełni zbudowane: szablon
tygodniowy, imienna lista zaproszeń, statystyki niezawodności gracza
(`getGroupPlayerStats`), wysyłka przez edge function `send-invites`. Ukryte celowo
(„focus na jednorazowe mecze", `lib/features.ts:24-29`), ale to funkcja, która wprost
redukuje cotygodniową pracę organizatora — najbliższą kategorię wartości do strategii
„organizator, nie targowisko" z rewizji 2026-08. Przed odkryciem: zweryfikować, czy
`send-invites` faktycznie doręcza (nieznany status wdrożenia), potem świadoma decyzja
o priorytecie, nie cichy flip flagi.

### `docs/wizja.md` sekcja 1 nie odzwierciedla zwrotu na organizatora
Sekcja 1 (dokument nadrzędny, werbatim) opisuje dwustronny rynek — „organizowanie i
dołączanie" na równi, plus propozycja wartości czysto graczowa („Znajdź grę w 2 minuty").
Landing i dashboard już zrobiły zwrot na organizatora (`docs/llm-context.md`, wpis
2026-08-04 „Landing i dashboard: zwrot na organizatora"), więc kod wyprzedził dokument
źródłowy. Sekcji 1 nie wolno parafrazować przy okazji innych zmian — to wymaga świadomej
rewizji przez właściciela produktu, nie automatycznej edycji.


### Zgłaszanie błędów: w aplikacji i w danych obiektu
Dwa różne zgłoszenia, celowo rozdzielone — mają inny odbiorcę i inny cykl życia.

**Błąd w aplikacji.** Coś nie działa, coś się rozjeżdża. Odbiorcą jesteśmy my.
Minimalna wersja: formularz z opisem + automatycznie doklejony adres strony,
przeglądarka i id użytkownika. Bez tego zgłoszenia są nie do odtworzenia.

**Błąd w danych obiektu.** „Tu już nie ma bramek", „nawierzchnia jest sztuczna,
nie trawa", „ten obiekt w ogóle nie istnieje". To jest cenniejsze i trudniejsze,
bo dotyczy danych, których **nie jesteśmy właścicielem** — pochodzą z OSM na
licencji ODbL. Do przemyślenia przy projektowaniu:

- czy poprawka nadpisuje wartość z OSM w naszej bazie, czy tylko ją przykrywa
  (kolumna `override_*` obok oryginału) — druga opcja pozwala ponownie
  zaimportować region bez kasowania pracy użytkowników;
- czy i jak oddajemy poprawki do OSM. Zgłoszenie „nawierzchnia jest inna" jest
  wartościowe dla całego OSM, a odsyłanie ich z powrotem to najtańszy sposób,
  żeby katalog poprawiał się sam. Najprostsza forma: przycisk otwierający
  gotową notatkę w OSM (`https://www.openstreetmap.org/note/new`);
- ile zgłoszeń wystarczy, żeby zmienić dane bez naszej moderacji. Przy jednym
  zgłoszeniu ktoś złośliwy psuje katalog; przy trzech niezależnych — raczej nie;
- „obiekt nie istnieje" to osobny przypadek: nie poprawka pola, tylko wniosek
  o zdjęcie z mapy. Powinien wymagać naszej decyzji.

Wartość: to jedyny mechanizm, który sprawia, że katalog **poprawia się sam**
w miarę używania, zamiast starzeć się między importami.

### Zgodność z licencją ODbL — dopiąć
Dane z OpenStreetMap są na licencji ODbL. Wymaga ona uznania autorstwa
i udostępnienia bazy pochodnej na tych samych warunkach. Co mamy, a czego nie:

- **jest**: atrybucja na mapie (`components/map/MapAttribution.tsx`, standardowa
  stopka Leafleta);
- **brakuje**: atrybucji na stronie obiektu, gdzie pokazujemy dane z OSM poza
  mapą — nazwę, nawierzchnię, wymiary, udogodnienia. Tam też należy się „Dane
  © autorzy OpenStreetMap";
- **do decyzji**: w jakiej formie udostępniamy bazę pochodną. Najprostsza droga
  to publiczny zrzut kolumn pochodzących z OSM (`source = 'osm'`) pod stałym
  adresem, z informacją o licencji. Nie dotyczy meczów, komentarzy ani kont —
  te są nasze i nie są bazą pochodną;
- **osobne ryzyko**: zdjęcia z Google Places zebrane dla Poznania. Ich warunki
  są znacznie bardziej restrykcyjne niż ODbL i **nie pozwalają na dowolne
  przechowywanie i serwowanie**. Do sprawdzenia przed pokazaniem ich gdziekolwiek
  poza kontekstem, w którym je pobrano.


### Odpowiadanie na zaproszenie z listy — do zaprojektowania
Dziś karta zaproszenia na stronie głównej i w Moich grach jest **samą kartą**,
bez żadnej akcji. Odpowiada się wchodząc na stronę meczu.

Problem jest prawdziwy i wart rozwiązania: **„tak" kosztuje więcej kliknięć niż
„nie"** — a raczej kosztowałoby, bo dziś nie ma nawet jak odmówić z listy.
Przy funkcji, której sensem jest ściągnięcie ludzi na mecz, to odwrócone
proporcje.

Próbowaliśmy dwóch układów, oba odrzucone jako zbyt ciężkie wizualnie:

1. **Obwódka + nagłówek „ZAPROSZENIE"** nad kartą — przy trzech zaproszeniach
   pod rząd lista robiła się ścianą ramek.
2. **Para przycisków „Dołączam" / „Odrzuć"** pod kartą — dokładała dwa duże
   elementy na każdą pozycję listy.

Kierunki do rozważenia przy następnym podejściu:
- akcja ukryta do gestu (przesunięcie karty w bok), zamiast stale widocznych
  przycisków;
- jedna ikona w rogu karty zamiast dwóch przycisków — ale prawy górny róg jest
  zajęty przez cenę;
- odpowiedź nie na liście, tylko w powiadomieniu pod dzwonkiem, gdzie karta
  jest mniejsza i akcja nie konkuruje z resztą treści;
- rozróżnienie wizualne kartą samą w sobie (inny odcień tła), bez dokładania
  elementów.

Kod odpowiedzi (`joinEvent` z listy, `dismissInvite`) jest napisany i działał —
patrz PR #107. Wróci, gdy będzie wiadomo, jak ma wyglądać.
