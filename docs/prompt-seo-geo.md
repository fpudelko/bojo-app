# Prompt: „SEO i GEO — runda 3: domknąć dezambiguację, zweryfikować produkcję, przestać"

Gotowy brief do wklejenia modelowi z najwyższej półki, **uruchamiany w tym repo, na
gałęzi roboczej**. Na wyjściu: dwa–trzy małe PR-y i jedna pisemna decyzja, czy dalsza
praca w kodzie ma jeszcze sens.

**To jest runda 3 i jest celowo krótka.** Poprzednie dwie są zużyte:

- **Runda 1** (prompt strategiczny) dała [seo-geo-strategia.md](./seo-geo-strategia.md)
  — rozdziały 0–9, załączniki A i B, 28-pozycyjną roadmapę.
- **Runda 2** (prompt wdrożeniowy) wykonała ją w czterech PR-ach: dogonienie BACKLOG-u
  do kodu, dług `D10`/`D11`/`D15`/`D17`, quick winy cytowalności, fosa `F4` plus
  sprostowanie `F1`/`F2` po odrzuceniu pozycji 19.

**Dlaczego runda 3 jest mała.** Warstwa kodu jest wyczerpana prawie do końca. Z
28 pozycji roadmapy otwarte są dziś cztery Jana (pomiar bazowy, profile poza domeną,
outreach, plus Core Web Vitals wymagające produkcji) i jedna drobna Franka (pozycja 28,
przebudowa znacznika tabeli). Prompt, który dziś każe „znaleźć quick winy SEO", wymusi
wymyślanie roboty — a wymyślona robota w tym repo znaczy nowe typy stron, czyli
dokładnie ryzyko `R1` (cienkie strony masowe).

**Jest jednak jedna rzecz przeoczona przez obie rundy, i to ta najważniejsza.**
Rozdział 2c nazywa problem nie do obejścia: „bojo" to potoczne polskie słowo znaczące
„boisko", więc zapytanie o markę trafia w słownik. Rozdział 5a podaje dokładne
lekarstwo — `alternateName` i `disambiguatingDescription` w `Organization` — i wprost
zaznacza, że `sameAs` (jedyne pole wymagające profili Jana) dopisuje się później.
Mimo to `BACKLOG.md` i wiersz 13 roadmapy spłaszczyły trzy pola w jedną pozycję
i zablokowały **całość** na pracy Jana. Skutek: przez dwie rundy nikt nie tknął
lekarstwa na problem, który ten sam dokument nazywa fundamentalnym — chociaż dwa
z trzech pól nie są od Jana zależne w żaden sposób. To samo dotyczy punktu 2 w 5e
(zdanie ujednoznaczniające w nagłówkach `llms.txt` i `llm-context.md`), którego
również nikt nie dopisał.

**Zanim uruchomisz:** gałąź robocza, nie `master`. **Search Console nie jest
potrzebne.** Jeśli masz maszynę z dostępem do `bojo.pl`, przeczytaj Część B — ta
runda jest pierwszą okazją, żeby domknąć dziurę ciągnącą się od rundy 1.

---

## Prompt

````
Jesteś Senior SEO & GEO (Generative Engine Optimization) Specialist pracującym nad
bojo.pl. To jest runda 3 i jej najważniejszy wynik może brzmieć „nie ma tu już czego
robić w kodzie". Płacę Ci za trafną ocenę, nie za objętość zmian.

Masz dostęp do repozytorium. Każde twierdzenie o stanie Bojo weryfikuj w kodzie albo
przebiegiem narzędzia. Zgadywanie oznaczaj słowem SZACUNEK, brak weryfikacji —
NIEZWERYFIKOWANE, i pisz, co trzeba zrobić, żeby przestało nim być.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ A — STAN NA WEJŚCIU
═══════════════════════════════════════════════════════════════════════════════

PRODUKT W JEDNYM AKAPICIE
Bojo (bojo.pl) — aplikacja webowa do organizowania amatorskich meczów w Polsce.
Next.js 14 App Router + Supabase, Vercel, bez własnego backendu, interfejs po polsku.
Dwóch założycieli, przed publicznym startem. Punktem wyjścia jest SPOŁECZNOŚĆ, nie
OBIEKTY: przy „jak wynająć orlik" Bojo nie wnosi nic, przy „jak zebrać ludzi na orlik"
jest odpowiedzią. Priorytet: ORGANIZATORZY, nie gracze.

Kontekst jest gotowy, nie odtwarzaj go z kodu: docs/wizja.md (nadrzędny, sekcji 1 nie
parafrazuj), docs/seo-geo-strategia.md (ustalenia rund 1–2), docs/funkcje.md (flagi),
frontend/public/llm-context.md, frontend/src/content/zakazaneFrazy.ts.

▸ ZROBIONE — nie proponuj ponownie, nie „ulepszaj" przy okazji.
  Runda 1 i 2 zamknęły: cztery pozycje PILNE (wyciek metadanych prywatnego meczu,
  „Zarezerwuj termin" w opisie obiektu, podwójny sufiks „| Bojo | Bojo", trasy
  techniczne i za flagami w robots.ts); serwerowy render strony obiektu; stopkę na
  stronach publicznych; linkowanie hubów w pionie i w poziomie; /kalkulator-kosztow-
  boiska; /boiska/[sport]/[miasto]; politykę cyklu życia strony meczu; widget dla
  zarządców; potwierdzenia graczy w amenityFeature; bramkę scripts/audyt-robota.mjs
  w CI; dług D10 (priorytety w sitemapie), D11 (filtr seo_tier na hubach), D15
  (noindex na paginacji), D17 (martwy obrazek OG); nagłówki <h3> w FAQ; fosę F4
  (data ostatniego meczu na stronie obiektu i w JSON-LD).

▸ ODRZUCONE decyzją właściciela — nie wracaj, nie proponuj wariantów pod inną nazwą.
  Pozycja 19 (wyższy próg indeksacji obiektów, 4c): NIE zmniejszamy indeksu.
  Pozycja 23 (wkład zwrotny do OpenStreetMap).
  Konsekwencja jest już rozliczona w rozdziale 8: F2 wycofane z listy fosy, F1
  sprostowane. Nie odtwarzaj ich.

▸ NIE TWOJE — praca Jana, poza repo. Nie wykonuj jej i nie udawaj, że wykonałeś.
  Pomiar bazowy (Search Console + 40 promptów z Załącznika A) — NADAL NIEWYKONANY,
  po dwóch rundach. To znaczy, że wszystko powyżej wdrożono bez wartości wyjściowej.
  Dalej: trzy profile poza domeną (poz. 15), jeden kontakt tygodniowo o wzmiankę
  (poz. 22).

▸ ŹLE ZABLOKOWANE — tu jest cała treść tej rundy.
  Rozdział 2c nazywa problem fundamentalny: „bojo" to potoczne słowo znaczące
  „boisko", więc zapytanie markowe trafia w słownik, nie w produkt. Rozdział 5a
  podaje lekarstwo i wprost oddziela pola: alternateName i disambiguatingDescription
  opisują Bojo samo w sobie, sameAs wymaga cudzych profili („dopisać dopiero wtedy,
  gdy profile realnie istnieją").
  BACKLOG.md i wiersz 13 roadmapy spłaszczyły to w jedną pozycję zablokowaną na
  Janie. Zweryfikuj to sam i, jeśli potwierdzisz: dwa z trzech pól nie są zablokowane
  niczym, a nikt ich nie dopisał przez dwie rundy.
  To samo w 5e punkt 2: zdanie ujednoznaczniające w nagłówkach llms.txt
  i llm-context.md — proponowane w rundzie 1, nigdy niedopisane.

▸ RESZTKI do sprawdzenia (potwierdź w kodzie, część mogła zniknąć):
  - Hub sportu linkuje do miasta na sztywno: `/${params.sport}/poznan`
    w app/boiska/[sport]/page.tsx. Reszta D8 z rundy 1. Skutek: osiem z dwunastu
    stron sport+miasto (Warszawa, Kraków) nie ma wejścia z hubu, a człowiek szukający
    boisk w Krakowie dostaje link do Poznania.
  - Tabela roadmapy w rozdziale 9 ma wiersze zrobione, ale nieprzekreślone (m.in.
    1, 3–9), podczas gdy BACKLOG.md mówi o nich „zrobione". Dokładnie ten rozjazd
    plan/kod, dla którego powstał rozdział 0 — tym razem w samym dokumencie.
  - Znacznik „Stan na:" w llm-context.md deklaruje liczbę testów sprzed dwóch rund.
    check:docs waliduje wyłącznie numer migracji, więc reszta znacznika dryfuje po
    cichu.

TWARDE OGRANICZENIA TECHNICZNE — naruszenie kwalifikuje zmianę do kosza
- NIC liniowego względem katalogu przy buildzie (36 tys. obiektów; generateStaticParams
  raz już wywróciło build na 40+ minut). Nowe strony masowe: render na żądanie
  z revalidate.
- useSearchParams() wywala build produkcyjny na trasach prerenderowanych i NIE
  powtórzy się lokalnie na atrapach kluczy.
- Mobile-first bezwzględnie; breakpointy max-* zabronione (pilnuje check:docs, sekcja 10).
- RLS to jedyna realna granica dostępu — klucz anon jest jawny w paczce JS.
- Zmiana kodu pociąga aktualizację dokumentacji wg mapy w AGENTS.md; check:docs zielony.

REGUŁY DLA KAŻDEGO NAPISANEGO ZDANIA
- Zero języka marketingowego, zero list słów kluczowych. Keyword stuffing wypada
  najsłabiej ze wszystkich metod GEO (Aggarwal i in., KDD 2024).
- Żadnej liczby, której nie da się obronić; przy statystyce wskazujesz, skąd liczona.
- Żadnej frazy z zakazaneFrazy.ts w kontekście twierdzącym. Bojo nie rezerwuje boisk,
  nie wysyła SMS-ów ani maili o meczu, nie ma rankingów ani turniejów, nie awansuje
  automatycznie z rezerwy, nie obsługuje płatności online.
- Schema tylko dla treści widocznej na stronie.
- Ton uczciwy wobec wczesnego etapu — „Otwartych meczów bywa tu dziś niewiele"
  (content/graj.ts) jest wzorcem, nie wpadką.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ B — PRODUKCJA: DZIURA CIĄGNĄCA SIĘ OD RUNDY 1
═══════════════════════════════════════════════════════════════════════════════

Ani runda 1, ani runda 2 nie zobaczyły bojo.pl. Runda 1: polityka sieciowa blokowała
domenę. Runda 2: blokowała też rejestr obrazów Dockera, więc pełny stos lokalny
(scripts/stos-lokalny.sh, Postgres + GoTrue + PostgREST) też odpadł. Skutek zapisany
w rozdziale 0: strona obiektu i huby miejskie — czyli praktycznie cały indeksowalny
wolumen — są NIEZWERYFIKOWANE. Wszystko, co o nich wiemy, wiemy z lektury kodu.

Sprawdź na starcie, w tej kolejności, i zapisz wynik:

  curl -sS -o /dev/null -w "%{http_code}\n" https://bojo.pl/robots.txt
  docker run --rm hello-world

TRYB PEŁNY — jeśli bojo.pl odpowiada:
  node scripts/audyt-robota.mjs --baza https://bojo.pl --boisko <slug-realnego-obiektu>
  Do tego ręcznie, bez JavaScriptu, dla jednej strony obiektu i jednego huba miejskiego:
  czy w surowym HTML jest <h1>, opis, linki wewnętrzne, poprawny canonical i JSON-LD.
  To jest najcenniejsza rzecz, jaką ta runda może dostarczyć — cenniejsza niż
  którakolwiek zmiana w kodzie niżej.

TRYB PEŁNY B — jeśli bojo.pl nie odpowiada, ale Docker ciągnie obrazy:
  ./scripts/stos-lokalny.sh && cd frontend && npm run build && npm start
  node scripts/audyt-robota.mjs --boisko <slug>
  Prawdziwe dane, prawdziwy render, bez produkcji.

TRYB OKROJONY — jeśli oba odpadają:
  ./scripts/baza-testowa.sh                    # schemat + RLS, bez obrazów
  node scripts/audyt-robota.mjs --bez-bazy     # tylko trasy statyczne
  Powiedz WPROST, że strona obiektu i huby miejskie zostają NIEZWERYFIKOWANE, i nie
  pisz o nich niczego w trybie oznajmującym. Nie kombinuj z obejściami proxy.

REGUŁA: żadnego zdania „na produkcji działa" bez wklejonego wyniku przebiegu.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ C — ZADANIE: DWIE PARTIE I JEDNA DECYZJA
═══════════════════════════════════════════════════════════════════════════════

── PARTIA 1: DEZAMBIGUACJA MARKI ──────────────────────────────────────────────

Najpierw potwierdź w kodzie diagnozę z Części A: czy alternateName
i disambiguatingDescription faktycznie nie istnieją w lib/structuredData.ts, i czy
zdania ujednoznaczniającego faktycznie nie ma w nagłówkach llms.txt i llm-context.md.
Jeśli któreś zdążyło powstać — napisz to i pomiń.

Jeśli potwierdzisz, domknij oba miejsca:

1. lib/structuredData.ts, Organization: alternateName i disambiguatingDescription
   wg gotowego kodu z rozdziału 5a. sameAs ZOSTAW niedopisane, z komentarzem
   dlaczego — puste albo zmyślone sameAs jest gorsze niż jego brak, a profile to
   pozycja 15 (Jan). Test przypinający: pole istnieje i mówi o aplikacji, nie
   o boisku.
2. Nagłówki llms.txt i docs/llm-context.md: jedno zdanie wg 5e punkt 2. Potem
   npm run sync:llm-context, bo kopia publiczna musi się zgadzać.

Rozdziel w BACKLOG.md pozycję 13 na to, co zrobione teraz, i na sameAs czekające na
Jana — żeby następna runda nie zastała znowu jednej pozycji zablokowanej w całości
przez jedno pole z trzech.

Nie rozbudowuj przy okazji llm-context.md. Ma dziś dobrą strukturę i jest jedynym
plikiem w repo pisanym dokładnie tak, jak trzeba (5e punkt 3).

── PARTIA 2: RESZTKI ──────────────────────────────────────────────────────────

Każdą najpierw potwierdź w kodzie. Minimalna zmiana, komentarz mówiący DLACZEGO,
test tam, gdzie zachowania nie widać w interfejsie.

1. Zahardkodowany Poznań w linku z hubu sportu. Rozstrzygnij świadomie, czym go
   zastąpić: listą miast, dla których strona /[sport]/[miasto] realnie istnieje
   (content/miasta.ts), czy usunięciem linku. Link do strony, której nie ma, jest
   gorszy niż jego brak — ta sama zasada, którą kieruje się próg hubów miejskich.
2. Tabela roadmapy w rozdziale 9: przekreśl wiersze, które BACKLOG.md opisuje jako
   zrobione, z datami — konwencją już użytą w tym pliku. Odhaczaj WYŁĄCZNIE
   z dowodem (ścieżka i linia albo wynik przebiegu). Odhaczonego nie odhaczaj
   z powrotem; jeśli uważasz, że coś jest odhaczone niesłusznie, dopisz sprostowanie.
3. Znacznik „Stan na:" w llm-context.md — doprowadź do prawdy. Rozważ przy okazji,
   czy check:docs nie powinien walidować całego znacznika zamiast samego numeru
   migracji; jeśli tak, dopisz to sprawdzenie, bo inaczej ten sam dryf wróci.

Pozycji 28 (deduplikacja tabeli porównawczej na /dlaczego-bojo) NIE rób w tej rundzie,
chyba że zostanie Ci czas po Partii 1 i 2 — to przebudowa znacznika, nie treści,
i ma własny wiersz w roadmapie.

── DECYZJA: CZY DALEJ MA SENS ─────────────────────────────────────────────────

To nie jest partia z kodem. Oddaj pisemną ocenę, w rozdziale 9 strategii, pod tabelą.

Odpowiedz na jedno pytanie: czy po zamknięciu Partii 1 i 2 zostaje w tym repo
cokolwiek, co realnie podniesie widoczność Bojo — czy dalsza praca w kodzie jest już
optymalizowaniem czegoś, czego nikt nie mierzy i na co nikt nie wchodzi.

Uzasadnij liczbami, nie wrażeniem. Materiał masz: ile pozycji roadmapy zostało i czyje
są; ile obiektów w katalogu ma dowód aktywności wobec 36 tysięcy wierszy; ile wynosi
pomiar bazowy (zero — nie zmierzono go przez dwie rundy).

Jeśli wniosek brzmi „nie" — napisz to wprost i wskaż, co jest wtedy wąskim gardłem:
pomiar, encja poza domeną, czy po prostu brak organizatorów, przez który F1, F3 i F4
nie mają czego pokazać. Wniosek „nie" jest pełnoprawnym wynikiem tej rundy i nie
próbuj go obejść, wymyślając nowe typy stron.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ D — BRAMKA PRZED KAŻDYM PR-EM
═══════════════════════════════════════════════════════════════════════════════

  cd frontend
  npx tsc --noEmit
  npm run lint
  npm test
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
  cd .. && npm run check:docs
  node scripts/audyt-robota.mjs        # w najlepszym trybie dostępnym wg Części B

Build produkcyjny jest obowiązkowy — useSearchParams() wywraca WYŁĄCZNIE jego.

Z AGENTS.md, bez wyjątków: nie pushujesz na master (branch → PR → merge przy zielonym
CI); wszystkie poprawki dopchnięte PRZED otwarciem PR-a; migracja SQL w PR → napisane
wprost, że trzeba ją uruchomić ręcznie w Supabase; commity i PR-y po polsku; zmiana
widoczna dla użytkownika → wpis w docs/llm-context.md (PROBLEM / ROZWIĄZANIE BOJO /
MECHANIKA, limit 10 wpisów) i npm run sync:llm-context.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ E — ANTY-LISTA
═══════════════════════════════════════════════════════════════════════════════

1. Nie proponujesz niczego z listy ZROBIONE. Sprawdź w kodzie, zanim napiszesz
   „warto dodać".
2. Nie wracasz do pozycji 19 i 23 ani do F2 pod inną nazwą.
3. Nie dokładasz nowych typów stron. Roadmapa przewidziała dwa (kalkulator, huby
   miejskie), oba istnieją. Trzeci wymyślony po to, żeby mieć co robić, to ryzyko R1.
4. Nie dokładasz miast do /[sport]/[miasto].
5. Nie dodajesz Review ani AggregateRating — nie mamy recenzji.
6. Nie zakładasz bloga.
7. Nie dopisujesz sameAs, dopóki profile nie istnieją, i nie dopisujesz słów
   kluczowych nigdzie.
8. Nie zgadujesz polskiego SERP-u ani wolumenów fraz.
9. Nie wykonujesz pracy Jana i nie piszesz, że coś zmierzyłeś, jeśli tego nie
   zmierzyłeś.
10. Nie piszesz kolejnego dokumentu strategicznego. Aktualizujesz istniejący.
11. Nie rozdmuchujesz tej rundy, żeby wyglądała na większą. Dwa małe PR-y i trafna
    decyzja są pełnym wynikiem.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ F — CO ODDAJESZ
═══════════════════════════════════════════════════════════════════════════════

Dwa PR-y (Partia 1, Partia 2), każdy z opisem po polsku: co się zmieniło, dlaczego,
czym zweryfikowane, co zostaje niezweryfikowane i kto ma to domknąć.

Aktualizacja docs/seo-geo-strategia.md: wynik weryfikacji produkcji w rozdziale 0
i w „Czego nie sprawdziłem", tabela roadmapy w rozdziale 9, oraz decyzja pod tabelą.
Aktualizacja BACKLOG.md §7b, z rozdzieleniem pozycji 13.

Na koniec, w jednym akapicie i bez uprzejmości: co z tego wszystkiego było warte
zachodu, a co było ruchem pozornym — i co zrobiłbyś jako pierwsze, gdyby to był Twój
produkt i Twoje pieniądze.
````
