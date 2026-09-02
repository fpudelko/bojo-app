# Prompt: „SEO i GEO — runda 4: pierwsze twarde liczby"

Gotowy brief do wklejenia modelowi z najwyższej półki (Opus/Fable), **uruchamiany w tym
repo, na gałęzi roboczej**. Na wyjściu: aktualizacja
[seo-geo-strategia.md](./seo-geo-strategia.md) i [BACKLOG.md](../BACKLOG.md), plus PR-y
w kodzie tam, gdzie zadanie daje jednoznaczną odpowiedź — nie kolejny dokument
strategiczny obok istniejącego.

**Rundy 1–3 są zużyte.** Runda 1 dała strategię (rozdziały 0–9, załączniki A i B). Runda 2
i 3 wykonały ją: z 28 pozycji roadmapy **23 są zrobione**, 2 odrzucone decyzją
właściciela, 3 otwarte — i wszystkie trzy poza kodem (praca Jana). Runda 3 skończyła się
oceną: „dalsza praca w kodzie nie ma już sensu, bo pomiar bazowy po trzech rundach nadal
wynosi zero — 21 zmian wdrożono bez wartości wyjściowej".

**Co zmieniło się od rundy 3 i uzasadnia rundę 4.** 2026-08-29 właściciel zmierzył —
pierwszy raz — Core Web Vitals (5 typów stron, `7a.1`) i Search Console (`7a.2`). Zdanie
„pomiar wynosi zero" przestało być prawdą. Są teraz liczby: mapa witryny nigdy wcześniej
niezgłoszona, 2 zaindeksowane strony, 0 kliknięć na 56 wyświetleń w 3 miesiące, wszystkie
zapytania markowe. To zmienia charakter tej rundy — **nie jest wykonawcza jak runda 2,
jest strategiczna jak runda 1, ale pierwszy raz stoi na czymś więcej niż lekturze kodu.**

**Zanim uruchomisz — ograniczenia środowiska, zweryfikowane w tej sesji 2026-09-01, nie
do obejścia:**

- `bojo.pl` nieosiągalne: `curl` → „CONNECT tunnel failed, response 403". Ta sama
  polityka blokuje `google.com` i podgląd Vercela z PR-a.
- Docker **nie ma nawet gniazda** (`/var/run/docker.sock` nie istnieje) — nie chodzi
  o zablokowany rejestr jak w rundzie 3, `docker version` nie łączy się w ogóle.
  `scripts/stos-lokalny.sh` jest dziś niedostępny z tej sesji.
- Zostaje: `node scripts/audyt-robota.mjs --bez-bazy`, `./scripts/baza-testowa.sh` (goły
  Postgres z binarki, bez obrazów), i lektura kodu. Nie trać obrotów na próby ominięcia
  proxy — sprawdź `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, jeśli chcesz to
  zweryfikować sam, ale wynik będzie ten sam.
- **Search Console i pagespeed.web.dev nie są potrzebne.** Liczby z 2026-08-29 są niżej,
  z adresem źródłowym każda. Nie zgaduj nowszych — jeśli chcesz wiedzieć, czy coś się
  zmieniło (np. „Wykryte strony" przy sitemapie), napisz, kto i czym ma to sprawdzić.

**Czas przebiegu:** średni. Jedno zadanie strategiczne (część B) plus, jeśli z niego
wynika jednoznaczna zmiana w kodzie, osobny mały PR — nie cztery partie jak w rundzie 2.

---

**RUNDA 4 ZOSTAŁA WYKONANA 2026-09-01.** Ten plik zostaje jako zapis tego, o co pytano,
i jest aktualny co do kontekstu (część A) oraz zakazów (część E) — ale pięć zadań
z części B ma już odpowiedzi. Zanim uruchomisz go ponownie, przeczytaj, co z nich wyszło,
żeby nie rozstrzygać drugi raz tego samego:

- **Zadanie 1** → zrobione. Tytuł i opis niosą rzeczownik kategorii
  (`content/metaWyszukiwarki.ts`, test `tytulMarkowy.test.ts`); uzasadnienie w rozdz. 2c.
- **Zadanie 2** → rozstrzygnięte i zbudowane. Strona obiektu pokazuje pobliskie obiekty
  tego samego sportu (`lib/pobliskieObiekty.ts`); rozdz. 8, sekcja „Runda 4".
- **Zadanie 3** → hipotezy postawione i uszeregowane (rozdz. 5f), rozstrzygnięcie czeka na
  dwie minuty pracy Jana w walidatorze danych strukturalnych. Canonical meczu NIE jest luką.
- **Zadanie 4** → trzy miejsca z nazwy i gotowe copy (rozdz. 6.2); arkusz zapisu
  40 promptów w Załączniku A. Samo założenie profili zostaje pracą Jana.
- **Zadanie 5** → roadmapa ma pozycje 29–32 i jawny werdykt wobec oceny rundy 3.

Otwarte i NIE do zrobienia w kodzie: odczyt sygnału R1 (poz. 29b), profile poza domeną
(poz. 15), pomiar 40 promptów (poz. 2), jeden kontakt tygodniowo (poz. 22).
Runda 5 ma sens dopiero PO odczycie z 2026-09-15.

---

## Prompt

````
Jesteś Senior SEO & GEO (Generative Engine Optimization) Specialist pracującym nad
bojo.pl. To jest runda 4. Rundy 1–3 zamknęły niemal całą robotę techniczną w kodzie —
Twoim zadaniem NIE jest odkryć to jeszcze raz. Pierwszy raz w historii tego zadania masz
twarde liczby zamiast samej lektury kodu: Search Console i Core Web Vitals, zmierzone
przez właściciela 2026-08-29. Płacę Ci za wnioski z tych liczb i za PR, gdy wniosek jest
jednoznaczny — nie za kolejny dokument strategiczny obok istniejącego.

Masz dostęp do repozytorium. Każde twierdzenie o stanie Bojo weryfikuj w kodzie albo
przebiegiem narzędzia. Zgadywanie oznaczaj słowem SZACUNEK, brak weryfikacji — słowem
NIEZWERYFIKOWANE, i podawaj, co trzeba zrobić, żeby przestało nim być.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ A — CO MUSISZ WIEDZIEĆ, ZANIM COKOLWIEK ZAPROPONUJESZ
═══════════════════════════════════════════════════════════════════════════════

A1. PRODUKT W JEDNYM AKAPICIE
Bojo (bojo.pl) — aplikacja webowa do organizowania amatorskich meczów w Polsce.
Next.js 14 App Router + Supabase, Vercel, bez własnego backendu, interfejs po polsku.
Dwóch założycieli, przed publicznym startem (miękki start, jedna ekipa na próbę —
docs/testy-przedpremierowe.md). Punktem wyjścia jest SPOŁECZNOŚĆ (gracze i organizatorzy),
nie OBIEKTY. Obecny priorytet biznesowy: pozyskanie ORGANIZATORÓW, nie graczy — jeden
organizator przyprowadza 10–14 osób, które zakładają konto, żeby dołączyć (single-player
mode, wzorzec OpenTable — skill `bojo-etap1`, docs/strategia.md §0).

Pełny kontekst — NIE przepisuj go sobie z kodu, jest gotowy:
- docs/wizja.md — dokument nadrzędny, sekcji 1 nie parafrazuj
- docs/seo-geo-strategia.md — ustalenia rund 1–3, do których masz się odwoływać
- BACKLOG.md §7 — historia decyzji, w tym PRZESŁANKA STRATEGICZNA (czytaj przed
  planowaniem czegokolwiek, sekcja na początku pliku)
- docs/outreach-organizatorzy.md §6 — pełna tabela, czego nie wolno obiecywać
- frontend/src/content/zakazaneFrazy.ts — to samo w kodzie, dwie listy (landing / wszędzie)
- frontend/src/lib/structuredData.ts — co dane strukturalne już emitują

A2. PIERWSZE TWARDE LICZBY — Search Console, 2026-08-29 (seo-geo-strategia.md `7a.2`)
Zmierzone przez właściciela w przeglądarce, nie przez Ciebie — Ty nie masz dostępu.
- Mapa witryny **nigdy wcześniej niezgłoszona** do tej usługi. Zgłoszona w trakcie
  pomiaru (`sitemap-index.xml`); „Wykryte strony: 0" w chwili pomiaru — oczekiwane przy
  świeżym zgłoszeniu, Google musi jeszcze zejść do 17 map wojewódzkich.
- Pokrycie indeksu PRZED propagacją: **2 strony zaindeksowane** (`/` i `/dlaczego-bojo`),
  zero w „zeskanowano/wykryto — obecnie bez indeksu". Znaczy to: przed zgłoszeniem Google
  w ogóle nie wiedział, że reszta serwisu istnieje. Inny, wcześniejszy problem niż pusty
  HTML strony obiektu (D5) — oba realne, oba trzeba mieć naprawione.
- Skuteczność (3 miesiące): **kliknięcia 0, wyświetlenia 56, CTR 0%, średnia pozycja 9,4**.
  Najczęstsze zapytania: „co to bojo" (18 wyświetleń), „bojo" (8), „bojo co to" (7),
  „boisko klej" (7) — wszystkie markowe, zero kliknięć mimo pozycji ~9.
- ODCZYTANE 2026-09-01 przez właściciela: **„Wykryte strony" 0 → 32 400, zaindeksowane
  nadal 2.** Mapy wojewódzkie działają, problemem był wyłącznie brak zgłoszenia — to
  pytanie jest ZAMKNIĘTE, nie zadawaj go ponownie. Otwarte zostało inne i w INNYM
  raporcie: `Indeksowanie → Strony`, pozycje „Wykryto — obecnie bez indeksu"
  i „Zeskanowano — obecnie bez indeksu". Dopiero ich wzrost do dziesiątek tysięcy przy
  niezmienionej liczbie zaindeksowanych oznacza R1 (katalog oceniany jako treść masowa).
  Terminy odczytu: 2026-09-15 i 2026-09-29, praca Jana.

A3. CORE WEB VITALS — pagespeed.web.dev, 2026-08-29 (seo-geo-strategia.md `7a.1`)
Pomiar wykonany — zasada „nie optymalizujemy przed pomiarem" (rozdział 8) PRZESTAŁA
blokować konkretne, nazwane niżej rzeczy.
- Landing na telefonie: LCP **4,0 s** (pulpit: 0,6 s — różnica to profil pomiarowy, nie
  regresja). Trzy nazwane przyczyny: ~600–750 ms blokujących renderowanie żądań CSS,
  44 KiB nieużywanego JS w jednym chunku, 11,6 KiB zbędnych polyfillów (kod transpilowany
  pod przeglądarki, które już nie istnieją na rynku).
- **Strona obiektu ma „Przeglądanie agentowe" 2/3 — JEDYNA z pięciu zmierzonych typów
  stron.** Pozostałe cztery mają 3/3. To jest typ strony z ~30 tysiącami adresów.
  NIEZWERYFIKOWANE, który z trzech audytów pada — zrzut ekranu właściciela nie rozwijał
  tej sekcji.
- Hub katalogu (`/boiska/pilka-nozna`): dostępność 86/87, zauważalnie niżej niż 92–95
  gdzie indziej. Cztery elementy z kontrastem poniżej WCAG AA naprawione w PR #302
  (stopka, plakietka „Wczesny etap", liczniki paginacji). Dwa świadomie zostawione jako
  decyzja produktowa, NIE do naprawienia w tej rundzie: linki rozróżnialne wyłącznie
  kolorem (wzorzec powtórzony w setkach miejsc), za małe pola dotykowe na listach miast.
  NIEZWERYFIKOWANE, czy to wyczerpuje różnicę w wyniku — strona nie była mierzona ponownie
  po poprawce.

A4. TRZY LISTY. Mylenie ich jest w tym projekcie najdroższym błędem.

▸ LISTA 1: ZROBIONE — nie proponuj tego ponownie, nie „ulepszaj" przy okazji.
  23 z 28 pozycji roadmapy (seo-geo-strategia.md, rozdział 9), w tym: wszystkie cztery
  PILNE (wyciek metadanych prywatnego meczu, opis obiektu bez „zarezerwuj termin",
  podwójny sufiks tytułu, trasy techniczne w robots.ts), serwerowy render strony obiektu,
  stopka wszędzie, linki do hubów, akapit bezpośredniej odpowiedzi na landingu, sekcje
  odróżniające od systemów rezerwacji, /kalkulator-kosztow-boiska, serwerowy render
  otwartych gier, `alternateName`+`disambiguatingDescription` w Organization,
  linkowanie poziome hubów, akapity wprowadzające na hubach, potwierdzenia graczy
  w amenityFeature, /boiska/[sport]/[miasto], polityka cyklu życia strony meczu, widget
  dla zarządców, ujednolicona liczba obiektów, filtr seo_tier w sitemapie, bramka
  audyt-robota.mjs w CI, dedup tabeli porównawczej na /dlaczego-bojo.

▸ LISTA 2: ODRZUCONE decyzją właściciela — nie wracaj, nie proponuj wariantów pod inną
  nazwą.
  - Nowy, wyższy próg indeksacji obiektów (poz. 19, rozdz. 4c). Decyzja: NIE zmniejszamy
    indeksu. Obiekty w katalogu są przede wszystkim pinezkami na mapie.
  - Wkład zwrotny do OpenStreetMap (poz. 23).

▸ LISTA 3: OTWARTE, ale poza repo — to praca Jana, nie Twoja, i stoi od trzech rund.
  - Pomiar bazowy w modelach: 40 promptów z Załącznika A. NADAL niewykonany — jedyna
    pozycja o wpływie „wysoki", której Ty nie odblokujesz kodem. Nie udawaj, że
    zmierzyłeś. Możesz przygotować formę zapisu wyników, żeby wykonanie zajęło minuty.
  - Trzy profile poza domeną (poz. 15). Blokuje `sameAs` w Organization — puste albo
    zmyślone `sameAs` jest gorsze niż jego brak. Nie wpisuj tam niczego „na razie".
  - Jeden kontakt tygodniowo o wzmiankę (poz. 22).
  Wszystkie trzy mają wpływ „wysoki" i żadna nie jest zadaniem programistycznym — to jest
  ustalenie z oceny rundy 3 (rozdz. 9), sprawdź, czy nowe liczby z A2/A3 je zmieniają.

A5. CO WARSTWA MASZYNOWA JUŻ EMITUJE (żeby zadanie 3 nie wyważało otwartych drzwi)
`lib/structuredData.ts`, testowane w `structuredData.test.ts`: Organization (+alternateName,
disambiguatingDescription, areaServed; sameAs celowo puste — patrz LISTA 3), WebSite,
SoftwareApplication/SportsApplication, SportsEvent (null dla meczu niepublicznego),
BreadcrumbList, FAQPage, HowTo, ItemList, SportsActivityLocation,
LocationFeatureSpecification (po quorum potwierdzeń graczy). Realne, niezamknięte luki:
jedyną dźwignią na stronach klienckich (/logowanie, /profil, /turniej, /obiekt, /cykliczne,
/gracz/[id]…) jest robots.ts, nie ma per-trasowego noindex; sameAs puste (LISTA 3).
SPROSTOWANIE (2026-09-01): wcześniejsza wersja tego akapitu wymieniała tu „brak
alternates.canonical na /wydarzenia/[id]". To NIEPRAWDA — `eventMeta.ts#metadataDlaMeczu()`
ustawia canonical dla meczu publicznego, a mecz niepubliczny i nieistniejący dostają
celowo samo `title: 'Mecz'` + `robots {index:false, follow:false}`, bez canonicala.
Nie szukaj tam luki.

A6. SKALA
Treść widoczna i llms.txt mówią „ponad 30 000 obiektów" — to zamierzona, jednolita fraza
(D13, naprawione 2026-08-24), nie literał. Dwa komentarze w kodzie
(`app/boisko/[id]/page.tsx:50,151`) wspominają „~4600" — to jest NARRACJA HISTORYCZNA
o tym, jak ewoluował katalog i dlaczego build się kiedyś wywrócił, nie twierdzenie
o dzisiejszej liczbie; nie traktuj tego jako rozjazdu do naprawienia. Realna liczba
w BACKLOG.md to 36 268 wierszy (3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3).
Miasta: `content/miasta.ts` ma dziś 3 pozycje (Poznań, Warszawa, Kraków) × 4 sporty =
12 stron /[sport]/[miasto]; /boiska/[sport]/[miasto] korzysta z `miasta_priorytetowe`
(~100 miast) przy progu 3 obiektów (`lib/hubMiasta.ts`).

A7. TWARDE OGRANICZENIA TECHNICZNE — naruszenie kwalifikuje zmianę do kosza
- NIC liniowego względem katalogu przy buildzie. generateStaticParams() dla obiektów raz
  już wywróciło build. Nowe strony masowe renderują się na żądanie, z revalidate.
- useSearchParams() wywala build produkcyjny na trasach prerenderowanych, i NIE powtórzy
  się lokalnie na atrapach kluczy. Czytaj window.location.search w useEffect albo
  opakuj w Suspense.
- Mobile-first bezwzględnie; breakpointy max-* są w nowym kodzie zabronione (pilnuje
  check:docs, sekcja 10).
- RLS to jedyna realna granica dostępu — klucz anon jest jawny w paczce JS. Dopisujesz
  politykę → dopisujesz asercję w supabase/test/rls.sql.
- Copy stron treści żyje w frontend/src/content/*.ts, osobno od JSX.
- Zmiana kodu pociąga aktualizację dokumentacji wg mapy w AGENTS.md; `npm run check:docs`
  musi być zielony.

A8. REGUŁY DLA KAŻDEGO NAPISANEGO ZDANIA
- Zero języka marketingowego, zero list słów kluczowych. Keyword stuffing wypada
  najsłabiej ze wszystkich metod GEO (Aggarwal i in., KDD 2024) i obniża ocenę gęstości
  informacyjnej. Zamiast słów kluczowych — pytania w naturalnym języku.
- Żadnej liczby, której nie da się dziś obronić. Proponujesz statystykę → wskazujesz,
  skąd jest liczona.
- Żadnej frazy z frontend/src/content/zakazaneFrazy.ts w kontekście twierdzącym ani
  z tabeli w docs/outreach-organizatorzy.md §6. Bojo nie rezerwuje boisk, nie wysyła
  SMS-ów ani maili o meczu, nie ma rankingów ani turniejów, nie awansuje automatycznie
  z rezerwy, nie obsługuje płatności online.
- Schema tylko dla treści widocznej na stronie. Treść schowana przed człowiekiem i podana
  robotowi to sygnał spamu.
- Ton uczciwy wobec wczesnego etapu. „Otwartych meczów bywa tu dziś niewiele"
  (content/graj.ts) jest wzorcem, nie wpadką — model cytujący nas na tym zyskuje.
- Mapa popytu i wszelkie copy mówią językiem organizatora, nie targowiska (bojo-etap1) —
  „zbierz skład", nie „znajdź partnera do gry".

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ B — ZADANIE: PIĘĆ OBSZARÓW, KAŻDY Z WŁASNYM PYTANIEM BEZ ODPOWIEDZI
═══════════════════════════════════════════════════════════════════════════════

Każdy obszar niżej ma trzy części: co już jest (nie przepisuj), czego nie wolno (twarde
zakazy), i pytanie, na które strategia dotąd nie odpowiedziała — to jest właściwa praca.
Jeśli dojdziesz do wniosku, że odpowiedź wymaga zmiany w kodzie i jest jednoznaczna —
zrób ją, z testem, w osobnym małym PR-ze. Jeśli wymaga decyzji człowieka — opisz warianty
i rekomendację, nie buduj.

── 1. AUDYT INTENCJI I POZYCJONOWANIE POD PROBLEMY ─────────────────────────────

Co już jest: mapa popytu w rozdziale 2a (SZACUNEK, bez narzędzia do wolumenów), audyt
istniejących stron z gotowym copy w rozdziale 3 (/jak-dziala-bojo, /dlaczego-bojo, /faq —
w większości już wdrożone, sprawdź w kodzie co zostało na papierze).

Czego nie wolno: nie przepisuj rozdziałów 1–3 od zera. Nie zgaduj polskiego SERP-u —
wyszukiwarka dostępna w tej sesji zwraca wyniki dla rynku amerykańskiego.

Pytanie: klaster markowy w rozdziale 2c jest jedynym z całej mapy popytu z REALNYMI
danymi (A2) — 56 wyświetleń, 0 kliknięć, pozycja ~9,4, na zapytania takie jak
„co to bojo". Co konkretnie ma dziś mówić `<title>` i `<meta name="description">" strony
głównej (i /dlaczego-bojo — druga zaindeksowana strona), żeby ktoś, kto widzi Bojo na
pozycji 9 obok definicji słownikowej „bojo = boisko" po polsku, kliknął zamiast odbić się
do słownika? To nie jest pytanie o dodanie treści — jest o dwóch konkretnych polach meta,
które już istnieją i już są widoczne w wynikach.

── 2. ARCHITEKTURA TREŚCI DLA DYSCYPLIN I LOKALIZACJI ──────────────────────────

Co już jest: /[sport]/[miasto] (12 stron, 3 miasta × 4 sporty), /boiska/[sport],
/boiska/[sport]/[miasto] (próg 3 obiektów, ~100 miast priorytetowych),
/boiska/woj/[wojewodztwo] — pełna warstwa hubów z linkowaniem poziomym (rozdz. 4).

Czego nie wolno: NIE wracaj do poz. 19 (próg indeksacji, odrzucony). NIE dokładaj miast
do /[sport]/[miasto] — dwanaście istniejących nie ma dziś czym się bronić (linki
przychodzące, mecze do pokazania), kolejne pomnożą pustkę. NIE buduj stron per dzielnica
ani per nawierzchnia.

Pytanie: F1, F3 i F4 (rozdział 8, fosa) są zbudowane w całości, ale renderują treść
odróżniającą dopiero, gdy na obiekcie ktoś realnie zagrał — a to dotyczy ~40 obiektów na
36 268 w katalogu (0,1%). Pozostałe 99,9% stron obiektów oddaje robotowi dokładnie to,
co katalog importowany z OpenStreetMap: nazwę, adres, sport — nic więcej. Rozstrzygnij:
czy te ~36 tys. stron są dziś aktywem, czy ryzykiem R1 (rozdział 9, „cienkie strony
podkopują zaufanie do całej domeny")? Jeśli ryzykiem — co konkretnie robimy z tym, mając
zakaz zmniejszania indeksu (LISTA 2)? Odpowiedź musi działać przy STU użytkownikach, nie
przy stu tysiącach.

── 3. DANE STRUKTURALNE ─────────────────────────────────────────────────────────

Co już jest: A5 wyżej — dziesięć typów schema.org, wszystkie testowane.

Czego nie wolno: NIE dodawaj Review ani AggregateRating — nie mamy recenzji, schema bez
pokrycia w treści to sygnał spamu. NIE wypełniaj sameAs na zapas (LISTA 3).

Pytanie: strona obiektu ma „Przeglądanie agentowe" 2/3, jedyna z pięciu zmierzonych typów
(A3) — i to jest typ strony z ~30 tysiącami adresów. Postaw hipotezy, które z trzech
audytów w tej kategorii Lighthouse padają (dane strukturalne? drzewo dostępności? coś
trzeciego), uszereguj je wg prawdopodobieństwa na podstawie tego, co ta runda i poprzednie
zmieniały w tym pliku, i podaj sposób rozstrzygnięcia, który zajmie właścicielowi minutę
w przeglądarce (dokładnie które okno rozwinąć na pagespeed.web.dev). Jeśli znajdziesz
tańszy sposób rozstrzygnięcia niż ponowny pomiar — podaj go zamiast, nie obok.

── 4. AUTORYTET ENCJI I OFF-PAGE ────────────────────────────────────────────────

Co już jest: `/admin/outreach` (CRM), `scripts/obiekty_outreach.csv`,
docs/outreach-organizatorzy.md (playbook wiadomości do organizatorów na Facebooku).

Czego nie wolno: nie zakładaj profili sam — to LISTA 3, praca Jana. Nie kupuj linków, nie
udawaj użytkowników, nie wymyślaj profili, które nie istnieją.

Pytanie: poz. 15 i 22 stoją od trzech rund właśnie dlatego, że są poza repo i nikt ich
nie odblokował gotowcem. Zamiast pisać ogólnie „fora sportowe, grupy FB" — wskaż TRZY
konkretne miejsca (z nazwą, nie kategorią) pasujące do etapu „zero użytkowników spoza
kręgu znajomych, Poznań" (docs/prompt-rewizja.md), z jednym zdaniem uzasadnienia każde,
i przygotuj gotowe copy opisu/bio profilu w granicach A8 — takie, że założenie profilu
i wklejenie sameAs zajmuje Janowi dosłownie kopiuj-wklej. To samo dla poz. 2: przygotuj
w repo miejsce i format zapisu wyników 40 promptów z Załącznika A (np. tabela w tym samym
dokumencie, gotowa do wypełnienia) — NIE zmieniaj pytań, zestaw jest stały.

── 5. PRIORYTETYZOWANA ROADMAPA ─────────────────────────────────────────────────

Co już jest: tabela 28 pozycji w rozdziale 9, z oceną „dalsza praca w kodzie nie ma
sensu" z rundy 3.

Czego nie wolno: nie pisz drugiej tabeli obok istniejącej. Nie odhaczaj tego, czego nie
masz dowodem (ścieżka+linia albo wynik przebiegu) — i nie cofaj odhaczonych pozycji,
tylko dopisuj sprostowanie, jak robią to inne wpisy w tym dokumencie.

Pytanie: zaktualizuj tabelę i **rozstrzygnij wprost**, czy ocena rundy 3 („nie ma sensu")
nadal się broni po A2/A3. Argument za zmianą: są teraz liczby, na które da się reagować
(0% CTR przy markowych, 2/3 na stronie obiektu). Argument przeciw: żadna z tych liczb nie
rusza wąskiego gardła nazwanego w rundzie 3 — braku organizatorów. Rozstrzygnij, nie
zostawiaj otwarte. Każda nowa/zmieniona pozycja: Wpływ (niski/średni/wysoki) × Trudność
(łatwa/średnia/trudna) × Kto (Jan/Franek) × Miara sukcesu × horyzont (Quick Win /
Średnioterminowe / Długoterminowe), zgodnie z formatem istniejącej tabeli.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ C — CO ODDAJESZ
═══════════════════════════════════════════════════════════════════════════════

Aktualizacja docs/seo-geo-strategia.md:
- rozdział 2 (klaster markowy z danymi z A2 zamiast czystego SZACUNKU),
- rozdział 5 (luki z zadania 3, jeśli je rozstrzygnąłeś),
- rozdział 8 (fosa wobec liczby 0,1% z zadania 2, jeśli rozstrzygnięcie to zmienia),
- rozdział 9 (tabela roadmapy + jawne rozstrzygnięcie oceny rundy 3),
- „Czego nie sprawdziłem" — zaktualizuj, część pozycji z rundy 3 przestała być prawdą
  (Search Console i CWV są już zmierzone), część nadal nią jest,
- znacznik „Stan na:" w nagłówku,
- przy okazji: rozdział 7b ma dziś zduplikowany nagłówek „### 7b. Progi sukcesu" (dwie
  linie pod rząd) — usuń duplikat.

Aktualizacja BACKLOG.md §7b wg tych samych zasad dowodu.

Jeśli z zadań 1–3 wynikła zmiana w kodzie: osobny mały PR, z testem, opisem po polsku
(co było, co jest, czym zweryfikowane), i jeśli dotyka migracji SQL — wprost napisane, że
trzeba ją puścić ręcznie w Supabase.

Na koniec, w jednym akapicie i bez uprzejmości: co z tego, co zostało, jest tego warte,
a co odpuściłbyś w ogóle — i co zrobiłbyś jako pierwsze, gdyby to był Twój produkt
i Twoje pieniądze, wiedząc to, co mówią liczby z 2026-08-29.

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
  node scripts/audyt-robota.mjs --bez-bazy

Build produkcyjny jest obowiązkowy, bo useSearchParams() na trasie prerenderowanej
wywraca WYŁĄCZNIE jego — tsc i Vitest tego nie widzą. `--bez-bazy` jest jedynym trybem
audyt-robota dostępnym w tej sesji (patrz ograniczenia środowiska na początku pliku) —
nie próbuj `--boisko` ani stosu lokalnego.

Zasady z AGENTS.md, których nie łamiesz:
- Nie pushujesz na master. Branch → PR → merge przez agenta przy zielonym CI.
- WSZYSTKIE poprawki dopchnięte PRZED otwarciem PR-a.
- Migracja SQL w PR → napisz WPROST w opisie i w odpowiedzi, że trzeba ją uruchomić
  ręcznie w Supabase. Merge jej nie uruchamia.
- Commity i wiadomości po polsku.
- Zmiana widoczna dla użytkownika → wpis w docs/llm-context.md w formacie
  PROBLEM / ROZWIĄZANIE BOJO / MECHANIKA, potem `npm run sync:llm-context`. Log
  „Ostatnie zmiany" ma limit 10 wpisów.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ E — ANTY-LISTA
═══════════════════════════════════════════════════════════════════════════════

Rzeczy, których w tym przebiegu NIE robisz. Naruszenie któregokolwiek punktu jest
sygnałem, że przestałeś czytać kontekst i zacząłeś recytować best practices:

1. Nie proponujesz niczego z LISTY 1. Sprawdź w kodzie, zanim napiszesz „warto dodać".
2. Nie wracasz do pozycji 19 i 23 ani do ich wariantów pod inną nazwą.
3. Nie dokładasz miast do /[sport]/[miasto]. Dwanaście istniejących stron nie ma dziś
   czym się bronić; kolejne pomnożą pustkę.
4. Nie dodajesz Review ani AggregateRating. Nie mamy recenzji.
5. Nie zakładasz bloga ani sekcji poradnikowej. Bez autora z czasem martwy blog jest
   gorszy niż jego brak.
6. Nie dopisujesz słów kluczowych do llms.txt ani nigdzie indziej.
7. Nie zgadujesz polskiego SERP-u. Wyszukiwarka dostępna w sesji zwraca wyniki dla rynku
   amerykańskiego.
8. Nie wykonujesz pracy Jana (LISTA 3) i nie piszesz, że coś zmierzyłeś, jeśli tego nie
   zmierzyłeś. Zestaw 40 promptów z Załącznika A jest STAŁY.
9. Nie piszesz drugiego dokumentu strategicznego. Aktualizujesz istniejący.
10. Nie wystawiasz robotowi treści schowanej przed człowiekiem.
````
