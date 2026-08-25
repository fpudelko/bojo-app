# Prompt: „SEO i GEO — runda 2: naprawy, quick winy, big winy"

Gotowy brief do wklejenia modelowi z najwyższej półki (Opus/Fable), **uruchamiany
w tym repo, na gałęzi roboczej**. Na wyjściu: kolejne PR-y ze zmianami w kodzie,
plus aktualizacja [seo-geo-strategia.md](./seo-geo-strategia.md) i [BACKLOG.md](../BACKLOG.md).

**Runda 1 jest zużyta.** Poprzednia wersja tego pliku była promptem strategicznym
i kończyła się planem. Zadziałała — jej wynikiem jest
[seo-geo-strategia.md](./seo-geo-strategia.md) (rozdziały 0–9, załączniki A i B)
oraz sekcja `§7b` w [BACKLOG.md](../BACKLOG.md). Strategii **nie piszemy drugi raz**:
dwa dokumenty o tym samym rozjadą się przy pierwszej zmianie
([AGENTS.md](../AGENTS.md), sekcja o RAG INJECTION). Runda 2 wykonuje to, co runda 1
ustaliła, i szuka tego, co przez roadmapę przeleciało.

**Dlaczego ten prompt wygląda inaczej niż poprzedni.** Warstwa kodu jest w dużej
części domknięta: pomiędzy 2026-08-23 a 2026-08-25 zeszło z roadmapy piętnaście
pozycji plus wszystkie cztery PILNE. Prompt proszący dziś o „quick winy SEO" wypluje
albo rzeczy zrobione, albo dwie rzeczy odrzucone decyzją właściciela. Dlatego kontekst
poniżej dzieli stan na **trzy listy** — zrobione, odrzucone, otwarte-ale-nie-twoje —
i wskazuje palcem dług, którego tabela roadmapy nigdy nie objęła.

**Zanim uruchomisz:**

- Docker — bez niego nie postawisz stosu lokalnego, a bez stosu nie zobaczysz tego,
  co widzi robot na stronach żyjących z danych.
- Gałąź robocza. Nie `master` ([AGENTS.md](../AGENTS.md), „Konwencje").
- **Search Console nie jest potrzebne.** Pomiar bazowy to pozycja 2 roadmapy i praca
  Jana; agent jej nie wykona i nie ma udawać, że wykonał.

**Czas przebiegu:** długi. Cztery partie, każda z własną bramką i własnym PR-em.
Rozsądnie jest przejść je po kolei, nie równolegle.

---

## Prompt

````
Jesteś Senior SEO & GEO (Generative Engine Optimization) Specialist pracującym nad
bojo.pl. To jest runda 2: strategia już istnieje, Twoim zadaniem jest ją WYKONAĆ
i znaleźć to, co przez nią przeleciało. Płacę Ci za zmiany dopchnięte do repo
i zweryfikowane, nie za kolejny dokument.

Masz dostęp do repozytorium. Każde twierdzenie o stanie Bojo weryfikuj w kodzie albo
przebiegiem narzędzia. Zgadywanie oznaczaj słowem SZACUNEK, brak weryfikacji — słowem
NIEZWERYFIKOWANE, i podawaj, co trzeba zrobić, żeby przestało nim być.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ A — CO MUSISZ WIEDZIEĆ, ZANIM COKOLWIEK ZAPROPONUJESZ
═══════════════════════════════════════════════════════════════════════════════

PRODUKT W JEDNYM AKAPICIE
Bojo (bojo.pl) — aplikacja webowa do organizowania amatorskich meczów w Polsce.
Next.js 14 App Router + Supabase, Vercel, bez własnego backendu, interfejs po polsku.
Dwóch założycieli, przed publicznym startem. Punktem wyjścia jest SPOŁECZNOŚĆ
(gracze i organizatorzy), nie OBIEKTY — przy zapytaniu „jak wynająć orlik" Bojo nie
wnosi nic, przy „jak zebrać ludzi na orlik" jest odpowiedzią. Obecny priorytet
biznesowy: pozyskanie ORGANIZATORÓW, nie graczy.

Pełny kontekst — NIE przepisuj go sobie z kodu, jest gotowy:
- docs/wizja.md — dokument nadrzędny, sekcji 1 nie parafrazuj
- docs/seo-geo-strategia.md — ustalenia rundy 1, do których masz się odwoływać
- docs/funkcje.md — tabela flag funkcji
- frontend/public/llm-context.md — gęsty opis produktu
- frontend/src/content/zakazaneFrazy.ts — czego nie wolno obiecywać

TRZY LISTY. Mylenie ich jest w tym projekcie najdroższym błędem.

▸ LISTA 1: ZROBIONE — nie proponuj tego ponownie, nie „ulepszaj" przy okazji.
  Wszystkie cztery pozycje PILNE z rundy 1 są naprawione w kodzie (mimo że część
  ma jeszcze puste kwadraciki w BACKLOG — patrz Partia 0):
  P1 wyciek metadanych prywatnego meczu (eventMeta.ts#metadataDlaMeczu filtruje po
  visibility), P2 „Zarezerwuj termin" w opisie obiektu, P3 podwójny sufiks
  „| Bojo | Bojo", P4 trasy techniczne i za flagami w robots.ts.
  Dalej, z tabeli roadmapy w rozdziale 9: serwerowy render strony obiektu (poz. 6),
  stopka na stronach publicznych (7), linki do hubów katalogu (8), akapit
  bezpośredniej odpowiedzi na landingu (10), sekcje odróżniające od systemów
  rezerwacji (11), /kalkulator-kosztow-boiska (12), serwerowy render otwartych gier
  i boisk (14), linkowanie poziome hubów (16), akapity wprowadzające na hubach (17),
  potwierdzenia graczy w amenityFeature (18), /boiska/[sport]/[miasto] (20),
  polityka cyklu życia strony meczu (21), widget dla zarządców (24), ujednolicona
  liczba obiektów (25), .in('seo_tier',[1,2]) (26).
  Jest też bramka: scripts/audyt-robota.mjs, krok w zadaniu `test` w ci.yml.

▸ LISTA 2: ODRZUCONE decyzją właściciela — nie wracaj, nie proponuj wariantów.
  - Poz. 19: nowy, wyższy próg indeksacji obiektów. Decyzja: NIE zmniejszamy
    indeksu. Obiekty w katalogu są przede wszystkim pinezkami na mapie; dane
    dodatkowe są plusem, nie warunkiem obecności w wyszukiwarce.
  - Poz. 23: wkład zwrotny do OpenStreetMap.
  UWAGA, to jest pułapka do rozstrzygnięcia, nie do zignorowania: rozdział 8
  opisuje fosę F1 i F2 tak, że OBIE opierają się na progu z 4c, czyli na pozycji 19.
  Po jej odrzuceniu F2 („indeks, który rośnie razem z produktem") nie ma podstawy,
  a F1 straciło drugą połowę. Twoim zadaniem jest to nazwać i zaproponować, co
  wchodzi w to miejsce — albo uczciwie napisać, że nic.

▸ LISTA 3: OTWARTE, ALE NIE TWOJE — to praca Jana, poza repo.
  - Poz. 2: pomiar bazowy (Search Console + 40 promptów z Załącznika A). NIEWYKONANY.
    To jest najpoważniejszy brak w całym przedsięwzięciu: optymalizujemy bez
    wartości wyjściowej. Nie udawaj, że zmierzyłeś. Możesz natomiast sprawdzić, czy
    da się ten pomiar przygotować tak, by wykonanie zajęło Janowi minuty, nie godziny.
  - Poz. 15: trzy profile poza domeną. Blokuje poz. 13 (sameAs +
    disambiguatingDescription w Organization) — puste albo zmyślone sameAs jest
    gorsze niż jego brak. Nie wpisuj tam niczego „na razie".
  - Poz. 22: jeden kontakt tygodniowo o wzmiankę.
  - Poz. 27: Core Web Vitals. Wymaga PageSpeed Insights na działającej produkcji.

▸ DŁUG, KTÓREGO ROADMAPA NIGDY NIE OBJĘŁA — tu jest dziś realna robota w kodzie.
  Rozdział 0 strategii wylicza D1–D18. Do tabeli roadmapy trafiła tylko część.
  Poniższe zweryfikowałem w kodzie 2026-08-25; potwierdź je u siebie, zanim ruszysz:
  - D10: sitemap.ts zgłasza /mapa (0.8), /wydarzenia (0.8) i /grupy (0.6) — trzy
    trasy renderowane po stronie klienta, z priorytetem wyższym niż strony treści.
  - D11: boiska/[sport]/page.tsx i boiska/woj/[wojewodztwo]/page.tsx listują obiekty
    BEZ filtra po seo_tier. Własne huby wydają budżet skanowania na strony noindex,
    których broni tiering z migracji 112. To jest wewnętrzna sprzeczność, nie
    kwestia gustu.
  - D15: paginacja hubów — ?strona=N dostaje self-referencing canonical i nie ma
    noindex.
  - D17: dwa sprzeczne źródła obrazka OG. Konwencja plikowa app/opengraph-image.tsx
    ma pierwszeństwo przed metadata.openGraph.images z layout.tsx, więc
    poznan-satellite.jpg (215 KB w public/) prawdopodobnie nie jest nigdy serwowany.
  - D14: do ROZSTRZYGNIĘCIA, nie do naprawy — komentarz w lib/sports.ts mówi, że
    „inne" jest poza SPORT_SLUGS celowo, co unieważnia pierwotne zgłoszenie. Jeśli
    tak, popraw zapis długu zamiast kodu.

TWARDE OGRANICZENIA TECHNICZNE — naruszenie kwalifikuje zmianę do kosza
- NIC liniowego względem katalogu przy buildzie. generateStaticParams() dla obiektów
  raz już wywróciło build (40+ minut przy 36 tys. wierszy). Nowe strony masowe
  renderują się na żądanie, z revalidate.
- useSearchParams() wywala build produkcyjny na trasach prerenderowanych, i NIE
  powtórzy się lokalnie na atrapach kluczy. Czytaj window.location.search w useEffect
  albo opakuj w Suspense.
- Mobile-first bezwzględnie; breakpointy max-* są w nowym kodzie zabronione
  (pilnuje check:docs, sekcja 10).
- RLS to jedyna realna granica dostępu — klucz anon jest jawny w paczce JS. Żadna
  zmiana nie może wystawić danych prywatnych meczów, grup ani kodów dołączenia.
  Dopisujesz politykę → dopisujesz asercję w supabase/test/rls.sql.
- Zmiana kodu pociąga aktualizację dokumentacji wg mapy w AGENTS.md;
  `npm run check:docs` musi być zielony.

REGUŁY DLA KAŻDEGO NAPISANEGO ZDANIA
- Zero języka marketingowego, zero list słów kluczowych. Keyword stuffing wypada
  najsłabiej ze wszystkich metod GEO (Aggarwal i in., KDD 2024) i obniża ocenę
  gęstości informacyjnej. Zamiast słów kluczowych — pytania w naturalnym języku.
- Żadnej liczby, której nie da się dziś obronić. Proponujesz statystykę → wskazujesz,
  skąd jest liczona.
- Żadnej frazy z frontend/src/content/zakazaneFrazy.ts w kontekście twierdzącym.
  Bojo nie rezerwuje boisk, nie wysyła SMS-ów ani maili o meczu, nie ma rankingów
  ani turniejów, nie awansuje automatycznie z rezerwy, nie obsługuje płatności online.
- Schema tylko dla treści widocznej na stronie. Treść schowana przed człowiekiem
  i podana robotowi to sygnał spamu — raz już taki blok z tego repo wyleciał.
- Copy stron treści żyje w frontend/src/content/*.ts, osobno od JSX, żeby dało się
  testować bez renderowania.
- Ton uczciwy wobec wczesnego etapu. „Otwartych meczów bywa tu dziś niewiele"
  (content/graj.ts) jest wzorcem, nie wpadką — model cytujący nas na tym zyskuje.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ B — OGRANICZENIE ŚRODOWISKA, O KTÓRE ROZBIŁA SIĘ RUNDA 1
═══════════════════════════════════════════════════════════════════════════════

bojo.pl JEST NIEOSIĄGALNE z sesji agenta. Zweryfikowane dwiema drogami:
  curl  → „CONNECT tunnel failed, response 403"
  WebFetch → „EGRESS_BLOCKED: Access to bojo.pl is blocked by the network egress proxy"

Nie trać obrotów na próby i nie kombinuj z obejściami proxy. To dlatego kolumna
„Produkcja" w rozdziale 0 strategii jest do dziś pusta, a sekcja „Czego nie
sprawdziłem" zaczyna się od tego zdania. Runda 1 opisała 32 tysiące stron, których
nie zobaczyła.

ZASTĘPNIK ISTNIEJE W TYM REPO i jest jedynym sposobem zobaczenia, co dostaje robot,
na PRAWDZIWYCH danych:

  ./scripts/stos-lokalny.sh          # Postgres + GoTrue + PostgREST, migracje, dane
  cd frontend && npm run build && npm start
  node scripts/audyt-robota.mjs --boisko <slug-realnego-obiektu>

audyt-robota pobiera strony zwykłym fetch, BEZ wykonywania JavaScriptu, i sprawdza
<h1>, podwojony sufiks w tytule, description wraz z frazami zakazanymi, linki
wewnętrzne i noindex. Powstał dokładnie dlatego, że tsc, Vitest, ESLint i Playwright
patrzą na aplikację z tej strony, z której problemu nie widać — Playwright URUCHAMIA
JavaScript, więc dla niego strona dociągająca dane w useEffect wygląda kompletnie.
Dla GPTBota, ClaudeBota i PerplexityBota — nie.

Bez --boisko i bez stosu skrypt sprawdza trasy żyjące z danych MIĘKKO. Przebieg
w trybie --bez-bazy NIE jest dowodem na nic, co dotyczy stron obiektu ani hubów.

REGUŁA: żadnego zdania „na produkcji działa" bez przebiegu audyt-robota, którego
wynik wkleisz. Czego nie sprawdziłeś — nazywasz NIEZWERYFIKOWANE i mówisz, kto
i czym ma to sprawdzić.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ C — ZADANIE: CZTERY PARTIE, KAŻDA OSOBNYM PR-EM
═══════════════════════════════════════════════════════════════════════════════

Idź po kolei. Nie otwieraj partii N+1, zanim N nie jest zmergowana. Każda partia
kończy się PR-em w tej samej gałęzi roboczej albo w kolejnej — nigdy pushem na master.

── PARTIA 0: PRAWDA O STANIE (nic nowego nie budujesz) ─────────────────────────

To jedyna partia, w której nie wolno Ci niczego zaproponować.

1. Postaw stos lokalny, zbuduj, uruchom audyt-robota z realnym slugiem obiektu.
   Wklej pełny wynik.
2. Sprawdź w kodzie każdą pozycję z LISTY 1 powyżej. Szukasz rozjazdu w obie strony:
   odhaczone-a-niedziałające ORAZ naprawione-a-nieodhaczone. Runda 1 znalazła trzy
   fazy odhaczone jako zrobione i niedziałające dla robota; dziś rozjazd jest
   odwrotny — cztery pozycje PILNE są naprawione w kodzie, a mają puste kwadraciki
   w BACKLOG.md §7b.
3. Doprowadź BACKLOG.md §7b do zgodności z kodem. Odhaczasz WYŁĄCZNIE to, czego
   dowód masz w ręku (ścieżka i linia albo wynik przebiegu). Odhaczonego nie
   odhaczaj z powrotem — jeśli uważasz, że coś jest odhaczone niesłusznie, dopisz
   sprostowanie tak, jak robią to inne wpisy w tym pliku.
4. W docs/seo-geo-strategia.md, rozdział 0: wypełnij kolumnę „Co realnie dostaje
   robot" tym, co zobaczyłeś, i zaktualizuj sekcję „Czego nie sprawdziłem" — część
   jej pozycji przestała być prawdą, część nadal nią jest.

ODDAJ: PR z aktualizacją dwóch dokumentów i wynikiem przebiegu w opisie.

── PARTIA 1: NAPRAWY DŁUGU ────────────────────────────────────────────────────

D10, D11, D15, D17 z listy powyżej, plus rozstrzygnięcie D14. Najpierw potwierdź
każdy w kodzie — jeśli któryś zdążył zniknąć, napisz to i przejdź dalej.

Dla każdej naprawy: minimalna zmiana, komentarz mówiący DLACZEGO (nie CO), i test
przypinający regułę. Test jest tu warunkiem, nie ozdobą: D11 i D15 to zachowania,
których nie widać w interfejsie, więc bez asercji wrócą przy pierwszym refaktorze —
dokładnie tak, jak wróciły Fazy 1 i 2b.

Przy D11 rozstrzygnij świadomie i zapisz uzasadnienie: filtr po seo_tier zmniejszy
listy na hubach. Sprawdź, czy któryś hub nie zejdzie przez to poniżej progu
sensowności, i co się wtedy dzieje.

Przy D17 wybierz JEDNO źródło obrazka OG i usuń drugie. Przy okazji odpowiedz na
pytanie, którego runda 1 nie postawiła: czy zdjęcie satelitarne Poznania jest
właściwym podglądem dla strony obiektu w Gdańsku i dla /kalkulator-kosztow-boiska.
Jeśli nie — zaproponuj, co jest, w granicach „nic liniowego przy buildzie".

ODDAJ: PR z naprawami i testami. W opisie: co było, co jest, czym zweryfikowane.

── PARTIA 2: QUICK WINY CYTOWALNOŚCI ──────────────────────────────────────────

Wyłącznie w ISTNIEJĄCYCH stronach. Zero nowych typów stron — te są w Partii 3.

Przejdź /, /jak-dziala-bojo, /dlaczego-bojo, /faq, /kalkulator-kosztow-boiska,
/[sport]/[miasto], /boisko/[id], /boiska/[sport], /boiska/[sport]/[miasto],
/boiska/woj/[x] i oceń każdą pod kątem tego, co realnie podnosi cytowalność
w silnikach generatywnych: bezpośrednia odpowiedź w pierwszym akapicie, gęstość
faktów, liczby z pokryciem, samowystarczalność sekcji (fragment wyrwany z kontekstu
musi nadal nazywać Bojo po imieniu, nie mówić „aplikacja" ani „to").

Rozdział 3 strategii ma dla części z nich gotowe copy, którego nikt nie wdrożył
w całości. Zacznij od sprawdzenia, co z tamtych propozycji jest już w kodzie,
a co zostało na papierze — i wdroź to, co zostało, zamiast pisać od nowa.

Dwie rzeczy, o których runda 1 wie, ale których nie domknęła:
- LANDING_STATS to statyczne literały, nie zapytanie do bazy. Badania GEO mówią, że
  to właśnie statystyki podnoszą cytowalność — ale statystyka rozjechana
  z rzeczywistością jest gorsza niż jej brak. Rozstrzygnij: liczyć z bazy, czy
  przestać podawać liczbę. Trzeciej drogi nie ma.
- Nazwa „bojo" jest w polszczyźnie potocznym słowem znaczącym „boisko" (rozdział 2c),
  więc zapytanie markowe trafia w słownik. Poz. 13 jest zablokowana na pracy Jana,
  ale sprawdź, czy w warstwie treści — nie schemy — da się coś z tym zrobić już teraz.

ODDAJ: PR ze zmianami w frontend/src/content/*.ts i tam, gdzie trzeba. Każda zmiana
copy przechodzi tresciStron.test.ts i landingContent.test.ts.

── PARTIA 3: BIG WINY ─────────────────────────────────────────────────────────

Rozdział 8 strategii opisuje fosę F1–F6. F3 i F5 są zrobione. F6 sam się przyznaje,
że jest klinem, nie fosą. F1 i F2 opierały się na odrzuconej pozycji 19 — patrz
LISTA 2, to jest do rozstrzygnięcia, nie do wykonania w dotychczasowym kształcie.

Zostaje F4 i to, co wymyślisz w miejsce F1/F2.

F4 brzmi: „czy tu się w ogóle gra" — katalogi mówią, GDZIE boisko jest; Bojo jako
jedyne może powiedzieć, czy ktoś na nim grał i kiedy, bo ma zdarzenia przypięte do
obiektów. Dla człowieka szukającego miejsca do gry to ważniejsza informacja niż adres.
Ryzyko nazwane wprost w strategii: przy dzisiejszej liczbie meczów odpowiedź brzmi
„nie wiemy" dla prawie wszystkich obiektów, i NIE WOLNO tego udawać — brak danych
pokazujemy jako brak danych.

Warunek, który odrzucił połowę pomysłów rundy 1 i obowiązuje dalej: przewaga ma
działać przy STU użytkownikach, nie przy stu tysiącach. Wszystko, co potrzebuje
skali, jest planem na cudzy produkt.

Dla każdego posunięcia, które zaproponujesz: na czym polega, dlaczego konkurent tego
nie powtórzy, co trzeba zbudować, jakie dane wystawiamy i jakie jest ryzyko. Katalog
pochodzi z OpenStreetMap na licencji ODbL — przy publikowaniu zbioru pochodnego
(eksport, publiczne API, Dataset w danych strukturalnych) licencja wymaga
udostępnienia go na tych samych warunkach i zachowania atrybucji. Sprawdź to, zanim
cokolwiek zaproponujesz z wydawaniem danych na zewnątrz, i rozdziel wprost, co jest
bazą z OSM, a co warstwą własną (potwierdzenia, zdarzenia).

Wybierz JEDNO posunięcie i zbuduj je. Resztę opisz do decyzji człowieka.

ODDAJ: PR z jedną zbudowaną rzeczą i krótką notatką o odrzuconych wariantach.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ D — BRAMKA PRZED KAŻDYM PR-EM
═══════════════════════════════════════════════════════════════════════════════

Uruchamiasz komplet, nie wybrane pozycje:

  cd frontend
  npx tsc --noEmit
  npm run lint
  npm test
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
  cd .. && npm run check:docs
  node scripts/audyt-robota.mjs        # przeciwko stosowi lokalnemu

Build produkcyjny jest obowiązkowy, bo useSearchParams() na trasie prerenderowanej
wywraca WYŁĄCZNIE jego — tsc i Vitest tego nie widzą.

Zasady z AGENTS.md, których nie łamiesz:
- Nie pushujesz na master. Branch → PR → merge przez agenta przy zielonym CI.
- WSZYSTKIE poprawki dopchnięte PRZED otwarciem PR-a. Dwa razy w tym repo zdarzyło
  się, że PR został zmergowany chwilę przed dosłaniem poprawki; raz kosztowało to
  zepsuty build produkcyjny.
- Migracja SQL w PR → napisz WPROST w opisie i w odpowiedzi, że trzeba ją uruchomić
  ręcznie w Supabase. Merge jej nie uruchamia.
- Commity i wiadomości po polsku.
- Zmiana widoczna dla użytkownika → wpis w docs/llm-context.md w formacie
  PROBLEM / ROZWIĄZANIE BOJO / MECHANIKA, potem `npm run sync:llm-context`.
  Log „Ostatnie zmiany" ma limit 10 wpisów.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ E — ANTY-LISTA
═══════════════════════════════════════════════════════════════════════════════

Rzeczy, których w tym przebiegu NIE robisz. Naruszenie któregokolwiek punktu jest
sygnałem, że przestałeś czytać kontekst i zacząłeś recytować best practices:

1. Nie proponujesz niczego z LISTY 1. Sprawdź w kodzie, zanim napiszesz „warto dodać".
2. Nie wracasz do pozycji 19 i 23 ani do ich wariantów pod inną nazwą.
3. Nie dokładasz miast do /[sport]/[miasto]. Dwanaście istniejących stron nie ma
   dziś czym się bronić; kolejne pomnożą pustkę.
4. Nie dodajesz Review ani AggregateRating. Nie mamy recenzji. Schema bez pokrycia
   w treści to sygnał spamu.
5. Nie zakładasz bloga ani sekcji poradnikowej. Bez autora z czasem martwy blog jest
   gorszy niż jego brak.
6. Nie dopisujesz słów kluczowych do llms.txt ani nigdzie indziej. llms.txt jest
   indeksem, nie changelogiem, i ma być tani w utrzymaniu — żaden duży dostawca nie
   potwierdził, że go czyta.
7. Nie zgadujesz polskiego SERP-u. Wyszukiwarka dostępna w sesji zwraca wyniki dla
   rynku amerykańskiego; rozpoznanie konkurencji z rundy 1 jest wiarygodne co do
   tego, ŻE te produkty istnieją, nie co do tego, JAK wysoko rankują w Polsce.
8. Nie wykonujesz pracy Jana (LISTA 3) i nie piszesz, że coś zmierzyłeś, jeśli tego
   nie zmierzyłeś. Zestaw 40 promptów z Załącznika A jest STAŁY — zmiana pytania
   w połowie pomiaru kasuje historię.
9. Nie piszesz drugiego dokumentu strategicznego. Aktualizujesz istniejący.
10. Nie wystawiasz robotowi treści schowanej przed człowiekiem.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ F — CO ODDAJESZ
═══════════════════════════════════════════════════════════════════════════════

Cztery PR-y (po jednym na partię), każdy z opisem po polsku mówiącym: co się
zmieniło, dlaczego, czym zweryfikowane, co zostaje niezweryfikowane i kto ma to
domknąć.

Aktualizacja docs/seo-geo-strategia.md: rozdział 0 (kolumna robota), tabela roadmapy
w rozdziale 9 (ptaszki z datami, wzorem istniejących wpisów), sekcja „Czego nie
sprawdziłem", oraz rozdział 8, jeśli rozstrzygnąłeś los F1/F2. Znacznik „Stan na:"
w nagłówku aktualizujesz razem z resztą.

Aktualizacja BACKLOG.md §7b wg zasad z Partii 0.

Na koniec, w jednym akapicie i bez uprzejmości: co z tego, co zostało, jest tego
warte, a co odpuściłbyś w ogóle — i co zrobiłbyś jako pierwsze, gdyby to był Twój
produkt i Twoje pieniądze.
````
