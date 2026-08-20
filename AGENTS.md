# Bojo — zasady pracy w repo

Kontekst projektu i pułapki, które warto znać przed pierwszą zmianą.

- Baza wiedzy: [docs/README.md](./docs/README.md) — wizja, funkcje, domena, baza danych
- Opis funkcji dla ludzi: [PRZEWODNIK.md](./PRZEWODNIK.md)
- Stack i architektura w skrócie: [README.md](./README.md)

## Szybki start

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Wymaga `.env` w katalogu głównym (skopiuj z `.env.example`) z kluczami Supabase.

## Weryfikacja zmian — uruchamiaj przed każdym commitem

```bash
cd frontend
npx tsc --noEmit       # typecheck — musi być czysto
npm run lint           # ESLint — błędy blokują CI, ostrzeżenia nie
npm test               # Vitest, 463 testy
npm run build          # build produkcyjny (potrzebuje tylko atrap kluczy, patrz niżej)
```

**`npm run lint` DZIAŁA** — konfiguracja jest w `frontend/.eslintrc.js`. Wcześniej stało
tu, że wymaga interaktywnej konfiguracji; brakowało wyłącznie tego pliku i wtyczki
`@typescript-eslint`. Pierwsze uruchomienie znalazło 39 miejsc z martwym kodem.

**Build da się uruchomić bez prawdziwych kluczy Supabase** — wystarczą atrapy:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
```

To ważne, bo `useSearchParams()` na trasie prerenderowanej wywraca **wyłącznie** build
produkcyjny — `tsc` i Vitest tego nie widzą.

**Baza testowa lokalnie** — migracje od zera na gołym Postgresie:

```bash
./scripts/baza-testowa.sh          # postaw, zwaliduj, posprzątaj
./scripts/baza-testowa.sh --zostaw # zostaw działającą bazę na porcie 55432
```

Sprawdza to, czego nie widać na działającej bazie: czy migracje aplikują się
**od zera**. Pierwsze uruchomienie znalazło `005`, która tworzyła politykę
istniejącą już od `001` — na świeżej bazie odtworzenie schematu było niemożliwe.
Atrapy Supabase (schemat `auth`, `storage`, pgcrypto) siedzą w `supabase/test/shim.sql`.

**Ikony PWA** generuje `frontend/scripts/generuj-ikony.mjs` z logo w
`components/Logo.tsx` (rasteryzuje Chromium z Playwrighta, bez dodatkowych paczek):

```bash
cd frontend && node scripts/generuj-ikony.mjs
```

Po podmianie logo uruchom ponownie i zacommituj wynik. `ikonyPwa.test.ts` pilnuje,
żeby ścieżka litery w skrypcie nie rozjechała się z logo — bez tego podmiana logo
zostawiłaby starą ikonę na ekranie telefonu i nikt by tego nie zauważył, bo ikonę
widzi się raz, przy instalacji.

**Regresja wizualna (zrzuty ekranu):**

```bash
cd frontend && npm run build
npm run zrzuty          # porównaj ze wzorcami
npm run zrzuty:akceptuj # nadpisz wzorce świadomie
```

Wzorce leżą w `frontend/e2e/wzorce/` i idą do repo, więc zmiana widoku pokazuje
się w PR-ze jako różnica obrazków. Workflow `wizualne.yml` **celowo nie blokuje**
merge'a ani deployu — zmiana wyglądu bywa zamierzona i ma być do przejrzenia,
nie do naprawienia.

Co więcej, **te zadania nigdy nie świecą na czerwono**. Samo `continue-on-error`
nie wystarcza: workflow kończy się wtedy zielono, ale przy PR-ze i tak widać
czerwony znaczek przy zadaniu — a to czyta się jak zepsuty build. Dlatego testy
lecą z `set +e`, a wynik jedzie do komentarza jako informacja. To jest pomoc dla
chętnych, nie bramka.

**Raport na PR — jedna strona do obejrzenia, działa na telefonie:**

`.github/podglad-zrzutow.sh` wystawia raport na technicznej gałęzi
`podglad-zrzutow`, pod adresem `…/tree/podglad-zrzutow/pr-<numer>/<zestaw>`.
GitHub renderuje `README.md` katalogu jako stronę, więc wchodzisz w odnośnik
z komentarza i przewijasz obrazki. Nic nie trzeba pobierać ani odpisywać.
Raporty **kasują się same po 7 dniach** — gałąź nie ma rosnąć w nieskończoność.
Artefakt z raportem HTML zostaje jako droga zapasowa.

Zmieniony widok pokazuje się **jako wycinek samego zmienionego miejsca**
(`frontend/e2e/wytnij-zmiane.js` liczy prostokąt obejmujący podświetlone piksele
i tnie po nim oba zrzuty), a pod nim całe strony **bok w bok**. Nakładka „diff"
od Playwrighta ląduje w zwijanej sekcji: przy zmianie tekstu rysuje obie wersje
jedna na drugiej i jest nie do odczytania.

Wzorce wchodzą do repo dopiero po nadaniu etykiety `zrzuty:zaakceptuj`
(w aplikacji GitHuba: **ⓘ** w prawym dolnym rogu PR-a → *Labels*). Dotyczy to
**tak samo widoków nowych, jak zmienionych** (`.github/dopisz-wzorce.sh`) —
pierwszy zrzut widoku jest właśnie tym, który warto obejrzeć, bo to on staje
się wzorcem na zawsze.

`e2e/wizualne.spec.ts` chodzi **bez bazy** — na atrapach kluczy, w tym samym
przebiegu co build. Komunikaty, które normalnie przychodzą z serwera (złe hasło,
e-mail zajęty, limit prób, rejestracja wyłączona), podstawia `page.route()`:
przechwytuje odpowiedź GoTrue i oddaje tę, którą chcemy zobaczyć. Ścieżka kodu
w aplikacji jest prawdziwa, atrapa siedzi wyłącznie w sieci. Tak samo powstaje
widok „Google zablokowane w tej przeglądarce" — przez podstawiony `User-Agent`
Facebooka, bo w zwykłej przeglądarce nie da się go zobaczyć.

Na końcu `wizualne.spec.ts` siedzi **przemiał po wszystkich trasach** — lista
`TRASY` z każdym adresem, który da się otworzyć bez bazy. Pojedyncze scenariusze
pilnują miejsc, o których ktoś pomyślał; ta lista pilnuje całej aplikacji, więc
zmiana w nagłówku, stopce czy odstępach pokazuje się wszędzie tam, gdzie realnie
ją widać. **Dodajesz trasę w `src/app` → dopisz ją do `TRASY`.**

Dwie pułapki przy pisaniu nowych zrzutów:

- `/wydarzenia` renderuje listę **dwa razy** (gałąź `hidden md:block` i `md:hidden`),
  więc `.first()` trafia na kopię ukrytą przez CSS — filtruj `filter({ visible: true })`.
- Atrapa PostgREST musi kłamać tak jak serwer: zapytanie z `.single()` wysyła
  `Accept: …pgrst.object+json` i przy zerze wierszy dostaje **406 PGRST116**.
  Pusta tablica w tej sytuacji jest gorsza niż nic — supabase-js bierze ją za
  wiersz i strona meczu rysuje nagłówek „undefined" oraz „Zostało NaN miejsc".

**Scenariusze za logowaniem (pełny stos Supabase, wymaga Dockera):**

```bash
./scripts/stos-lokalny.sh    # Postgres + GoTrue + PostgREST, migracje, dane
cd frontend && npm run build && npm run scenariusze
```

Przechodzą przejścia realnego gracza na realnej bazie: dołączenie, rezerwa,
dwa tryby miejsc dla bramkarzy, prośby o akceptację, płatności, obserwowanie,
okno na telefonie. Dane z `supabase/seed_wizualne.sql` mają **daty na sztywno**,
a zegar przeglądarki jest zamrożony (`page.clock`) — inaczej etykiety „Dzisiaj"
i „za 2 dni" zmieniałyby zrzuty każdego dnia.

**Testy klikalności (Playwright):**

```bash
cd frontend && npm run build && npm run e2e
```

W tym środowisku przeglądarka jest już w obrazie, więc:
`PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e`.
Sprawdzają jedno: **czy da się kliknąć**. Modal przykryty paskiem nawigacji nie jest
widoczny dla żadnego innego narzędzia w repo — Playwright zgłasza go wprost.

## Architektura w skrócie

- **Brak własnego backendu.** Frontend (Next.js 14 App Router) rozmawia z Supabase
  bezpośrednio, dostęp pilnowany przez RLS.
- Logika domenowa siedzi w `frontend/src/lib/` (`events.ts`, `groups.ts`, `api.ts`,
  `payments.ts`…). Komponenty tego nie omijają.
- Wyjątek: `frontend/src/app/api/geocode/` — serwerowy proxy do Nominatim (przeglądarka
  nie może ustawić `User-Agent`).
- Interfejs jest **po polsku**. Komentarze w kodzie po angielsku.

Uzasadnienia i granice → [docs/domena.md](./docs/domena.md#granice-architektury).

## Strefy podwyższonego ryzyka

Zmiany w tych miejscach wymagają testu i zielonego CI (uruchamia `tsc`, Vitest
i `npm run check:docs` przy każdym PR i push na master):

- **Auth i RLS** — `lib/auth.tsx`, polityki w migracjach. Pamiętaj: niepasująca polityka
  nie rzuca błędu, tylko po cichu aktualizuje 0 wierszy.
- **Płatności** — cenę zawsze liczy `priceForParticipant()` (`lib/payments.ts`).
- **Migracje** — uruchamiane ręcznie na produkcji; błąd w SQL trafia do bazy na żywo.
- **Kasowanie danych** — `deleteEvent`, `deleteGroup`, usuwanie konta.

## Zanim uznasz, że funkcja nie istnieje — sprawdź flagi

Najczęstsze nieporozumienie w tym repo: funkcja jest zbudowana, ale schowana.
`SHOW_CUP`, `SHOW_GAME_ALERTS`, `SHOW_SMS_FEATURES` (`frontend/src/lib/features.ts`)
oraz `FEATURE_RESERVATIONS` (`frontend/src/config/features.ts`) są dziś wyłączone.
`SHOW_RECURRING` jest **wyłączona** od 2026-08-16 (produktowa decyzja o rezygnacji
z gier cyklicznych/stałych gierek) — chowa wejścia w nawigacji i przełącznik
„Wydarzenie cykliczne" w kreatorze; istniejące serie i ich strony zarządzania
zostają w kodzie nietknięte.

Flagi ukrywają **wejścia w nawigacji**, nie trasy. Pełna tabela z miejscami użycia →
[docs/funkcje.md](./docs/funkcje.md#flagi-funkcji).

## Pułapki, które już nas ugryzły

**Migracje SQL uruchamia się RĘCZNIE.** Pliki w `supabase/migrations/` (numerowane)
trzeba wkleić do Supabase → SQL Editor. Nic nie robi tego automatycznie. Dodanie kolumny
w migracji ≠ kolumna istnieje w bazie — jeśli apka rzuca błędem o nieznanej kolumnie,
najpewniej migracja nie została puszczona.

**Do UPDATE-ów używaj `zaktualizujJedenWiersz()`, do dużych list `pobierzWszystkie()`**
(`frontend/src/lib/zapytania.ts`). Oba istnieją po to, żeby cisza opisana w dwóch
pułapkach niżej zamieniła się w wyjątek. Nowy kod, który omija te helpery, odtwarza
dokładnie te same błędy.

**RLS po cichu unieważnia UPDATE.** Gdy polityka RLS nie pasuje, Postgres nie zgłasza
błędu — po prostu aktualizuje 0 wierszy i zwraca sukces. Objaw: „przycisk nic nie robi".
Realny przypadek: brakowało polityki pozwalającej użytkownikowi zmienić własny wpis
w `event_participants` (naprawione w `053`). Jeśli zapis „nie działa" bez błędu — najpierw
sprawdź polityki, nie kod.

**Nie prerenderuj niczego per obiekt z katalogu boisk.** `/boisko/[id]` miało
`generateStaticParams()` zwracające slug każdego boiska — build generował tyle stron,
ile wierszy w `fields`. Do tego `resolveField()` po slugu robiło `select('*')` na całej
tabeli, raz na `generateMetadata` i raz na komponent. Koszt rósł kwadratowo: przy
poznańskim katalogu (~1500) build się jeszcze mieścił, po imporcie z OSM (~4600)
ciągnął się **ponad 40 minut** i nie kończył. Dziś trasa renderuje się na żądanie
(`generateStaticParams` zwraca `[]`, `revalidate = 86400`), a slug→id rozwiązuje
wspólny indeks z TTL. Katalog docelowo ma dziesiątki tysięcy obiektów — cokolwiek
liniowego względem niego przy buildzie jest z góry spalone.

**`useSearchParams()` wywala build produkcyjny na trasach prerenderowanych.**
`useSearchParams()` w komponencie klienckim wymusza na trasie prerenderowanej
bail-out do CSR i build kończy się błędem `missing-suspense-with-csr-bailout`.
**Lokalnie się nie powtórzy** — bez prawdziwych kluczy Supabase `generateStaticParams()`
zwraca pustą listę, więc strony w ogóle nie powstają i błąd nie ma jak wyjść. Wychodzi
dopiero na Vercelu. Zamiast hooka czytaj `window.location.search` w `useEffect` po
montażu (patrz `backHref` w `boisko/[id]/VenueDetailClient.tsx`) albo opakuj
w `<Suspense>`. Samo `/boisko/[id]` nie jest już prerenderowane (patrz wyżej), ale
`/boiska/[sport]` nadal jest.

**`truncate` w kontenerze flex wymaga `min-w-0`.** Bez tego element odmawia się skurczyć
poniżej szerokości treści i rozpycha całą kartę w bok, zamiast obciąć tekst.

**Nie ma auto-awansu z listy rezerwowej.** To świadoma decyzja produktowa, nie brak: gdy
ktoś się wypisze, rezerwowy nie wskakuje automatycznie — ktoś musi go powiadomić.
Nie „naprawiaj" tego.

**`/gracze` to `redirect('/wydarzenia')`** — nie ma listy graczy, mimo że trasa istnieje.

**Martwy kod:** `components/map/MapView.tsx`, `LeafletMapImpl.tsx`, `EventsMapView.tsx`,
`EventsMapImpl.tsx` — nic ich nie importuje. Aktywna mapa to `VenueExplorer.tsx`
(strona `/mapa`) i pickery lokalizacji.

## Modele domenowe

Przed zmianą w `lib/events.ts`, `lib/payments.ts` lub logice zapisów przeczytaj
[docs/domena.md](./docs/domena.md) — dwie osie relacji do meczu, reguły pojemności,
semantyka zniżki `null`, pułapka nazw `grosz`/`grosze`. To ~5 minut, które oszczędza
błędną „naprawę" świadomej decyzji produktowej.

## Aktualizacja dokumentacji

Zmiana kodu pociąga za sobą aktualizację dokumentu:

| Zmieniasz | Zaktualizuj |
|---|---|
| `lib/features.ts`, `config/features.ts` | [docs/funkcje.md](./docs/funkcje.md#flagi-funkcji) |
| `frontend/src/lib/*` | [docs/domena.md](./docs/domena.md), [docs/funkcje.md](./docs/funkcje.md) |
| `frontend/src/app/*` (nowa/usunięta trasa) | [docs/funkcje.md](./docs/funkcje.md), `frontend/public/llms.txt` |
| `supabase/migrations/*` | [docs/baza-danych.md](./docs/baza-danych.md) |
| cokolwiek zmienia zachowanie widoczne dla użytkownika | [docs/llm-context.md](./docs/llm-context.md) — patrz „RAG INJECTION" niżej |

Po zmianach uruchom **`npm run check:docs`** (z katalogu głównego) — walidator mówi
deterministycznie, czy dokumentacja rozjechała się z kodem (trasy w `llms.txt`, flagi,
linki, migracje). CI odrzuci PR, w którym walidator jest czerwony.

Hook `.claude/hooks/doc-guard.sh` przypomina o tym w trakcie pracy. **Nie blokuje** —
to przypomnienie, nie bramka.

## RAG INJECTION — obowiązkowe przy zmianie widocznej dla użytkownika

[docs/llm-context.md](./docs/llm-context.md) to jedyny plik pisany dla modelu, który
czyta **na zimno**, bez dostępu do repo (zewnętrzny asystent odpowiadający na pytanie
o bojo.pl, baza wiedzy w narzędziu). Zmiana zachowania widocznego dla użytkownika
aktualizuje ten plik, po czym **`npm run sync:llm-context`** odświeża kopię publiczną
serwowaną pod `bojo.pl/llm-context.md`. CI odrzuca PR, w którym kopia się rozjechała.

Wpis w sekcji „Ostatnie zmiany" ma format:

```
PROBLEM:          jaki ból użytkownika to rozwiązuje
ROZWIĄZANIE BOJO: co zostało zbudowane
MECHANIKA:        komponenty, funkcje w lib/, tabele, migracje
```

Sekcja opisująca funkcję dokłada do tego **PYTANIA** — 3–5 pytań w naturalnym języku,
na które ta sekcja odpowiada.

Zasady, których nie łamiemy:

- **Gęsty, faktograficzny Markdown. Zero języka marketingowego.** Piszesz instrukcję
  dla modelu, nie opis dla klienta.
- **Każda sekcja broni się sama** — nazywaj encje wprost („Bojo", nie „aplikacja",
  nie „to"). W RAG sekcja trafia do modelu wyrwana z kontekstu pliku.
- **Nie dopisuj list słów kluczowych.** Badania GEO (Aggarwal i in., KDD 2024) pokazują,
  że keyword stuffing wypada najsłabiej ze wszystkich testowanych metod i obniża ocenę
  gęstości informacyjnej. Zamiast słów kluczowych — pytania w naturalnym języku.
- **Nie kopiuj treści z `docs/`.** Tabela flag, mapa tabela → migracja i ścieżki plików
  żyją w `docs/`; `llm-context.md` odsyła do nich linkiem. Dwie kopie = gwarantowany
  rozjazd.
- **Log „Ostatnie zmiany" ma limit 10 wpisów** (pilnuje go walidator). Najstarsze
  usuwasz — pełną historią jest `git log`, a rosnący log rozmywa cały plik.
- Znacznik `**Stan na:**` w nagłówku aktualizujesz razem z migracjami.

`llms.txt` to indeks, nie changelog — **nie dopisuj tam logu zmian.**

**[docs/wizja.md](./docs/wizja.md) jest dokumentem nadrzędnym.** Sekcja 1 to dokument
strategiczny wklejony werbatim — nie parafrazować i nie „poprawiać" przy okazji innych
zmian. Gdy kod nie zgadza się z wizją, to kod nie nadążył: rozbieżność trafia do
[BACKLOG.md](./BACKLOG.md) jako zadanie.

## Dane testowe

`supabase/seed_test_data.sql` — 25 wydarzeń pokrywających wszystkie kombinacje ustawień.
Uruchamiany ręcznie w SQL Editor, bezpieczny do wielokrotnego użycia (czyści po markerze
`[TEST]` w opisie). Konta testowe tworzy `supabase/seed-test-users.sql`
(`test1..test10@example.com`, hasło `test1234`).

`supabase/seed_test_groups.sql` — 4 grupy i 11 meczów **prywatnych** wokół przepływów
grupowych: mecze ekipy na stronie głównej, zaproszenia, przypinanie meczu do grupy.
Marker `[TEST-G]`. Wymaga konta `franekks@gmail.com` w `auth.users`.

`supabase/seed_regresja.sql` — **43 scenariusze regresyjne** po refaktorze (etapy 1–3):
dołączanie, kolejka rezerwowa, trzy tryby miejsc dla bramkarzy, prośby o akceptację,
płatności, goście, warstwy okien, sortowanie list. Każdy mecz sprawdza jedną rzecz,
tytuł niesie numer (`R01`…`R43`), a opis zaczyna się od „SPRAWDŹ:" i kończy oczekiwanym
wynikiem. Marker `[REG]`. Na końcu pliku zapytanie, które wypisuje całość jako listę
kontrolną z adresami.

`supabase/seed_taktyka.sql` — **12 scenariuszy do zakładki „Taktyka"** (migracja `103`):
różne wielkości składu (5v5, 7v7, 8v8, 11v11), siatkówka i koszykówka, nierówne drużyny,
pusta druga drużyna, bardzo długie nazwiska oraz przypadki, w których zakładki ma NIE być
(składy nieopublikowane, mecz odwołany). `T12` jest wypełniony do końca — ustawienie,
obsadzone pozycje, taktyka, notatka i wiadomości w czacie obu drużyn — bo to jedyny stan,
którego nie da się zobaczyć bez kilku minut klikania. Marker `[TAK]`, tytuły `T01`…`T12`,
na końcu pliku lista kontrolna z adresami.

`supabase/seed_test_jan.sql` — 19 wydarzeń pokrywających obszary, których nie ruszają
poprzednie seedy: wyniki meczów z golami, mecze z przeszłości i statystyki gracza,
odwołanie meczu, goście dopisani przez uczestnika, miejsce spoza katalogu, komentarze,
składy nieopublikowane, 18-osobowy skład. Marker `[TEST-J]`. Wymaga konta
`j4n.brz0@gmail.com`.

Komplet do postawienia bazy od zera: `supabase/bundles/` (3 paczki migracji + seedy),
generowane przez `node scripts/build-db-bundles.mjs` — po dodaniu migracji uruchom
ponownie i zacommituj wynik.

## Konwencje

- **NIE pushuj bezpośrednio na `master`. Każda zmiana idzie przez pull request** —
  branch → PR → **merge przez agenta** → deploy. Powód: PR zostaje jako czytelny
  zapis zmiany (diff, opis, preview z Vercela), nawet jeśli nikt go nie recenzuje
  na żywo. Merge do mastera to deploy na produkcję — środowisko jest jedno.
- **Agent sam mergueje swój PR**, gdy CI jest zielone. Nie czekaj na potwierdzenie
  właściciela — decyzja z 2026-08-05, gdy aplikacja nie była jeszcze publiczna.
  Warunki, bez których NIE wolno mergować:
  - CI zielone (`tsc`, Vitest, `check:docs`),
  - **wszystkie poprawki dopchnięte PRZED otwarciem PR-a**. Dwa razy zdarzyło się,
    że PR został zmergowany chwilę przed dosłaniem poprawki — raz kosztowało to
    zepsuty build produkcyjny (patrz pułapka o `useSearchParams` niżej).
    Otwieraj PR dopiero, gdy zmiana jest kompletna i sprawdzona.
  - migracja SQL w PR → napisz WPROST w opisie i w odpowiedzi, że trzeba ją
    uruchomić ręcznie w Supabase. Merge jej nie uruchamia.
- Commity i wiadomości do użytkownika po polsku.
- Migracje: kolejny numer + krótka nazwa, np. `058_nazwa_zmiany.sql`, z komentarzem
  **dlaczego** powstała.
- Nie commituj `.env` (jest w `.gitignore`).
- Domena kanoniczna to `bojo.pl` — jeśli dodajesz miejsce z fallbackiem URL, użyj tej
  samej wartości co `layout.tsx`, `robots.ts` i `sitemap.ts`.
- **Mobile-first bezwzględnie.** Style bazowe (bez media query) opisują najmniejszy
  telefon; rozszerzanie widoku do tabletu/desktopu wyłącznie progresywnie, przez
  warianty `min-width` (`sm:`/`md:`/`lg:`/`xl:` Tailwinda). Breakpointy `max-*:`
  (`max-sm:`, `max-md:`…) i `@media (max-width: …)` są w nowym kodzie zabronione —
  pilnuje tego `npm run check:docs` (sekcja 10), skanując cały `frontend/src`.
- **Copy stron treści i landingu żyje w `frontend/src/content/*.ts`**, osobno od JSX
  (wzorem dawnego `components/home/landing/content.ts`) — żeby dało się testować bez
  renderowania, m.in. zakazane frazy w `content/zakazaneFrazy.ts`
  (`landingContent.test.ts`, `tresciStron.test.ts`).
- **Kolorystyka niesie stałe znaczenie w całej apce** — trzy kolory mają dziś
  zarezerwowane, wyłączne odczytanie, żeby budować podświadome skojarzenie:
  - **Różowy (`pink-*`)** — zawsze i wyłącznie odniesienie do wiadomości: chmurka na
    dolnej nawigacji, plakietka z liczbą nieprzeczytanych na zakładce Rozmowa/Tablica,
    ikona wiadomości na karcie meczu/ekipy, chmurka na ikonie ekipy (karta na `/grupy`).
    Nigdy nic innego. **Wiadomości mają KSZTAŁT chmurki, nie kropki** — kropka mówi tylko
    „coś tu jest" i wymaga zapamiętania koloru, chmurka mówi „ktoś napisał" bez tłumaczenia
    (zgłoszone wprost). Kropka zostaje dla niebieskiego i pomarańczowego.
  - **Niebieski (`blue-*`)** — zawsze i wyłącznie „wymaga akceptacji uczestnictwa":
    prośba o dołączenie, oferta zwolnionego miejsca z rezerwy, pytanie o udział
    (`WYMAGA_AKCJI` w `lib/notifications.ts`), plakietka „Wymaga akceptacji" na karcie
    meczu. Nigdy nic innego.
  - **Pomarańczowy (`orange-*`)** — zawsze i wyłącznie „nowość, o której jeszcze nie
    wiesz" (bez konkretnej wiadomości do przeczytania ani decyzji do podjęcia): kropka
    na ikonie ekipy, gdy pojawił się nowy mecz od ostatniej wizyty na `/grupy/[id]`
    (`kluczGrupyWidziano` w `lib/groups.ts`), kropka przy „Znajdź grę" na dolnej
    nawigacji, gdy w promieniu 5 km pojawiło się nowe wydarzenie
    (`KLUCZ_WYDARZENIA_WIDZIANO` w `lib/events.ts`). Nigdy nic innego.

  **Liczba nadchodzących meczów** na ikonie „Moje" (dolna nawigacja) jest celowo
  ZIELONA (`primary-700`), poza tą trójką: nie znaczy ani „przeczytaj", ani
  „zdecyduj", ani „nowość" — to stan, nie zdarzenie. Niebieska kropka „prośba
  o dołączenie" schodzi wtedy do dolnego rogu ikony: akcja do wykonania nie może
  zniknąć pod informacją.

  Nowy wskaźnik/plakietka w UI ma sprawdzić, czy mieści się w jednym z tych trzech
  znaczeń, zanim sięgnie po `pink-*`/`blue-*`/`orange-*` — i **nie** używać ich do
  niczego innego (inny kolor niż zwykle też jest sygnałem). Przy dodawaniu nowego
  typu wskaźnika warto od razu rozważyć, czy zasługuje na własny, konsekwentnie
  używany kolor w całej apce, zamiast doraźnego wyboru per ekran.
