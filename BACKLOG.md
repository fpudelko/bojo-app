# BOJO — backlog

Co jest **zbudowane, ale schowane**, gdzie **kod nie nadążył za wizją** oraz pomysły
jeszcze niezrobione.

- Kierunek produktu: [docs/wizja.md](./docs/wizja.md) — **dokument nadrzędny**
- Stan implementacji: [docs/funkcje.md](./docs/funkcje.md)
- Roadmapa fazowa: [docs/strategia.md](./docs/strategia.md#6-roadmapa-fazowa)

_Ostatnia aktualizacja: 2026-08-03_

---

## 1. Luki wobec wizji

Pozycje, w których dokument strategiczny obiecuje coś, czego kod nie robi. **Dokument
jest nadrzędny** — to są zadania, nie błędy w dokumencie.

### 1.1 Trzeci poziom widoczności meczu — „widoczne dla grupy"
Wizja wymienia trzy poziomy: prywatny / widoczny dla grupy / publiczny.
Kod ma dwa: `events.visibility` to CHECK `('private','public')` (`002_events_and_auth.sql`).

Kolumna `group_id` (`051_group_field.sql`) steruje **listowaniem** meczu w grupie, nie
**dostępem** do niego — mecz przypisany do grupy jest nadal albo publiczny, albo dostępny
tylko przez kod.

Zakres: migracja rozszerzająca CHECK + polityka RLS + opcja w kreatorze meczu i edycji.

### 1.2 Powiadomienie dla członków grupy o utworzeniu gry
Wizja stawia to jako część propozycji „Grupy — zastąpienie facebook/whatsapp". Bez
powiadomienia grupa nie zastępuje czatu, bo nikt nie wie, że gra powstała.

Kanał powiadomień **istnieje** (patrz §3) — brakuje wyzwalacza przy `createEvent`
z `group_id`. Jedyna dzisiejsza ścieżka to `game_alerts` (promień + sport), oparta
o lokalizację, nie o członkostwo, i dodatkowo ukryta flagą `SHOW_GAME_ALERTS`.

### 1.3 Gry cykliczne ukryte flagą
Wizja wymienia je w pierwszej propozycji wartości, na równi z grami pojedynczymi.
Kod jest kompletny (`lib/recurring.ts`, trasy `/cykliczne/*`, migracja `007`), ale
`SHOW_RECURRING = false` ukrywa wejścia w `Header.tsx`, `app/page.tsx`, `app/moje-gry`.

Decyzja do podjęcia: odmrozić czy zapisać uzasadnienie ukrycia.

### 1.4 Rozliczenie po meczu
Propozycja brzmi „Rozliczysz ekipę w minutę", a panel „Podział kosztów" renderuje się
pod warunkiem `isOwner && !eventStarted` (`EventDetailClient.tsx`). Czyli:
- po zakończeniu meczu panel znika — a wtedy właśnie się rozlicza,
- uczestnik nigdy nie widzi, ile ma zapłacić; widzi to tylko organizator.

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

Czego brakuje: **web-push (PWA)** oraz wyzwalaczy dla zdarzeń innych niż alerty
(dołączenie do meczu, awans z rezerwy, nowa gra w grupie — §1.2).

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

### 5.0 Katalog boisk — naprawa danych, potem cała Polska ⚠️ NASTĘPNY TEMAT

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

- [ ] **Zweryfikować stan migracji na produkcji.** W repo jest 57 migracji; stanu bazy
      nie da się odczytać z repo. Patrz [docs/baza-danych.md](./docs/baza-danych.md).
- [ ] **Adresy kontaktowe wciąż na `bojo.app`** — `kontakt@bojo.app` w `/regulamin`,
      `/prywatnosc`, `/turniej` oraz nadawca `noreply@bojo.app` w edge functions, przy
      domenie kanonicznej `bojo.pl`. Wymaga potwierdzenia, że skrzynki na `bojo.pl`
      istnieją, oraz weryfikacji domeny w Resend (SPF + DKIM).
- [ ] **Czyszczenie bazy boisk** — odsianie siłowni, kortów tylko-tenisowych, kartingów.
      Dziś filtr `RELEVANT_SPORTS` jest **po stronie klienta** (`VenueExplorer`).
      Docelowo: `map_visibility = 'hidden'` w bazie + panel admina do przeglądu.
- [ ] **Zod — walidacja danych z bazy** (mappery `toEvent`, `toField`).
- [ ] **Domknąć reguły dostępu w RLS** — część sprawdzana dziś po stronie przeglądarki.
- [ ] **Build w CI** — po dodaniu sekretów `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` do
      repo dołożyć `npm run build` do `.github/workflows/ci.yml` (dziś build wymaga
      kluczy i dlatego jest poza CI).
- [ ] **Sesja w cookie zamiast localStorage** (`@supabase/ssr` + `middleware.ts`) —
      dziś serwer nie wie, kto ogląda `/`, więc rozróżnienie landing/dashboard dzieje
      się po stronie klienta (`HomeSwitch.tsx`). Skutek: zalogowany użytkownik widzi
      na moment landing zamiast dashboardu, zanim `useAuth()` odczyta sesję. Sesja
      w cookie usunęłaby to mignięcie i otworzyłaby drogę do prawdziwego SSR redirectu.

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
- [ ] **Strona `/o-nas`** (E-E-A-T) — kim jesteśmy, dlaczego budujemy Bojo, kontakt.
      Sygnał wiarygodności ważony przez Google i silniki generatywne.
- [x] **Dane własne jako treść** (GEO: statystyki podnoszą cytowalność ~40%) — sekcja
      `LandingStats` na stronie głównej liczy boiska w bazie przy renderze
      (`lib/landingStats.ts`, `getPublicVenueCount()`), zaokrąglone w dół do pełnych 50,
      żeby liczba nigdy nie zawyżała stanu faktycznego.
- [ ] **Obecność zewnętrzna / backlinki** — profile w katalogach, grupy FB, prasa
      lokalna, współprace z obiektami. Najsilniejszy sygnał klasycznego SEO; buduje
      się miesiącami, poza repo.
- [ ] **Core Web Vitals** — zmierzyć po wdrożeniu (PageSpeed Insights) i dopiero na
      podstawie pomiaru decydować o optymalizacjach.

## 8. Pomysły jeszcze niezbudowane

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

### Propozycje składów przez graczy
Każdy uczestnik może zaproponować podział na drużyny, reszta lajkuje/głosuje;
organizator zatwierdza wybrany. Odciąża organizatora i angażuje ekipę.
Dziś składy ustala wyłącznie organizator (`TeamsPanel`, tryby ręczny/kapitanowie/losowy).

- **Web-push (PWA)** — darmowy kanał przypomnień, zastępuje większość SMS-ów
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
