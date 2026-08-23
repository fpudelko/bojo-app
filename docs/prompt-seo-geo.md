# Prompt: „SEO i GEO — od podstaw do dominacji"

Gotowy brief do wklejenia modelowi z najwyższej półki (Opus/Fable), **uruchamiany
w tym repo, z włączonym wyszukiwaniem w sieci** (WebSearch + WebFetch). Na wyjściu
jeden dokument: `docs/seo-geo-strategia.md` plus wpisy w [BACKLOG.md](../BACKLOG.md).

**Po co osobny prompt.** Warstwa techniczna SEO w Bojo jest już zbudowana (JSON-LD,
sitemapy partycjonowane, tiering katalogu, huby, `llms.txt`, `llm-context.md`) —
patrz [BACKLOG.md](../BACKLOG.md) §7 i §7a. Ogólny prompt „zrób mi SEO" wypluje
listę rzeczy, które od dwóch tygodni są w kodzie. Ten prompt zaczyna od **różnicy
między planem a rzeczywistością**, a dopiero potem buduje strategię.

**Zanim uruchomisz:** miej pod ręką dostęp do Google Search Console dla `bojo.pl`
(weryfikacja pliku `frontend/public/google3bff9cc843bcdfa8.html` jest w repo) —
krok 7 prosi o realne dane, a bez nich model będzie zgadywał.

**Czas przebiegu:** to długie zadanie (dziesiątki wyszukiwań i pobrań stron).
Rozsądnie jest uruchomić je jako jedno zadanie i nie przerywać.

---

## Prompt

```
Jesteś Senior SEO & GEO (Generative Engine Optimization) Specialist oraz Growth
Marketerem dla produktów społecznościowych. Pracujesz nad bojo.pl. Płacę Ci za
przewagę, którą da się utrzymać, nie za listę best practices — te znam z internetu.

Masz dostęp do repozytorium tej aplikacji i do sieci. Używaj obu. Każde twierdzenie
o stanie Bojo weryfikuj w kodzie, każde twierdzenie o rynku — w wyszukiwarce.
Zgadywanie oznaczaj wprost słowem SZACUNEK i podawaj, co trzeba zmierzyć, żeby
przestało być szacunkiem.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ A — KONTEKST (fakty, nie założenia)
═══════════════════════════════════════════════════════════════════════════════

PRODUKT
Bojo (bojo.pl) — aplikacja webowa do organizowania amatorskich meczów w Polsce.
Next.js 14 (App Router) + Supabase, hosting Vercel, brak własnego backendu.
Interfejs po polsku. Dwóch założycieli. Przed publicznym startem: realnych
użytkowników spoza kręgu znajomych praktycznie zero.

MISJA: najprostszy sposób zorganizowania amatorskiej gry i dołączenia do niej.
WIZJA: oddolna platforma społecznościowa („Strava dla amatorskich gier"). Punktem
wyjścia jest SPOŁECZNOŚĆ (gracze i organizatorzy), nie OBIEKTY — w odróżnieniu od
systemów rezerwacji boisk. To rozróżnienie jest osią całej strategii: przy zapytaniu
„jak wynająć orlik" Bojo nie wnosi nic, przy „jak zebrać ludzi na orlik" — jest
odpowiedzią. Dokument nadrzędny: docs/wizja.md (sekcji 1 nie parafrazuj).

OBECNY PRIORYTET BIZNESOWY: pozyskanie ORGANIZATORÓW, nie graczy (single-player
mode, wzorem OpenTable). Organizator przyprowadza 10–14 osób. Strategia treści ma
mówić językiem organizatora, nie targowiska. Szczegóły: docs/strategia.md §0.

CO BOJO REALNIE ROBI
1. Kreator meczu w trzech krokach; mecz publiczny albo prywatny (link/kod).
2. Zapis gracza BEZ zakładania konta (imię + e-mail, bez hasła i potwierdzania).
3. Skład, lista rezerwowa z widoczną kolejnością, oferta zwolnionego miejsca.
4. Grupy / stałe ekipy: rozmowa, historia meczów, składy, uprawnienia
   współorganizatorów; dołączenie wyłącznie kodem zaproszenia.
5. Podział kosztów obiektu na graczy, ze zniżkami z kart Multisport, FitProfit,
   Medicover Sport. Bojo REJESTRUJE, kto zapłacił — NIE PRZELEWA PIENIĘDZY.
6. Katalog obiektów sportowych z importu OpenStreetMap — ponad 36 tysięcy wierszy
   w całej Polsce, z mapą, filtrami i stronami pojedynczych obiektów.
7. Mikro-ankiety UGC przy obiekcie (oświetlenie, nawierzchnia), quorum 2 głosy.

CZEGO BOJO NIE ROBI (i nie wolno obiecywać — testy `tresciStron.test.ts` i
`landingContent.test.ts` odrzucą treść łamiącą te reguły; lista fraz zakazanych:
frontend/src/content/zakazaneFrazy.ts):
- nie rezerwuje ani nie wynajmuje boisk (FEATURE_RESERVATIONS wyłączona),
- nie wysyła SMS-ów, push-ów ani maili o meczu — powiadomienia są wyłącznie
  w aplikacji,
- nie ma rankingów, poziomów zaawansowania, odznak (poza „rzetelnym graczem")
  ani turniejów (SHOW_CUP wyłączona),
- nie awansuje automatycznie z listy rezerwowej — to świadoma decyzja produktowa,
- nie ma gier cyklicznych w nawigacji (SHOW_RECURRING wyłączona od 2026-08-16),
- nie obsługuje płatności online.
Pełna tabela flag: docs/funkcje.md, sekcja „Flagi funkcji".

CO JUŻ JEST ZBUDOWANE W WARSTWIE SEO/GEO — TEGO NIE PROPONUJ PONOWNIE
(zweryfikuj każdy punkt w kodzie, zanim się na niego powołasz):
- `robots.ts` — wykluczone /admin, /api, /profil, /moje-gry, /d/, /g/; crawlery AI
  (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot)
  wymienione z nazwy i wpuszczone świadomie.
- `sitemap.ts` + `sitemap-index.xml/route.ts` + `sitemap-boiska/[plik]/route.ts`
  — sitemapy partycjonowane per województwo, bo katalog ma 36k+ wierszy.
- Tiering indeksacji katalogu (migracja `112`): `fields.seo_tier` 1/2/3, Tier 3
  dostaje `noindex`. Backfill przeszedł: 3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3.
- JSON-LD w `lib/structuredData.ts`: Organization, WebSite, SoftwareApplication
  (globalnie), SportsEvent (tylko mecze PUBLICZNE — prywatny nigdy), FAQPage,
  HowTo, BreadcrumbList, ItemList, SportsActivityLocation.
- Strony treści: `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq` — copy żyje osobno
  od JSX w `frontend/src/content/*.ts` i jest testowane.
- 12 stron sport+miasto `/[sport]/[miasto]` (4 sporty × Poznań, Warszawa, Kraków),
  z „Direct Answer" i licznikiem otwartych meczów w promieniu 15 km
  (`content/miasta.ts`).
- 6 stron `/boiska/[sport]`, 16 hubów wojewódzkich `/boiska/woj/[wojewodztwo]`.
- Fact-dense opis obiektu generowany z danych (`content/opisObiektu.ts`), wpięty
  równocześnie w widoczną treść i w `description` JSON-LD — jedno źródło.
- `frontend/public/llms.txt` (indeks) + `frontend/public/llm-context.md` (gęsty
  kontekst dla modeli czytających na zimno, serwowany pod bojo.pl/llm-context.md).
- Canonicale na stronach publicznych, weryfikacja Google Search Console.

ZNANE SŁABE PUNKTY (potwierdź lub obal, nie przyjmuj na wiarę)
- Liczby na landingu (`LANDING_STATS`) to statyczne literały, nie zapytanie do bazy
  — a badania GEO mówią, że to właśnie statystyki podnoszą cytowalność. Ryzyko:
  rozjazd z rzeczywistością.
- Katalog ma 36k obiektów, ale przy audycie tylko ~40 z nich miało kiedykolwiek
  jakikolwiek mecz. Większość stron obiektu to dziś strona bez zdarzeń.
- Nie ma strony „o nas" ani żadnej strony budującej E-E-A-T (była, została
  usunięta). Nie ma bloga ani hubu treści.
- Nadawca e-mail w Resend wciąż na domenie `bojo.app`, nie `bojo.pl` — spójność
  encji.
- Obraz OG to zdjęcie satelitarne Poznania dla wszystkich stron.
- Core Web Vitals nigdy nie mierzone.
- Zero linków przychodzących, zero wzmianek w sieci, zero rozpoznawalności marki.

TWARDE OGRANICZENIA TECHNICZNE (naruszenie = propozycja do kosza)
- NIC liniowego względem katalogu przy buildzie. `generateStaticParams()` dla
  obiektów już raz wywróciło build (40+ minut). Nowe strony masowe muszą być
  renderowane na żądanie z `revalidate`.
- `useSearchParams()` wywala build produkcyjny na trasach prerenderowanych.
- Mobile-first bezwzględnie: breakpointy `max-*` są w nowym kodzie zabronione.
- RLS to jedyna realna granica dostępu — klucz `anon` jest jawny w paczce JS.
  Żadna propozycja nie może wystawiać danych prywatnych meczów, grup ani kodów
  dołączenia.
- Zmiana kodu pociąga aktualizację dokumentacji; `npm run check:docs` musi być
  zielony. Zasady: AGENTS.md.

RYNEK I KONKURENCJA
Zbadaj sam, nie zakładaj. Punkty startowe do weryfikacji: BallSquad, Playo,
Sportsmania, Fanuj, Zagramy, RezerwujBoisko/Booksy-podobne systemy obiektów,
grupy na Facebooku („Piłka nożna Poznań — szukam graczy"), Messenger/WhatsApp jako
domyślne narzędzie, Facebook Events, Strava, Meetup, aplikacje klubowe.
Rozróżnij trzy kategorie: (a) systemy rezerwacji obiektów, (b) marketplace'y gier,
(c) narzędzia komunikacji, które ludzie zaadaptowali. Bojo konkuruje głównie
z kategorią (c) — z grupą na WhatsAppie, nie z platformą.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ B — ZADANIE: DZIEWIĘĆ KROKÓW PO KOLEI
═══════════════════════════════════════════════════════════════════════════════

Wykonaj kroki PO KOLEI. Każdy kolejny MUSI wprost odwoływać się do ustaleń
poprzedniego — cytuj własne wnioski, nie zaczynaj od nowa. Jeśli krok 5 nie
korzysta z mapy popytu z kroku 2, zrobiłeś to źle.

── KROK 0: ROZPOZNANIE ────────────────────────────────────────────────────────
Zanim cokolwiek zaproponujesz, ustal stan faktyczny.

W repo przeczytaj co najmniej: frontend/src/app/{layout,sitemap,robots}.ts,
frontend/src/lib/structuredData.ts, frontend/src/content/*.ts, frontend/public/
llms.txt i llm-context.md, docs/funkcje.md, docs/strategia.md §9, BACKLOG.md §7
i §7a.

W sieci pobierz i przeczytaj realnie renderowane: https://bojo.pl/,
/jak-dziala-bojo, /dlaczego-bojo, /faq, /mapa, /wydarzenia, jedną stronę
sport+miasto, jedną stronę obiektu, jeden hub wojewódzki, /robots.txt,
/sitemap-index.xml, /llms.txt, /llm-context.md.

Sprawdź też, co o Bojo wie dziś świat: wyszukaj markę w Google i zapytaj o nią
wyszukiwarki generatywne. Zanotuj, czy Bojo jest w ogóle znane jako encja i czy
nie jest mylone z czymś innym o podobnej nazwie.

ODDAJ: tabelę RÓŻNIC — „plan w BACKLOG" vs „kod" vs „to, co realnie widzi crawler
na produkcji". Trzy kolumny statusu, jedna kolumna dowodu (ścieżka pliku albo
cytat ze strony). Wszystko, co znajdziesz zepsute, niespójne albo nieobecne mimo
odhaczenia — wypisz osobno jako DŁUG. To jedyny krok, w którym nie proponujesz
niczego nowego.

── KROK 1: KTO PYTA I DLACZEGO ────────────────────────────────────────────────
Zdefiniuj 5–7 realnych sytuacji, w których człowiek sięga po wyszukiwarkę albo po
ChatGPT z problemem, który Bojo rozwiązuje. Nie persony — SYTUACJE, z momentem
w czasie („czwartek 21:30, dwóch ludzi odpadło na jutro").

Dla każdej: co dokładnie wpisuje w Google, o co dokładnie pyta model, jakiej
odpowiedzi dziś dostaje (sprawdź to naprawdę) i czy Bojo w tej odpowiedzi ma
prawo się pojawić. Bądź bezwzględny: jeśli w danej sytuacji Bojo nic nie wnosi,
napisz to i wykreśl sytuację. Lepsza jest przewaga w czterech miejscach niż
udawana obecność w dwudziestu.

── KROK 2: MAPA POPYTU (SEO + GEO) ────────────────────────────────────────────
Zbuduj mapę zapytań w dwóch osobnych warstwach, bo rządzą się innymi prawami:

(a) KLASYCZNE SEO — frazy wpisywane w Google. Klastry intencji, szacowana
    wielkość, trudność, obecny właściciel wyniku (kto dziś zajmuje pierwszą
    dziesiątkę), i uczciwa ocena, czy Bojo ma czym wygrać. Osobno: frazy
    lokalne (sport × miasto × dzielnica), frazy narzędziowe („jak podzielić
    koszt boiska"), frazy problemowe („co zrobić, jak brakuje ludzi na mecz").

(b) GEO — zapytania konwersacyjne zadawane modelom. Te są dłuższe, mają kontekst
    i intencję wprost. Zbuduj ZESTAW POMIAROWY: 40 konkretnych promptów po polsku,
    które realny człowiek zadałby ChatGPT/Perplexity/Gemini. Podziel na cztery
    koszyki: markowe („czym jest Bojo"), kategorialne („aplikacja do organizowania
    meczów"), problemowe („jak ogarnąć granie w piłkę ze znajomymi bez chaosu na
    WhatsAppie"), lokalne („gdzie pograć w siatkówkę w Poznaniu"). Ten zestaw
    wraca w kroku 7 jako miernik — ma być stały, żeby dało się porównywać
    w czasie.

Dla obu warstw wskaż, KTÓRA ISTNIEJĄCA LUB NOWA STRONA ma odpowiadać na dany
klaster. Jedna intencja = jedna strona. Wskaż kanibalizacje, które już istnieją
(podejrzany jest zwłaszcza styk `/boiska/[sport]` × `/[sport]/[miasto]` ×
`/boiska/woj/[x]`).

── KROK 3: AUDYT ISTNIEJĄCYCH STRON, Z KONKRETNYM COPY ────────────────────────
Dla każdej z: `/`, `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq`, `/[sport]/[miasto]`,
`/boisko/[id]`, `/boiska/[sport]`, `/boiska/woj/[x]` — oceń pod kątem tego, co
realnie podnosi cytowalność w silnikach generatywnych: bezpośrednia odpowiedź
w pierwszym akapicie, gęstość faktów, liczby, cytowania źródeł, samowystarczalność
sekcji (fragment wyrwany z kontekstu musi nadal nazywać Bojo po imieniu).

Dla każdej strony podaj: obecny nagłówek → proponowany nagłówek, obecny pierwszy
akapit → proponowany (gotowy polski tekst, nie wytyczne), brakujące sekcje H2/H3
w kolejności, oraz nowe pytania do FAQ z gotowymi odpowiedziami.

Twarde reguły dla całego copy, którego złamanie dyskwalifikuje propozycję:
- ZERO języka marketingowego i zero list słów kluczowych. Keyword stuffing wypada
  najsłabiej ze wszystkich metod GEO (Aggarwal i in., KDD 2024) i obniża ocenę
  gęstości informacyjnej. Zamiast słów kluczowych — pytania w naturalnym języku.
- Żadna liczba, której nie da się dziś obronić. Jeśli proponujesz statystykę,
  wskaż, skąd ma być liczona.
- Żadnej frazy z frontend/src/content/zakazaneFrazy.ts w kontekście twierdzącym.
- Schema tylko dla treści widocznej na stronie.
- Ton: uczciwy wobec wczesnego etapu. „Otwartych meczów bywa tu dziś niewiele"
  (content/graj.ts) jest wzorcem, nie wpadką — model cytujący nas na tym zyskuje.

── KROK 4: ARCHITEKTURA TREŚCI I SKALA ────────────────────────────────────────
Zaprojektuj docelową architekturę informacji. Odpowiedz na trzy pytania:

(a) Które NOWE typy stron powstają, w jakiej kolejności i pod jaką intencję
    z kroku 2? Podaj wzorzec adresu, źródło danych, próg jakości (kiedy strona
    NIE powstaje, bo byłaby pusta), i sposób renderowania zgodny z ograniczeniem
    „nic liniowego przy buildzie".
(b) Jak wygląda linkowanie wewnętrzne między czterema warstwami: kraj →
    województwo → miasto → obiekt, oraz w poprzek: obiekt ↔ sport ↔ mecz ↔ grupa.
    Gdzie dziś ta sieć się rwie?
(c) Skala katalogu to 36k obiektów, z których większość nie ma i długo nie będzie
    miała żadnego meczu. Rozstrzygnij uczciwie: ile z nich w ogóle POWINNO być
    indeksowanych i czym uzasadnić istnienie strony obiektu, na którym nikt nie
    gra. Jeśli odpowiedź brzmi „mniej niż dziś", powiedz to wprost.

Osobno: jak w strukturze strony i w treści zakomunikować różnicę między Bojo
a systemem rezerwacji obiektów, żeby model generatywny nie wrzucił nas do
niewłaściwego koszyka. Podaj konkretne zdania i konkretne miejsca.

── KROK 5: WARSTWA MASZYNOWA ──────────────────────────────────────────────────
Zaprojektuj kompletny graf encji i dane strukturalne.

Podaj GOTOWY kod JSON-LD (nie opis, kod) dla każdego zaproponowanego typu strony,
z polami wypełnionymi realnymi danymi Bojo. Obowiązkowo rozważ, co dokładać do
tego, co już jest: `sameAs` i tożsamość encji Organization, `SearchAction`,
`Dataset` dla katalogu obiektów, `ItemList` z rzeczywistą liczbą pozycji,
`Review`/`AggregateRating` (i uczciwie: czy mamy do tego prawo), `HowTo` dla
przepływów organizatora, `Place` z `amenityFeature` dla potwierdzeń UGC.

Wskaż też, co należy z dzisiejszej schemy USUNĄĆ albo poprawić — jeśli coś jest
naciągnięte, jest to sygnał spamu, nie przewagi.

Oddzielnie: strategia plików dla modeli. Czy `llms.txt` i `llm-context.md` mają
dziś właściwą zawartość, właściwą długość i właściwy podział? Co dopisać, co
wyrzucić? Pamiętaj o zastrzeżeniu z docs/README.md: żaden duży dostawca nie
potwierdził, że czyta `llms.txt`, więc plik ma być tani w utrzymaniu.

── KROK 6: ENCJA I ŚLAD W SIECI (OFF-PAGE GEO) ────────────────────────────────
Modele cytują to, o czym świat już mówi. Bojo dziś nie istnieje jako encja.

Zaprojektuj plan budowy śladu cyfrowego w kolejności, w jakiej ma powstawać:
gdzie założyć profile, gdzie marka ma być wymieniona, jakie treści muszą powstać
POZA bojo.pl, żeby model miał co cytować. Rozważ co najmniej: Wikidata i warunki
notability, katalogi produktów i aplikacji, GitHub, fora i społeczności sportowe,
Reddit (r/Polska, r/poznan i lokalne), Wykop, grupy Facebooka, lokalne media
i portale miejskie, uczelnie i AZS-y, zarządców obiektów jako źródło wzmianek,
OpenStreetMap (jesteśmy konsumentem tych danych — czy jest tu miejsce na uczciwy
wkład zwrotny).

Dla każdego kanału podaj: co konkretnie tam publikujemy, kto to robi (Jan —
biznes/growth, Franek — tech/produkt; podział w docs/strategia.md §7), jaka jest
częstotliwość i jaki jest sygnał, że zadziałało.

Zasada, której nie łamiemy: żadnego udawania użytkowników, kupowania linków ani
astroturfingu. Nie dlatego, że nieetyczne — również dlatego, że przy dwuosobowym
zespole i jednej domenie to ryzyko nieproporcjonalne do zysku. Jeśli jakaś taktyka
jest w szarej strefie, oznacz ją i opisz ryzyko, zamiast ją przemycać.

── KROK 7: POMIAR ─────────────────────────────────────────────────────────────
Bez pomiaru wszystko powyżej jest opinią.

Zaprojektuj system pomiarowy: co mierzymy, czym, jak często, jaka jest wartość
bazowa DZIŚ (zmierz ją teraz, w trakcie tego zadania, dla zestawu 40 promptów
z kroku 2) i jaki próg oznacza sukces po 30, 90 i 180 dniach.

Uwzględnij: pozycje i wyświetlenia w Search Console, pokrycie indeksu (ile z 36k
stron realnie w indeksie — to najpewniej największa niespodzianka w całym audycie),
Core Web Vitals, obecność w odpowiedziach modeli (zestaw promptów, powtarzany
ręcznie albo skryptem), wzmianki marki, ruch z crawlerów AI w logach.

Zaproponuj, co z tego da się zautomatyzować w tym repo (GitHub Actions jest już
używany — 11 workflowów) tak, żeby pomiar nie zależał od cudzej pamięci.

── KROK 8: FOSA — CZEGO KONKURENCJA NIE SKOPIUJE ──────────────────────────────
Tu chodzi o przewagę stukrotną, nie o dziesięcioprocentową. Wszystko z kroków 3–6
konkurent z budżetem odtworzy w kwartał. Co jest nie do odtworzenia?

Wymyśl 5–8 posunięć, których nie da się skopiować bez posiadania tego, co mamy:
katalogu 36k obiektów z geometrią z OSM, potwierdzeń od graczy (UGC), realnych
danych o tym, gdzie i kiedy ludzie faktycznie grają, oraz pozycji narzędzia dla
organizatora, a nie pośrednika w wynajmie.

Dla każdego posunięcia: na czym polega, dlaczego konkurent tego nie powtórzy,
co trzeba zbudować, jakie dane wystawiamy i jakie jest ryzyko (prywatność, koszt
utrzymania, licencja ODbL OpenStreetMap — sprawdź ją, zanim cokolwiek zaproponujesz
z publikowaniem danych). Odrzuć pomysły, które wymagają skali, której nie mamy;
przewaga ma działać przy stu użytkownikach, nie dopiero przy stu tysiącach.

Przynajmniej jedno posunięcie musi dotyczyć tego, że Bojo generuje dane, których
nikt inny w Polsce nie ma. Przynajmniej jedno — tego, że organizator, który raz
wkleił link, wraca co tydzień.

── KROK 9: ROADMAPA I ANTY-LISTA ──────────────────────────────────────────────
Zbierz wszystko w jedną tabelę, posortowaną według stosunku wpływu do trudności:

| # | Zadanie | Horyzont | Wpływ | Trudność | Kto | Pliki / miejsce | Miara sukcesu |

Horyzonty: QUICK WIN (1–3 dni, zmiany w treści i nagłówkach istniejących stron),
ŚREDNI (2–8 tygodni, nowe typy stron i funkcje), DŁUGI (kwartały, autorytet
domeny i encji). Wpływ: niski/średni/wysoki. Trudność: łatwa/średnia/trudna.
„Kto": Jan albo Franek. „Pliki": konkretne ścieżki w tym repo albo „poza repo".
„Miara sukcesu": liczba z kroku 7, nie „lepsza widoczność".

Pod tabelą trzy sekcje:
- PIERWSZY TYDZIEŃ — dokładnie pięć rzeczy, w kolejności, od poniedziałku.
- CZEGO NIE ROBIMY — minimum 6 taktyk SEO/GEO, które w sytuacji Bojo są stratą
  czasu albo ryzykiem, z uzasadnieniem. Ta sekcja jest obowiązkowa i ma być
  konkretna; „nie kupujemy linków" to za mało.
- CO MOŻE PÓJŚĆ NIE TAK — trzy scenariusze, w których ta strategia zaszkodzi
  (np. masowe cienkie strony obrywają od Google, treść obiecuje więcej, niż
  produkt daje, czas Jana idzie w kanał, który nie konwertuje), i po czym
  poznamy, że to się dzieje, zanim będzie za późno.

═══════════════════════════════════════════════════════════════════════════════
CZĘŚĆ C — FORMA ODPOWIEDZI
═══════════════════════════════════════════════════════════════════════════════

Wynik zapisz jako `docs/seo-geo-strategia.md`, w tej samej konwencji co reszta
docs/: gęsty Markdown po polsku, zero marketingu, nagłówki po numerach kroków.
Na początku pliku umieść znacznik `**Stan na:**` z datą i jednoakapitowe
streszczenie dla kogoś, kto nie zna się na SEO — po polsku, bez żargonu.
Żargon, którego użyjesz dalej, wyjaśnij przy pierwszym wystąpieniu.

Dopisz link do nowego pliku w tabeli w `docs/README.md`.

Zadania z roadmapy dopisz do `BACKLOG.md` — do istniejącej sekcji „7. SEO / GEO",
bez duplikowania tego, co już odhaczone. Odhaczonego nie odhaczaj z powrotem;
jeśli uważasz, że coś jest odhaczone niesłusznie, dopisz sprostowanie tak, jak
robią to inne wpisy w tym pliku.

NIE wprowadzaj jeszcze zmian w kodzie aplikacji ani w treści stron — to zadanie
kończy się planem i decyzją człowieka, co wdrażamy. Wyjątek: jeśli w kroku 0
znajdziesz coś ewidentnie zepsutego (błędny canonical, schema wystawiająca dane
prywatne, martwy adres w sitemapie), zgłoś to osobno na górze dokumentu jako
PILNE, z gotową poprawką do zatwierdzenia.

Na koniec, w jednym akapicie i bez uprzejmości: gdyby to był Twój produkt
i Twoje pieniądze, co zrobiłbyś w tej kolejności jako pierwsze i co byś odpuścił
w ogóle.
```

---

## Po przebiegu

1. Przeczytaj sekcję „CZEGO NIE ROBIMY" **przed** roadmapą — tam najszybciej widać,
   czy model zrozumiał sytuację, czy recytuje poradnik.
2. Sprawdź, czy krok 0 nie znalazł czegoś pilnego. Rzeczy z etykietą PILNE idą
   osobnym, małym PR-em, nie razem ze strategią.
3. Zestaw 40 promptów z kroku 2 przenieś do `docs/seo-geo-strategia.md` jako
   trwały załącznik. Bez niego nie da się po miesiącu porównać, czy cokolwiek
   drgnęło.
4. Roadmapę potnij na PR-y po jednym horyzoncie. „Quick winy" to jeden PR z samą
   treścią stron — treść żyje w `frontend/src/content/*.ts` i jest testowana,
   więc zmiana copy to zmiana kodu jak każda inna.
