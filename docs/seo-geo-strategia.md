# Bojo — strategia SEO i GEO

> **Stan na:** 2026-08-23 · audyt kodu na commicie `318cd85` · warstwa produkcyjna
> **niezweryfikowana** (patrz „Czego nie sprawdziłem")
>
> Warstwa operacyjna i fazy → [strategia.md](./strategia.md).
> Kierunek produktu → [wizja.md](./wizja.md) (dokument nadrzędny).

## Streszczenie dla kogoś, kto nie zna się na SEO

Bojo ma zbudowaną całą maszynerię do bycia znajdowanym w Google i polecanym przez
asystentów AI, ale ta maszyneria w dużej części **nie działa dla robotów**, które
czytają strony. Wygląda to tak: mamy ponad trzydzieści tysięcy stron boisk, do których
prowadzi mapa strony, ale robot wchodzący na taką stronę widzi pustą ramkę — treść
dorysowuje się dopiero w przeglądarce, a robot przeglądarką nie jest. Szesnaście stron
wojewódzkich nie ma ani jednego odnośnika prowadzącego do nich z innej strony, więc
w praktyce nie istnieją. Do tego jedna rzecz jest wyciekiem: strona prywatnego meczu
podaje w swoich niewidocznych danych nazwę, sport, datę, godzinę i boisko — czyli
dokładnie to, czego strzeże kod dołączenia.

Dobra wiadomość: to są tanie naprawy. Zła: nawet naprawione, nie wystarczą. Nazwa
„bojo" jest w polszczyźnie potocznym słowem znaczącym „boisko", więc zapytanie o markę
zawsze trafi w słownik, a nie w produkt — to trzeba rozwiązać osobno. A rynek, wbrew
temu, co zakładaliśmy, nie jest pusty.

Dokument mówi, co naprawić najpierw, na jakie pytania Bojo ma realnie odpowiadać,
a od jakich trzymać się z daleka, i po czym poznamy za trzy miesiące, że to działa.

**Żargon, który dalej pada:**
- **crawler / robot / bot** — program wyszukiwarki, który pobiera stronę. Zwykle nie
  uruchamia JavaScriptu albo robi to z opóźnieniem, więc widzi mniej niż człowiek.
- **indeksacja** — trafienie strony do bazy wyszukiwarki. `noindex` = prośba
  o pominięcie.
- **canonical** — deklaracja „to jest właściwy adres tej treści", gdy ta sama treść
  jest pod kilkoma adresami.
- **JSON-LD / schema.org** — dane o stronie w formacie dla maszyn, ukryte w kodzie.
- **GEO** (Generative Engine Optimization) — to samo co SEO, ale dla ChatGPT,
  Perplexity i Gemini: chodzi o bycie **cytowanym w odpowiedzi**, nie o pozycję.
- **encja** — byt, który wyszukiwarka rozumie jako rzecz („Bojo, aplikacja"),
  a nie jako ciąg znaków.
- **SZACUNEK** — moja ocena bez pomiaru. Przy każdej piszę, czym ją zweryfikować.

---

## PILNE — do naprawy niezależnie od reszty dokumentu

Cztery rzeczy znalezione w audycie kodu. Idą osobnym, małym PR-em; nie czekają na
decyzję o strategii.

### P1. Metadane prywatnego meczu wyciekają do wyszukiwarek

`frontend/src/app/wydarzenia/[id]/eventMeta.ts:26-33` czyta wiersz meczu **bez filtra
po `visibility`**. Z tego odczytu `generateMetadata` (`page.tsx:36-37`) składa:

- `<title>` = „«nazwa meczu» — «dzień» «godzina» | Bojo"
- `<meta name="description">` = „«sport» • «dzień», «godzina» • «nazwa boiska». Dołącz…"
- `og:title` i `og:description` = „📍 «miejsce»" (`page.tsx:47-49`)

a `opengraph-image.tsx:23-60` renderuje **publicznie dostępny obrazek** z sportem,
terminem, miejscem, liczbą wolnych miejsc i ceną — dla każdego meczu, też prywatnego.

JSON-LD jest chroniony (`lib/structuredData.ts:83` zwraca `null` dla niepublicznych)
i treść strony też (klient anon + RLS). Chroniona jest więc warstwa, o której ktoś
pomyślał, a odsłonięta ta, o której nie. Kod sam to nazywa — komentarz przy canonicalu
(`page.tsx:42-43`) mówi: *„a private one is reachable solely through its join link and
must not advertise an indexable address"*. Brak canonicala nie jest jednak instrukcją
`noindex`, a `/wydarzenia/` nie ma w `DISALLOW` w `robots.ts:9`.

Warunek wykorzystania: znajomość identyfikatora meczu. Link krąży po czatach ekipy —
wystarczy, że raz trafi na publiczne forum albo do historii przeglądarki
zsynchronizowanej z wyszukiwarką.

**Łatka** (`app/wydarzenia/[id]/page.tsx`, w `generateMetadata`):

```ts
const publiczny = ev.visibility === 'public';
if (!publiczny) {
  // Prywatny mecz: żadnych szczegółów w metadanych i żadnego wejścia do indeksu.
  // Ten sam próg, który w structuredData.ts blokuje JSON-LD.
  return { title: 'Mecz | Bojo', robots: { index: false, follow: false } };
}
```

**Łatka** (`app/wydarzenia/[id]/opengraph-image.tsx`, zaraz po `getEventMeta`):

```ts
if (!ev || ev.visibility !== 'public') {
  return new ImageResponse(<KartaOgolna />, { ...size });
}
```

**Test**, który przypina regułę tak, jak `structuredData.test.ts` przypina ją dla
JSON-LD: dla `visibility: 'private'` metadane nie zawierają nazwy obiektu ani daty,
a `robots.index === false`. Bez testu ta poprawka odejdzie przy pierwszym refaktorze —
dokładnie tak, jak odeszła przy wydzielaniu `eventMeta.ts`.

### P2. Opis 32 tysięcy stron obiektów obiecuje funkcję, której nie ma

`app/boisko/[id]/page.tsx:180`:

```
description: `${field.name}, ${field.address}. Sporty: ${sportsStr}. Znajdź nadchodzące mecze i zarezerwuj termin na Bojo.`
```

„Zarezerwuj termin" to `FEATURE_RESERVATIONS`, czyli funkcja **wyłączona**
([funkcje.md](./funkcje.md#flagi-funkcji)). Zdanie idzie do wyszukiwarek przy każdej
stronie obiektu i jest dokładnie tym, czego zabrania `content/zakazaneFrazy.ts`
(wzorzec `rezerw(uj|acj[aeę]) boisk`) — tyle że walidator sprawdza wyłącznie pliki
w `content/`, a nie metadane w `app/`. Skutek podwójny: obietnica bez pokrycia dla
człowieka i sygnał dla modeli, że Bojo jest systemem rezerwacji, czyli dokładna
odwrotność pozycjonowania z `content/miasta.ts#CZYM_BOJO_NIE_JEST`.

**Łatka**: końcówka opisu na „Zobacz nadchodzące mecze i zbierz skład na Bojo."
Docelowo (rozdział 3) całe `description` powinno pochodzić z `opisObiektu()`, żeby
metadane i widoczna treść miały jedno źródło.

### P3. Tytuł kończy się „| Bojo | Bojo"

`layout.tsx:66` ustawia `title.template = '%s | Bojo'`, a pięć plików dokłada `| Bojo`
ręcznie do stringa. Next.js nakłada szablon na wierzchu, więc tytuł brzmi
„Orlik Rataje — piłka nożna w Poznaniu | Bojo | Bojo".

Dotyczy: `app/boisko/[id]/page.tsx:168,179,189`, `app/boiska/[sport]/page.tsx:71,75,81`,
`app/boiska/woj/[wojewodztwo]/page.tsx:53,57,65`, `app/wydarzenia/[id]/page.tsx:25,36`,
`app/gracz/przejmij/[token]/page.tsx:6` — czyli praktycznie **cały indeksowalny
wolumen serwisu**.

**Łatka**: usunąć ręczny sufiks z `title` (zostawić w `openGraph.title`, bo tam szablon
się nie stosuje).

### P4. Trasy techniczne i wyłączone funkcje są otwarte dla robotów

`robots.ts:9` blokuje `/admin`, `/api`, `/profil`, `/moje-gry`, `/d/`, `/g/`. Nie
blokuje natomiast tras, które są komponentami klienckimi bez własnych metadanych —
każda zwraca tytuł strony głównej i nie ma canonicala:

| Trasa | Dlaczego nie powinna być w indeksie |
|---|---|
| `/auth/callback`, `/auth/reset` | techniczne trasy logowania |
| `/turniej*` (5), `/cykliczne*` (4), `/obiekt*` (6), `/rezerwacje` | funkcje za wyłączonymi flagami — [funkcje.md](./funkcje.md#flagi-funkcji) mówi wprost: „reklamowanie ich wyszukiwarce obiecuje coś, czego użytkownik nie znajdzie w interfejsie" |
| `/wydarzenia/nowe`, `/grupy/nowe`, `/wydarzenia/[id]/edytuj`, `/grupy/[id]/edytuj` | kreatory i formularze; `/wydarzenia/nowe` jest linkowane ze stopki i z czterech CTA landingu, więc realnie zbiera odesłania |
| `/logowanie`, `/zglos-blad` | bez wartości w wynikach |
| `/gracz/[id]` | publiczne profile z imieniem, statystykami i historią meczów, pod generycznym tytułem, bez canonicala |

**Łatka**: dopisać do `DISALLOW` w `robots.ts` (`/auth/`, `/turniej`, `/cykliczne`,
`/obiekt`, `/rezerwacje`, `/logowanie`, `/zglos-blad`) oraz dodać
`robots: { index: false, follow: true }` w metadanych `/gracz/[id]` i tras kreatorów.
Uwaga na kolejność: `robots.txt` **nie usuwa** z indeksu strony już zaindeksowanej —
jeśli GSC pokaże takie adresy, trzeba je najpierw wypuścić z `noindex`, a dopiero
potem zablokować.

**Osobna decyzja do podjęcia** (`/gracz/[id]`): profil gracza z imieniem i historią
meczów w wyszukiwarce to pytanie o prywatność, nie o SEO. Domyślnie proponuję
`noindex`; jeśli profile mają być publiczne celowo, wymaga to zgody i osobnego wątku.

---

## 0. Stan faktyczny — plan kontra kod kontra produkcja

Trzy kolumny, bo to trzy różne rzeczy i właśnie ich mylenie zrobiło dzisiejszy stan:
coś jest odhaczone w backlogu, kod istnieje, a mimo to nie działa tam, gdzie miało.

Kolumna „Produkcja" jest wszędzie oznaczona jako niezweryfikowana — nie miałem dostępu
sieciowego do `bojo.pl` (patrz „Czego nie sprawdziłem"). Sposób sprawdzenia: Załącznik B.

| Rzecz | BACKLOG | Kod | Co realnie dostaje robot | Dowód |
|---|---|---|---|---|
| Tiering indeksacji (Faza 0) | zrobione | działa | zgodnie z zamysłem | `boisko/[id]/page.tsx:187`, `sitemap-boiska/[plik]/route.ts:38` |
| Sitemapy per województwo | zrobione | działa | 16 plików + indeks | `sitemap-index.xml/route.ts:16-19` |
| Fact-dense opis obiektu (Faza 1) | zrobione | funkcja istnieje, prop przekazywany | **nic** — `VenueDetailClient` zwraca szkielet do czasu `useEffect`, więc w HTML nie ma ani `<h1>`, ani opisu | `VenueDetailClient.tsx:197`, `boisko/[id]/page.tsx:300-329` |
| Huby wojewódzkie (Faza 2b) | zrobione | strony renderują się poprawnie | **strony osierocone** — zero linków przychodzących w HTML | `VenueDetailClient.tsx:252-256` (link za bramką ładowania) |
| Huby sport+miasto (Faza 2) | zrobione | 12 stron, najgęściej zalinkowana część serwisu | działa, ale wejście tylko z `/boiska/[sport]`, zawsze na `/poznan` | `boiska/[sport]/page.tsx:210` |
| Mikro-ankiety UGC (Faza 3) | zrobione | działa | niewidoczne dla robota z tego samego powodu co opis obiektu | `AnkietyObiektu.tsx` w `VenueDetailClient` |
| JSON-LD | zrobione | działa | emitowany serwerowo, czyli **jedyna** rzecz, którą robot dostaje na stronie obiektu | `boisko/[id]/page.tsx:302-309` |
| `llms.txt`, `llm-context.md` | zrobione | pliki statyczne | serwowane, nie podpięte do żadnej trasy | `frontend/public/` |
| Crawlery AI wpuszczone z nazwy | zrobione | działa | — | `robots.ts:12-19` |

### DŁUG — rzeczy zepsute albo niespójne

Ponumerowane, bo wracają w roadmapie w rozdziale 9.

- **D1.** Wyciek metadanych prywatnego meczu → P1.
- **D2.** „Zarezerwuj termin" w opisie 32 tys. stron → P2.
- **D3.** Podwójny sufiks w tytułach → P3.
- **D4.** Trasy techniczne i za flagami otwarte dla robotów → P4.
- **D5.** ~~**Strona obiektu jest pusta dla robota.**~~ **(naprawione 2026-08-23: nagłówek, opis i adres renderują się serwerowo, także w stanie ładowania.)** Stan sprzed poprawki: `page.tsx` nie renderuje własnego
  `<h1>` ani `opis`; oba trafiają wyłącznie do `VenueDetailClient`, który do czasu
  `useEffect` zwraca szkielet. Jedyny serwerowy fragment treści to ukryty `<div>`
  z `itemProp` (`page.tsx:311-318`), i to **tylko gdy obiekt ma nadchodzące mecze** —
  czyli dla garstki obiektów.
- **D6.** ~~**Strona obiektu nie ma ani jednego linku wychodzącego**~~ **(naprawione 2026-08-23: widoczna nawigacja do huba województwa, huba sportu i `/jak-dziala-bojo`, plus stopka.)** Stan sprzed poprawki: brak linków w HTML, przy
  zadeklarowanym `follow: true` (`page.tsx:187`). Robot nie ma po czym pójść dalej,
  więc hierarchia kończy się na wejściu z sitemapy.
- **D7.** ~~**Huby wojewódzkie osierocone**~~ **(naprawione 2026-08-23 przez nawigację na stronie obiektu — komentarz w kodzie mówi wreszcie prawdę.)** Stan sprzed poprawki: 0 linków przychodzących, a komentarz
  w kodzie twierdzi, że link jest „widoczny, żeby crawler mógł go realnie przejść".
  Komentarz opisuje intencję, nie stan.
- **D8.** **Częściowo naprawione 2026-08-23** — grupa „Boiska" w stopce daje sześć
  hubów sportowych z każdej strony ze stopką. Zostaje zahardkodowany Poznań w linku
  z hubu sportu. Stan sprzed poprawki: **`/boiska/[sport]` i `/[sport]/[miasto]` to
  zamknięta pętla bez drzwi** —
  żadnego wejścia ze strony głównej, nagłówka ani stopki. Do tego link z hubu sportu
  prowadzi zawsze do Poznania, więc osiem kombinacji z Warszawą i Krakowem nie ma
  wejścia spoza własnego rodzeństwa.
- **D9.** ~~**Stopka jest tylko na czterech typach stron**~~ **(naprawione 2026-08-23:
  doszła na huby katalogu oraz `/wydarzenia` i `/grupy`; `/mapa` świadomie bez niej —
  `h-[100dvh] overflow-hidden` by ją przyciął).** Stan sprzed poprawki: (`app/page.tsx`,
  `/[sport]/[miasto]`, `/profil`, strony treści przez `StronaTresci`). Huby boisk,
  strona obiektu, `/mapa`, `/wydarzenia` i `/grupy` nie mają jej wcale — a stopka jest
  jedynym miejscem w serwisie z linkami do `/jak-dziala-bojo`, `/dlaczego-bojo` i `/faq`.
- **D10.** **Sitemap zgłasza trzy puste strony z wysokim priorytetem**: `/mapa` (0.8),
  `/wydarzenia` (0.8), `/grupy` (0.6). Wszystkie trzy renderują się po stronie klienta
  albo mają `ssr: false`, więc robot dostaje nagłówek i napis o ładowaniu.
- **D11.** **Huby listują obiekty `noindex`** — do 60 linków i 60 pozycji `ItemList`
  na stronę, bez filtra po `seo_tier` (`boiska/[sport]/page.tsx:98-104`,
  `boiska/woj/[wojewodztwo]/page.tsx:81-87`). Budżet skanowania, którego broni tiering,
  wydają własne huby.
- **D12.** ~~**`.neq('seo_tier', 3)` gubi wiersze `NULL`**~~ **(naprawione 2026-08-24,
  i uzasadnienie okazało się mocniejsze, niż tu napisano: `fields.seo_tier` jest
  `SMALLINT NOT NULL` z `CHECK IN (1, 2, 3)`, migracja `112` — `NULL` jest niemożliwy
  na poziomie bazy, nie tylko przefiltrowany tym zapytaniem. `.in('seo_tier', [1, 2])`
  i sygnatura `priorytetDlaTier(tier: 1 | 2)` mówią to wprost zamiast przez domysł.)**
  Stan sprzed poprawki: w SQL `NULL <> 3` daje `NULL`, nie `TRUE`. Efekt netto był
  poprawny (bo `page.tsx:40` mapuje `NULL → 3`), ale gałąź `NULL` w
  `lib/sitemapTier.ts:13` była nieosiągalna, a test `sitemapBoiska.test.ts:17-19`
  sprawdzał scenariusz, który nie mógł zajść.
- **D13.** ~~**Liczba obiektów rozjeżdża się między powierzchniami.**~~ **(naprawione
  2026-08-24: dwa komentarze w kodzie ze sztywną liczbą „32 684" — już nieaktualną,
  katalog urósł do 36 268 — zastąpione tą samą frazą „ponad 30 000" co w treści
  widocznej dla użytkownika. Datowany zapis w BACKLOG zostaje jako historia, nie
  konkuruje z liczbą bieżącą.)** Stan sprzed poprawki: `content/dlaczego.ts:86`
  i `llms.txt` mówiły „ponad 30 000", dwa komentarze w kodzie sztywne „32 684",
  BACKLOG 36 268 (3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3), a `llm-context.md`
  nie podawał liczby wcale.
- **D14.** **`/boiska/inne` istnieje, jest indeksowalne i linkowane z breadcrumbów
  obiektu, ale nie ma go w `sitemap.ts`** (`SPORT_SLUGS` wymienia sześć slugów).
- **D15.** **Paginacja hubów bez ograniczeń** — `?strona=N` z self-referencing
  canonicalem, bez `noindex`, przy `force-dynamic` i katalogu 32 tys. wierszy.
- **D16.** `/gracze` przekierowuje kodem 307 (tymczasowym), a redirect z `/graj/:sport/:miasto`
  to 308, nie 301. Funkcjonalnie równoważne dla Google, ale jeśli gdzieś zapisano „301",
  to nieprawda.
- **D17.** **Martwy OG.** `app/opengraph-image.tsx` (konwencja plikowa) ma pierwszeństwo
  przed `metadata.openGraph.images` z `layout.tsx:77`, więc `poznan-satellite.jpg`
  (215 KB w `public/`) prawdopodobnie nie jest nigdy serwowany. Dwa sprzeczne źródła
  obrazka podglądu.
- **D18.** ~~**Jedyny „żywy" dowód aktywności nie istnieje dla robota.**~~ **(naprawione
  2026-08-24: oba komponenty są dziś komponentami serwerowymi, zweryfikowane na atrapie
  PostgREST-a — landing oddaje w HTML link do realnego meczu i realnego obiektu.)**
  Stan sprzed poprawki: `LandingOpenGames` był komponentem klienckim i zwracał `null`,
  gdy otwartych gier nie było — a `LandingVenues` tak samo. W pierwszej odpowiedzi
  serwera strona główna nie zawierała ani jednego linku do meczu ani do obiektu.

---

## 1. Kto pyta i dlaczego — sześć sytuacji

Nie persony, tylko momenty. Przy każdej: co człowiek wpisuje, o co pyta model, i czy
Bojo ma prawo się w odpowiedzi pojawić. Dwie sytuacje wykreśliłem — to ważniejsze niż
te, które zostały.

### S1. Czwartek 21:30, dwóch odpadło na jutro

Organizator ma opłacone boisko na piątek 19:00 i skład 10 z 12. Wpisuje: *„szukam
graczy piłka nożna Poznań jutro"*, *„brakuje 2 osób do składu"*. Pyta model: *„gdzie
szybko znaleźć dwóch graczy na jutrzejszy mecz w Poznaniu?"*

Dziś dostaje: grupy na Facebooku. **Bojo ma prawo się pojawić — jako narzędzie, nie
jako rynek.** Uczciwa odpowiedź brzmi: „wystaw mecz publicznie i wklej link tam, gdzie
Twoi ludzie już są". Obietnica „znajdziemy Ci graczy" byłaby dziś kłamstwem: przy
zerowej płynności publiczny mecz to dodatkowa szansa, nie mechanizm. Tak też mówi
`content/graj.ts#GRAJ_BRAK_MECZY` i to jest właściwy ton.

### S2. Niedziela wieczór, organizator liczy „+1" w komentarzach

Prowadzi gierkę co tydzień od dwóch lat. Wpisuje: *„jak zapisywać ludzi na mecz"*,
*„aplikacja do organizowania gierek"*, *„lista obecności na mecz online"*, *„jak
ogarnąć zapisy na piłkę"*. Pyta model: *„czym zastąpić ankietę na WhatsAppie do
zapisów na cotygodniową gierkę?"*

**To jest sytuacja Bojo.** Produkt rozwiązuje ją w całości i bez zależności od
płynności: licznik miejsc, twardy limit, rezerwa z kolejnością, „Obserwuję" jako
odróżnialne „może wpadnę". Zero konieczności zakładania konta przez graczy jest tu
argumentem rozstrzygającym, bo najczęstszy sprzeciw brzmi „moi ludzie nie założą
kolejnej apki". Cały rozdział 3 jest podporządkowany tej sytuacji.

### S3. Poniedziałek, kto komu został winien 23 zł

Po meczu zostaje rozliczenie. Wpisuje: *„jak podzielić koszt boiska na graczy"*,
*„kalkulator kosztów wynajmu boiska"*, *„ile od osoby za halę"*, *„jak rozliczyć mecz
ze znajomymi"*. Pyta model: *„jak sprawiedliwie podzielić 280 zł za halę między
14 osób, gdy część ma karty sportowe?"*

**Sytuacja Bojo, i to najsłabiej obsadzona przez kogokolwiek.** Zniżki z kart
Multisport, FitProfit i Medicover Sport to polska specyfika, której zagraniczne
narzędzia nie mają, a polskie konkurencyjne aplikacje (rozdział „Tło konkurencyjne")
raczej liczą składki niż uwzględniają karty. Wymaga jednak strony, której dziś nie ma —
patrz rozdział 4, propozycja kalkulatora.

### S4. Wtorek, ktoś nowy w mieście

Wpisuje: *„gdzie pograć w siatkówkę Poznań"*, *„szukam ekipy do gry w kosza Warszawa"*.
Pyta model: *„przeprowadziłem się do Poznania, gdzie znaleźć ludzi do grania
w siatkówkę?"*

**Bojo ma tu stronę (`/[sport]/[miasto]`), ale nie ma czym wygrać.** Odpowiedzią są
istniejące społeczności: grupy na Facebooku, aplikacje z realną płynnością, uczelniane
sekcje. Strona zostaje, bo jest tania w utrzymaniu i uczciwie opisuje, czym Bojo jest —
ale **nie inwestujemy w ten klaster**, dopóki nie ma meczów do pokazania. Inwestowanie
teraz to obiecywanie ruchu, którego nie dostarczymy, i najkrótsza droga do tego, żeby
model zacytował nas raz, a użytkownik odbił się od pustej listy.

### S5. Sobota rano, gdzie tu jest boisko

Wpisuje: *„orlik w pobliżu"*, *„boisko do siatkówki plażowej Poznań"*, *„boiska ze
sztuczną nawierzchnią «dzielnica»"*. Pyta model: *„gdzie w «mieście» jest boisko do
koszykówki z oświetleniem?"*

**Zapytanie zajęte, i to przez kogoś z przewagą wieku.** Katalog Bojo jest większy
(36 268 wierszy wobec ~20 tys. deklarowanych przez boiskawpolsce.pl), ale liczba
wierszy nie jest przewagą — przewagą jest odpowiedź na pytanie, którego tamci nie mają:
*czy tu się realnie gra i czy to oświetlenie na pewno działa*. To jedyna droga do tego
klastra i jest opisana w rozdziale 8 jako fosa. Dziś, przy pustych stronach obiektu
(D5), nie mamy nawet stawki w tej grze.

### S6. Ktokolwiek, pytający modelu zamiast wyszukiwarki

*„Jaka jest najlepsza aplikacja do organizowania amatorskich meczów w Polsce?"*,
*„czy jest coś polskiego zamiast Spond do gierek?"*

**Sytuacja rozstrzygająca dla GEO i jedyna, w której Bojo może wygrać bez płynności** —
bo model porównuje opisy, nie liczbę użytkowników. Wygrywa się tu gęstością faktów,
jednoznacznym określeniem, czym produkt NIE jest, i obecnością marki w źródłach spoza
własnej domeny. Rozdziały 5 i 6.

### Wykreślone

- **„Jak wynająć orlik / rezerwacja boiska «miasto»"** — Bojo nie wnosi nic.
  `FEATURE_RESERVATIONS` jest wyłączona, a `content/miasta.ts#CZYM_BOJO_NIE_JEST`
  mówi to wprost. Każda treść celująca w to zapytanie jest obietnicą bez pokrycia
  (i dokładnie ten błąd popełnia dziś opis 32 tys. stron obiektów — D2).
- **„Statystyki / ranking amatorski / poziom zaawansowania"** — nie istnieje
  ([funkcje.md](./funkcje.md), sekcja „Czego NIE ma"), a `content/zakazaneFrazy.ts`
  zakazuje o tym pisać twierdząco. Wizja mówi o „Stravie dla amatorskich gier", ale
  wizja to kierunek, nie stan — treść opisuje stan.

---

## 2. Mapa popytu

Dwie warstwy, bo rządzą się innymi prawami: w Google wygrywa się pozycją, w modelach —
byciem cytowanym. Te same słowa, inne mechanizmy.

**Zastrzeżenie do wszystkich liczb w tym rozdziale:** nie miałem narzędzia do wolumenów
ani dostępu do Search Console, a wyszukiwarka dostępna w sesji zwraca wyniki dla rynku
amerykańskiego. Każda ocena wielkości i trudności jest **SZACUNKIEM** na podstawie
struktury zapytania i tego, kto odpowiada w wynikach ogólnych. Weryfikacja: Załącznik B,
punkty 4–6.

### 2a. Klastry klasyczne

| Klaster | Przykłady fraz | Wielkość (SZACUNEK) | Trudność | Kto dziś odpowiada | Strona Bojo |
|---|---|---|---|---|---|
| **Narzędzie organizatora** | „aplikacja do organizowania meczów", „jak zapisywać ludzi na mecz", „lista zapisów na gierkę" | mała, ale najwyższa intencja | średnia | konkurencyjne aplikacje, poradniki ogólne | `/jak-dziala-bojo` (główna) + `/` |
| **Zamiast czatu** | „alternatywa dla grupy na whatsappie", „jak ogarnąć gierkę bez chaosu na messengerze" | mała | **niska** | praktycznie nikt celowo | `/dlaczego-bojo` |
| **Rozliczenie** | „jak podzielić koszt boiska", „kalkulator wynajmu hali na osobę", „ile od osoby za orlik" | średnia | **niska** | kalkulatory ogólne, fora | **brak — do zbudowania** (4a) |
| **Karty sportowe** | „multisport na orlik", „czy multisport działa na wynajem boiska" | średnia | średnia | operatorzy kart, obiekty | sekcja na stronie kalkulatora |
| **Problem składu** | „brakuje graczy na mecz", „co zrobić jak ekipa odwołuje" | mała | niska | fora, grupy | sekcja `brakuje-graczy` w `/jak-dziala-bojo` |
| **Lokalne: gra** | „szukam graczy «sport» «miasto»" | średnia | **wysoka** | Facebook, aplikacje z płynnością | `/[sport]/[miasto]` — utrzymanie, nie inwestycja |
| **Lokalne: obiekt** | „boiska «sport» «miasto»", „orlik w pobliżu" | **duża** | **wysoka** | boiskawpolsce.pl, orlik2012.pl, strony MOSiR, mapy | `/boiska/*`, `/boisko/[id]` — wyłącznie z fosą z rozdz. 8 |
| **Markowe** | „bojo", „bojo.pl", „aplikacja bojo" | znikoma | **nierozstrzygalna dla samego „bojo"** | słowniki slangu | patrz 2c |

### 2b. Kanibalizacje, które już istnieją

Trzy typy stron mówią dziś częściowo o tym samym i nic w kodzie nie rozdziela ich
intencji:

- `/boiska/[sport]` (kraj) kontra `/boiska/woj/[x]` (region) — pierwsza to lista
  wszystkich obiektów danego sportu w Polsce, druga wszystkich obiektów w województwie.
  Dla zapytania „boiska do koszykówki w mazowieckiem" obie są częściowo trafne i żadna
  celnie. **Brakującą warstwą jest sport × województwo i sport × miasto**, i to ona
  powinna powstać zamiast dokładania kolejnych miast do `/[sport]/[miasto]` (4a).
- `/[sport]/[miasto]` celuje w intencję „chcę zagrać", a `/boiska/*` w „gdzie jest
  boisko". To rozróżnienie jest poprawne i warte utrzymania — ale linki wewnętrzne je
  zacierają, bo jedyne przejście między klastrami prowadzi z hubu sportu do Poznania
  (D8), niezależnie od tego, czego dotyczyła strona.
- Paginacja (`?strona=N`) z self-referencing canonicalem tworzy setki adresów
  konkurujących z pierwszą stroną hubu o tę samą frazę (D15).

### 2c. Problem, którego nie da się obejść: nazwa

**„Bojo" to w polszczyźnie potocznej słowo znaczące „boisko"** — udokumentowane
w słownikach slangu i w Wikisłowniku, z przykładem użycia „lecę na bojo pograć w piłkę".
Do tego angielska Wikipedia ma hasło „Bojo" o czymś zupełnie innym.

Konsekwencje, których żadna optymalizacja treści nie zniesie:

1. Zapytanie „co to jest bojo" **zawsze** zwróci definicję słownikową. Nie walczymy o nie.
2. Model odpowiadający o marce musi mieć sygnał, że chodzi o **aplikację**, nie o słowo.
   Stąd zasada dla całej treści i wszystkich profili: encja nazywa się **„Bojo (bojo.pl)"**
   albo **„aplikacja Bojo"**, nigdy samo „Bojo" w pierwszym wystąpieniu w sekcji.
   `llm-context.md` już to robi dobrze; `llms.txt` częściowo.
3. W danych strukturalnych trzeba to powiedzieć maszynom wprost — `alternateName`
   i `disambiguatingDescription` (rozdział 5).

Jest i druga strona: nazwa jest semantycznie **natywna** dla dziedziny. Gdy marka już
zaistnieje, „bojo" i „boisko" wzmacniają się nawzajem. Problemem jest wyłącznie okres,
w którym marka jest nieznana — czyli teraz.

### 2d. Warstwa GEO — zestaw pomiarowy

Czterdzieści promptów po polsku, w czterech koszykach, w **Załączniku A**. Zestaw jest
celowo stały: sens ma wyłącznie porównanie tej samej listy w czasie. Zmiana pytania
w połowie pomiaru kasuje historię.

Wartość bazowa: **niezmierzona** (brak dostępu do modeli z tej sesji). Jedyne, co udało
się ustalić, to że wyszukiwanie ograniczone do domeny `bojo.pl` nie zwróciło żadnego
wyniku — co jest słabą przesłanką, nie dowodem, bo to nie był indeks Google i nie był
to rynek polski. Pomiar bazowy jest **pierwszą pozycją roadmapy**, przed jakąkolwiek
optymalizacją: bez niego za trzy miesiące nie odróżnimy poprawy od wrażenia poprawy.

---

## 3. Audyt istniejących stron z gotowym copy

Kryterium jest jedno i wynika z tego, jak modele wybierają, co zacytować: **czy fragment
wyrwany z kontekstu strony nadal odpowiada na pytanie i nadal nazywa Bojo po imieniu.**
Wszystkie proponowane teksty są gotowe do wklejenia — po polsku, bez języka
marketingowego, bez liczb, których nie da się dziś obronić.

Reguła przy każdej zmianie: copy stron treści żyje w `frontend/src/content/*.ts`
i jest testowane (`tresciStron.test.ts`, `landingContent.test.ts`). Nowy tekst wchodzi
tam, nie do JSX.

### 3a. `/` — strona główna

**Stan:** H1 „Zorganizuj mecz / w dwie minuty", lead „Stwórz grę i wyślij ekipie jeden
link…". Sekcje: hero → statystyki → trzy kroki → otwarte gry → wartości → boiska → FAQ.
`faqJsonLd(LANDING_FAQ)` z ośmioma pytaniami, pokrytymi widocznym tekstem. Stopka jest.

**Co jest nie tak dla modelu:** cała górna część strony nie zawiera **ani razu słowa
„Bojo"** w zdaniu, które mówi, czym to jest. Model cytujący pierwszy ekran dostaje
bezpodmiotowe polecenie „Zorganizuj mecz w dwie minuty" — przy nazwie kolidującej ze
słowem pospolitym (2c) to najgorszy możliwy start. Do tego trzy statystyki
(`LANDING_STATS`) to statyczne literały, a dwie sekcje mające dowodzić, że coś się
dzieje (otwarte gry, boiska), nie istnieją w HTML dla robota (D18).

**Nagłówek:** zostaje. Landing ma sprzedawać, a nie recytować definicję.

**Do dodania — akapit bezpośredniej odpowiedzi**, renderowany serwerowo pod hero,
przed statystykami (nowa stała w `components/home/landing/content.ts`):

> Bojo to darmowa aplikacja webowa do organizowania amatorskich meczów. Zakładasz grę —
> sport, boisko z mapy, termin i liczba miejsc — i wysyłasz jeden link tam, gdzie Twoja
> ekipa już rozmawia. Osoba z linkiem zapisuje się bez zakładania konta, podając imię
> i e-mail. Bojo liczy zajęte miejsca, prowadzi listę rezerwową z widoczną kolejnością
> i dzieli koszt wynajmu obiektu na graczy.

Sześćdziesiąt słów, cztery fakty, nazwa encji na początku. To jest fragment, który
model ma zacytować, gdy ktoś zapyta „czym jest Bojo".

**Statystyki:** albo liczone z bazy, albo z datą przy liczbie. Dziś `sportsValue: '4'`
i `priceValue: '0 zł'` są prawdziwe i bezterminowe — mogą zostać. `timeValue: '2 min'`
to obietnica, nie pomiar; zostawiam, ale nie dokładam do niej kolejnych. **Nie
proponuję dopisywania liczby boisk na landing**, dopóki nie ma jednego źródła tej
liczby (D13) — cztery różne wartości w serwisie są gorsze niż jej brak.

**Otwarte gry i boiska:** obie sekcje powinny renderować się serwerowo (te same dane
są już pobierane serwerowo na `/[sport]/[miasto]`). To jedyne miejsce, w którym strona
główna dałaby robotowi linki w głąb serwisu — dziś nie daje żadnych.

### 3b. `/jak-dziala-bojo`

**Stan:** najlepsza strona w serwisie. Bezpośrednia odpowiedź nad spisem treści,
dwanaście sekcji H2, `HowTo` + `FAQPage` pokryte widoczną treścią, sekcja „Czego Bojo
nie robi". Nie ruszać struktury.

**Trzy braki:**

1. **Rozliczenie nie ma własnej odpowiedzi.** Sekcja `pieniadze` istnieje i jest dobra,
   ale klaster z S3 („jak podzielić koszt boiska") zasługuje na własną stronę (4a) —
   tutaj zostaje link do niej.
2. **Brak jawnego odróżnienia od systemów rezerwacji.** Zdanie z
   `content/miasta.ts#CZYM_BOJO_NIE_JEST` jest na stronach miejskich, a nie ma go tam,
   gdzie modele czytają najczęściej. **Do dodania jako nowa sekcja H2 „Bojo a systemy
   rezerwacji obiektów"**, przed „Czego Bojo nie robi":

   > Bojo nie wynajmuje obiektów i nie pośredniczy w opłatach za termin. Halę czy orlik
   > załatwiasz tak jak dotąd — bezpośrednio z obiektem. Bojo zaczyna się krok później:
   > gdy termin jest już Twój, a trzeba zebrać na niego ludzi, policzyć miejsca
   > i podzielić rachunek. Dlatego Bojo bywa używane razem z systemem rezerwacji tego
   > samego obiektu, nie zamiast niego.

3. **Nowe pytania do FAQ** (do `content/faq.ts`, kategoria `organizator`):

   | Pytanie | Odpowiedź |
   |---|---|
   | „Czy Bojo zadziała dla ekipy, która gra od lat tym samym składem?" | „Tak — to najczęstszy przypadek. Zakładasz mecz, wklejasz link na czat, którego ekipa już używa, i przestajesz liczyć „+1" w komentarzach. Nikt nie musi zakładać konta ani zmieniać miejsca, w którym rozmawiacie." |
   | „Ile osób musi mieć konto, żeby to działało?" | „Jedna — organizator. Pozostali zapisują się z linku, podając imię i e-mail." |
   | „Co, jeśli ekipa nie chce kolejnej aplikacji?" | „Nie musi jej mieć. Bojo działa w przeglądarce, a dołączenie do meczu nie wymaga konta ani instalacji. Kolejną aplikację zakłada wyłącznie organizator." |

### 3c. `/dlaczego-bojo`

**Stan:** bezpośrednia odpowiedź, lista bolączek, dziesięciowierszowa tabela
porównawcza, sekcje o koncie, o tym, czego Bojo nie zastąpi, i uczciwa sekcja
o wczesnym etapie. Tabela porównawcza to najlepszy materiał cytacyjny w całym
serwisie — modele sięgają po tabele chętniej niż po prozę.

**Dwa braki:**

1. **Tabela jest w DOM dwa razy** (wersja tabelaryczna i karty `md:hidden`). Dla
   człowieka niewidoczne, dla robota to ta sama treść zduplikowana na jednej stronie.
   Nie jest to błąd krytyczny, ale osłabia jednoznaczność — warto sprawdzić przy okazji.
2. **Brak wiersza rozstrzygającego kategorię.** Tabela porównuje Bojo z grupą na
   Facebooku. Model pytający „czym to się różni od aplikacji do rezerwacji" nie dostaje
   odpowiedzi. **Do dodania jako nowa sekcja H2 „Trzy różne rzeczy, które ludzie mylą"** —
   bez nazywania konkretnych produktów, bo to nie jest strona porównawcza:

   > **System rezerwacji obiektu** odpowiada na pytanie „czy hala jest wolna w czwartek
   > o 20:00" i przyjmuje opłatę za termin. **Komunikator** (WhatsApp, Messenger)
   > odpowiada na „kto idzie", ale liczyć trzeba samemu. **Bojo** jest trzecią rzeczą:
   > przyjmuje zapisy na konkretny, już ustalony termin, liczy skład i rezerwę i dzieli
   > koszt na graczy. Bojo nie rezerwuje obiektu i nie zastępuje czatu ekipy — działa
   > obok jednego i drugiego.

   Ten akapit jest napisany wprost pod S6: pod pytanie „czym to właściwie jest".

### 3d. `/faq`

**Stan:** 39 pytań w sześciu kategoriach, pełny `FAQPage`, treść pokrywa się ze schemą.

**Braki:**

1. **Pytania nie są nagłówkami.** Siedzą w `<summary>` wewnątrz `<details>`, więc
   strona ma H1, sześć H2 (kategorie) i ani jednego H3. Struktura nagłówków jest
   głównym sposobem, w jaki maszyna dzieli długą stronę na cytowalne kawałki.
   **Poprawka:** `<summary><h3>{pytanie}</h3></summary>` w `MiniFaq.tsx` — zero zmian
   wizualnych, pełna struktura dla maszyn.
2. **Brakuje pytań z klastrów, na które Bojo realnie odpowiada** (S2, S3). Do dopisania
   w `content/faq.ts`:

   | Kategoria | Pytanie | Odpowiedź |
   |---|---|---|
   | `pieniadze` | „Jak podzielić koszt boiska, gdy część graczy ma karty sportowe?" | „Wpisujesz koszt wynajmu obiektu, a Bojo dzieli go na miejsca i przelicza po każdej zmianie liczby graczy. Posiadacze kart Multisport, FitProfit i Medicover Sport mogą mieć własną stawkę, więc rachunek zgadza się bez liczenia w głowie. Bojo rejestruje, kto oddał — pieniądze krążą poza aplikacją." |
   | `organizator` | „Czy da się prowadzić zapisy bez zakładania grupy?" | „Tak. Grupa przydaje się stałej ekipie, ale do pojedynczego meczu wystarczy sam link — działa dla każdego, kto go dostanie." |
   | `podstawy` | „Czym Bojo różni się od systemu rezerwacji boisk?" | „System rezerwacji odpowiada na pytanie, czy obiekt jest wolny, i przyjmuje opłatę za termin. Bojo tego nie robi — zaczyna się tam, gdzie termin jest już załatwiony, i zajmuje się zebraniem składu, listą rezerwową i podziałem kosztu między graczy." |
   | `boiska` | „Skąd wiadomo, czy na boisku jest oświetlenie?" | „Podstawą są dane z OpenStreetMap, a obok nich pokazujemy głosy graczy: przy każdym obiekcie można potwierdzić oświetlenie i nawierzchnię. Potwierdzenie pojawia się dopiero, gdy zgodzą się co najmniej dwie osoby, i nie nadpisuje danych źródłowych." |

### 3e. `/[sport]/[miasto]`

**Stan:** najgęściej zalinkowana strona serwisu, dobra bezpośrednia odpowiedź
(`odpowiedzMiasta`), uczciwy komunikat przy braku meczów, zdanie odróżniające od
systemów rezerwacji, licznik obiektów w okolicy liczony geograficznie.

**Braki:** wejście tylko z hubu sportu i zawsze na Poznań (D8) — to naprawa linkowania
z 4b, nie copy. Poza tym strona jest gotowa. **Nie dokładać tu treści** i nie rozszerzać
listy miast (uzasadnienie w S4 i w anty-liście).

### 3f. `/boisko/[id]` — najważniejsza zmiana w całym dokumencie

**Stan:** dla człowieka strona jest kompletna. Dla robota to dwa `<script>` z JSON-LD
i pusty szkielet (D5), bez jednego linku wychodzącego (D6), z opisem obiecującym
rezerwację (D2) i tytułem z podwójnym sufiksem (D3). Mówimy o **32 096 stronach**
(Tier 1 + Tier 2), czyli o praktycznie całym indeksowalnym wolumenie serwisu.

**ZROBIONE 2026-08-23.** Rozwiązane inaczej, niż zakładał ten szkic, i lepiej: zamiast
drugiego nagłówka w `page.tsx` (co dałoby dwa `<h1>` po hydratacji) powstał wspólny
`NaglowekObiektu` w `VenueDetailClient.tsx`, renderowany w OBU stanach. Stan ładowania
JEST tym, co dostaje crawler — więc przestał być szarym szkieletem i wypełnia się
danymi z `page.tsx`. Człowiek zyskał przy okazji: od pierwszej klatki widzi, na jakim
obiekcie jest. Szkic pierwotny zostaje niżej jako zapis decyzji.

**Poprawka nie polega na pisaniu treści — treść już istnieje.** `opisObiektu()` generuje
poprawny akapit i jest przekazywany jako prop. Rzecz w tym, żeby renderować go
serwerowo, **nad** komponentem klienckim:

```tsx
// page.tsx — przed <VenueDetailClient />
<main>
  <h1>{field.name}</h1>
  <p>{opis}</p>
  <p>{field.address}</p>
  <nav aria-label="Powiązane">
    {wojewodztwoSlug && (
      <Link href={`/boiska/woj/${wojewodztwoSlug}`}>
        Boiska w województwie {wojewodztwoLabel}
      </Link>
    )}
    {sportSlug && <Link href={`/boiska/${sportSlug}`}>Wszystkie boiska do {sportLabel}</Link>}
    <Link href="/jak-dziala-bojo">Jak zebrać skład na ten obiekt</Link>
  </nav>
</main>
```

Komponent kliencki zostaje bez zmian i przejmuje stronę po hydratacji — tak jak dziś.
Jedno posunięcie zamyka D5, D6, D7 i połowę D9: strona obiektu przestaje być ślepym
zaułkiem, a staje się drogą do hubów.

**`description` w metadanych** powinno pochodzić z tego samego `opisObiektu()` co
widoczna treść — jedno źródło zamiast dwóch wersji opisu tego samego obiektu (i przy
okazji koniec z „zarezerwuj termin", D2).

### 3g. `/boiska/[sport]` i `/boiska/woj/[wojewodztwo]`

**Stan:** H1, jedna linijka „Znalezionych obiektów: N", lista i paginacja. Zero prozy.
Dla wyszukiwarki to strona listingowa bez treści — dokładnie ten typ, który przegrywa
z serwisem, który obok listy tłumaczy, co na niej jest.

**Do dodania** — akapit bezpośredniej odpowiedzi pod H1, generowany z danych, wzorem
`content/miasta.ts#zdanieOKatalogu` (nowa funkcja w `content/`, nie w JSX).

Dla hubu sportu:

> W katalogu Bojo jest {N} obiektów, na których da się zagrać w {sport} — od orlików
> i boisk osiedlowych po hale. Dane pochodzą z OpenStreetMap, a szczegóły takie jak
> nawierzchnia i oświetlenie potwierdzają gracze przy poszczególnych obiektach. Bojo
> nie wynajmuje tych obiektów: służy do zebrania składu na termin, który już masz.

Dla hubu wojewódzkiego — to samo z nazwą województwa.

**Do dodania — linkowanie poziome**, bo obie strony są dziś końcem drogi: hub
wojewódzki linkuje do pozostałych piętnastu województw i do hubów sportowych; hub
sportu linkuje do szesnastu województw zamiast do jednego zahardkodowanego miasta.
Szczegóły w 4b.

**Stopka:** ~~obie strony jej nie mają~~ — dodana 2026-08-23 (D9), razem z grupą
„Boiska" prowadzącą do sześciu hubów sportowych z każdej strony, która stopkę ma.

---

## 4. Architektura treści i skala

### 4a. Nowe typy stron — dwa, nie dziesięć

Przy dwuosobowym zespole każdy nowy typ strony to zobowiązanie na lata. Poniższe dwa
mają uzasadnienie w rozdziale 1; wszystko inne odpada do czasu, aż te dwa zadziałają.

**N1. `/kalkulator-kosztow-boiska` — strona narzędziowa (priorytet najwyższy)**
**ZROBIONE 2026-08-24.**

- **Intencja:** klaster „Rozliczenie" i „Karty sportowe" z 2a, sytuacja S3.
- **Dlaczego pierwsza:** to jedyna strona w całym planie, która **nie potrzebuje ani
  jednego użytkownika, ani jednego meczu i ani jednego linku**, żeby być użyteczna.
  Odpowiada na pytanie zadawane niezależnie od tego, czy Bojo istnieje, a odpowiada na
  nie lepiej niż kalkulator ogólny, bo uwzględnia karty sportowe — polską specyfikę,
  której narzędzia zagraniczne nie mają.
- **Zawartość:** działający kalkulator (koszt obiektu, liczba graczy, ilu z kartą,
  stawka dla posiadacza karty) + akapit bezpośredniej odpowiedzi + FAQ + naturalne
  przejście do założenia meczu.
- **Kod:** liczy `priceForParticipant()` z `lib/payments.ts` — ta sama funkcja co
  w aplikacji, zgodnie z regułą z AGENTS.md („cenę zawsze liczy `priceForParticipant()`").
  **Doszła jedna rzecz, której ten szkic nie przewidział:** kalkulator bierze koszt
  CAŁEGO obiektu i dzieli go na graczy — tej formuły `lib/payments.ts` wcześniej nie
  miał, bo w aplikacji organizator wpisuje cenę per gracz wprost (kreator w
  `app/wydarzenia/nowe/page.tsx` liczy podział inline, w PLN-stringu, przy każdym
  wpisanym znaku). Zamiast pisać drugi wzór, wydzielono `perPlayerPriceGrosze()` do
  `lib/payments.ts` — matematycznie tożsamy z formułą kreatora (zweryfikowane
  w `payments.test.ts` na tej samej parze liczb), tylko liczony wprost w groszach
  zamiast przez tekstowe pole formularza. Sam kreator zostaje nietknięty — refaktor
  jego działającego kodu pod DRY nie był częścią tego zadania. Orkiestracja obu funkcji
  (przycinanie wejścia z formularza, składanie wyniku) jest w `lib/kalkulatorKosztow.ts`,
  osobno od komponentu klienckiego, żeby dało się przetestować bez renderowania.
- **Renderowanie:** strona statyczna, kalkulator po stronie klienta. Bez `useSearchParams()`
  — potwierdzone w buildzie: `○ /kalkulator-kosztow-boiska`.
- **Copy — akapit otwierający:**

  > Koszt wynajmu boiska dzieli się na liczbę graczy, którzy realnie wchodzą do składu —
  > nie na tych, którzy „może wpadną". Przy 280 zł za halę i czternastu graczach wychodzi
  > 20 zł od osoby. Jeśli część ekipy ma kartę Multisport, FitProfit albo Medicover
  > Sport, ich stawka bywa inna, więc reszta dopłaca różnicę. Ten kalkulator liczy to
  > tak samo, jak robi to Bojo przy każdym meczu, i przelicza wynik za każdym razem,
  > gdy skład się zmienia.

**N2. `/boiska/[sport]/[miasto]` — brakująca warstwa katalogu**
**ZROBIONE 2026-08-25.**

- **Intencja:** klaster „Lokalne: obiekt", dziś rozstrzelony między hub krajowy
  a wojewódzki (kanibalizacja z 2b).
- **Źródło danych:** `fields` z wypełnionym `city` i sportem. **Lista miast jest
  ograniczona tabelą `miasta_priorytetowe`** (migracja `112`) — nie generujemy strony
  dla każdej miejscowości, jaka wpadła z OpenStreetMap.
- **Próg jakości — strona NIE powstaje**, gdy w danym mieście i sporcie są mniej niż
  **3** obiekty. **Decyzja właściciela (2026-08-25), nie propozycja z 4c** — 4c
  (próg dowodowy „potwierdzenie/mecz/komplet danych") jest odrzucone, więc bazą liczenia
  zostaje dzisiejsza definicja indeksowalności: `seo_tier IN (1, 2)`, ta sama, której
  używa `sitemap-boiska/[plik]/route.ts`. Pusta strona lokalna szkodzi bardziej, niż
  pomaga — to ta sama zasada, która jest już zapisana w komentarzu `content/miasta.ts`.
- **Renderowanie:** `force-dynamic`, bez `generateStaticParams()` — wzorem
  `/boiska/[sport]` i `/boiska/woj/[wojewodztwo]` (siostrzane huby, nie `/boisko/[id]`,
  które używa `revalidate` — dwa różne, już istniejące wzorce w tym samym katalogu, oba
  bez liniowego kosztu przy buildzie). Próg poniżej 3 obiektów i błąd zapytania do bazy
  dają ten sam wynik — 404, nigdy 500.
- **Sitemap:** `lib/hubMiasta.ts#paryHubowMiastSportu()` — jedno zapytanie na sport
  z `KATALOG_SPORT_MAP` (siedem, nie sto razy siedem), zawężone do miast z listy
  priorytetowej, więc ograniczone niezależnie od wielkości katalogu, jak `sportPages`
  i `wojewodztwoPages`. Degraduje do pustej listy przy niedostępnej bazie.

**Czego NIE budujemy:** kolejnych miast w `/[sport]/[miasto]` (S4), bloga (rozdział 6
i anty-lista), stron per dzielnica (próg jakości nie do utrzymania przy dzisiejszych
danych), stron per nawierzchnia.

### 4b. Sieć linków — najtańsza rzecz o największym wpływie

Dzisiejszy stan w jednym zdaniu: **wszystko, co jest w sitemapie, jest albo osierocone,
albo puste.** Robot dostaje listę adresów bez sieci, która by je łączyła, więc żaden
sygnał nigdzie nie płynie.

Docelowo cztery warstwy, każda linkująca w obie strony:

```
/                          → /boiska/[sport] (6-7), /jak-dziala-bojo, /faq, /mapa
/boiska/[sport]            → 16 województw, [sport]×[miasto] dla miast priorytetowych
/boiska/woj/[x]            → pozostałe 15 województw, huby sportowe, miasta w regionie
/boiska/[sport]/[miasto]   → obiekty, hub sportu, hub województwa, /[sport]/[miasto]
/boisko/[id]               → hub województwa, hub sportu, /jak-dziala-bojo   ← dziś ZERO
```

W poprzek: strona obiektu ↔ mecze na tym obiekcie (`upcomingEvents` już są pobierane
serwerowo, tylko nie renderowane w HTML), strona meczu → strona obiektu,
`/[sport]/[miasto]` ↔ `/boiska/[sport]/[miasto]`.

Trzy naprawy, każda na kilkanaście linijek:

1. **Stopka na wszystkich stronach publicznych** (D9) — dziś jest na czterech typach,
   a to jedyne miejsce z linkami do stron treści.
2. **Link ze strony głównej do hubów sportowych** — dziś nie ma **żadnego** wejścia
   z landingu do katalogu poza mapą, która dla robota jest pusta (D10).
3. **Serwerowy `<nav>` na stronie obiektu** (3f) — zamyka hierarchię od dołu.

### 4c. Ile obiektów powinno być w indeksie — mniej niż dziś

**ODRZUCONE 2026-08-25.** Decyzja właściciela: nie zmniejszamy indeksu. Obiekty
w katalogu Bojo są dziś przede wszystkim pinezkami na mapie — mają wartość samą
w sobie jako miejsce do znalezienia, niezależnie od tego, czy mają potwierdzenie
albo rozegrany mecz. Dodatkowe dane (ankiety, uzupełnienia adminów) są plusem,
nie warunkiem obecności w wyszukiwarce. `seo_tier`/`oblicz_seo_tier()` (migracja
`112`) zostają bez zmian — poniższe rozumowanie zostaje w dokumencie jako
uzasadnienie propozycji, która nie weszła w życie, nie jako plan do zrobienia.

Dziś indeksowalne jest **32 096 stron** (Tier 1 + Tier 2). Uczciwa odpowiedź brzmi:
**to o rząd wielkości za dużo jak na to, co mamy do powiedzenia**.

Rozumowanie:

- Strona obiektu, na którym nikt nigdy nie zagrał i o którym wiemy tylko tyle, ile
  było w OpenStreetMap, nie wnosi nic ponad to, co jest w OpenStreetMap. Powiela dane
  źródłowe, konkuruje z katalogiem mającym przewagę wieku i zjada budżet skanowania.
- Wartość dodana Bojo przy obiekcie jest dokładnie jedna: **czy tu się gra i czy dane
  się zgadzają według ludzi, którzy tam byli**. To jest treść, której nie ma nikt inny —
  i której dziś prawie nie mamy, bo mechanizm potwierdzeń ruszył w sierpniu 2026.

**Proponowany próg dowodowy.** Strona obiektu jest indeksowalna, gdy spełnia
przynajmniej jeden warunek:

1. ma co najmniej jedno potwierdzenie graczy po osiągnięciu kworum
   (`potwierdzenia_obiektu`, migracja `123`), albo
2. odbył się na niej kiedykolwiek jakikolwiek mecz, albo
3. ma komplet danych podstawowych: nazwę, adres, miejscowość, sport **i** nawierzchnię
   lub informację o oświetleniu.

Mechanizm już istnieje — to `seo_tier` i funkcja `oblicz_seo_tier()` z migracji `112`
wraz z wyzwalaczami promocji. Nie trzeba nowej maszynerii, trzeba zmienić definicję
tieru. Reszta katalogu zostaje w aplikacji: na mapie, w wyszukiwarce obiektów, jako
miejsce meczu. **Niewidoczność w Google nie jest karą dla obiektu — jest przyznaniem,
że nie mamy o nim nic do powiedzenia.**

Ile stron zostanie: **SZACUNEK — rząd kilku tysięcy na starcie** (dziś Tier 1 to 3 605
obiektów, a warunków 1 i 2 praktycznie nikt nie spełnia: przy audycie mecz miało kiedyś
około czterdziestu obiektów). Weryfikacja: zapytanie z Załącznika B, punkt 7.

Efekt uboczny jest najciekawszą częścią tego pomysłu: **indeks zaczyna rosnąć wtedy,
gdy rośnie produkt.** Każde potwierdzenie od gracza i każdy rozegrany mecz promuje
obiekt do indeksu. To pętla, której konkurent bez społeczności nie odtworzy — wraca
w rozdziale 8.

### 4d. Jak powiedzieć maszynie, czym Bojo nie jest

Rozproszone dziś w `content/miasta.ts#CZYM_BOJO_NIE_JEST`. Powinno stać w czterech
miejscach, tym samym zdaniem (jedno źródło, importowane):

| Miejsce | Po co |
|---|---|
| `/jak-dziala-bojo`, sekcja „Bojo a systemy rezerwacji obiektów" (3b) | strona najczęściej czytana przez modele |
| `/dlaczego-bojo`, sekcja „Trzy różne rzeczy, które ludzie mylą" (3c) | ujęcie kategorialne |
| `/faq`, pytanie „Czym Bojo różni się od systemu rezerwacji boisk?" (3d) | trafia do `FAQPage` |
| `llm-context.md`, sekcja „Czego Bojo NIE robi" | już tam jest — zostaje wzorcem |

---

## 5. Warstwa maszynowa

### 5a. Tożsamość encji — zmiana o największym znaczeniu

Dzisiejszy `Organization` (`lib/structuredData.ts:14-22`) nie mówi maszynie, że „Bojo"
to nazwa własna aplikacji, a nie potoczne słowo (2c). Do dodania:

```ts
{
  '@type': 'Organization',
  '@id': `${base}/#organization`,
  name: 'Bojo',
  alternateName: ['Bojo.pl', 'aplikacja Bojo'],
  // Nazwa koliduje z potocznym słowem „bojo" (= boisko). To pole jest jedynym
  // miejscem, w którym da się to maszynie powiedzieć wprost.
  disambiguatingDescription:
    'Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów sportowych '
    + 'w Polsce. Nazwa pokrywa się z potocznym polskim słowem „bojo" oznaczającym boisko '
    + '— ten wpis dotyczy aplikacji.',
  url: base,
  description: '…',
  areaServed: { '@type': 'Country', name: 'Polska', addressCountry: 'PL' },
  // sameAs: dopisać dopiero wtedy, gdy profile realnie istnieją (rozdział 6).
  // Puste albo zmyślone sameAs jest gorsze niż jego brak.
}
```

`sameAs` jest tu najważniejszym polem — i jedynym, którego dziś nie da się wypełnić
uczciwie, bo Bojo nie ma żadnego profilu poza własną domeną. To wiąże rozdział 5
z rozdziałem 6: **dane strukturalne nie zbudują encji, jeśli encja nie istnieje nigdzie
indziej.**

### 5b. Potwierdzenia graczy jako dane strukturalne

Faza 3 (mikro-ankiety) stworzyła dane, których nie ma nikt inny, i nie wystawiła ich
maszynom. `SportsActivityLocation` na `/boisko/[id]` powinien je nieść — ale
**wyłącznie po osiągnięciu kworum**, tego samego, które decyduje o pokazaniu ich
człowiekowi:

```ts
// tylko gdy liczbaGlosow >= 2 (to samo kworum co w AnkietyObiektu.tsx)
amenityFeature: [
  {
    '@type': 'LocationFeatureSpecification',
    name: 'Oświetlenie',
    value: true,
    // Źródło jest częścią faktu: to nie dane z OSM, tylko głos ludzi, którzy tam byli.
    description: 'Potwierdzone przez 4 graczy w Bojo',
  },
  {
    '@type': 'LocationFeatureSpecification',
    name: 'Nawierzchnia: sztuczna trawa',
    value: true,
    description: 'Potwierdzone przez 3 graczy w Bojo',
  },
],
```

To jest dokładnie ten rodzaj treści, po który sięgają modele: konkretny fakt
z podanym źródłem i liczbą. Żaden katalog importujący dane z OpenStreetMap nie może
tego mieć, bo nie ma ludzi, którzy tam grają.

### 5c. Czego NIE dodawać

- **`AggregateRating` i `Review`** — Bojo nie ma recenzji obiektów. Dodanie tego
  bez pokrycia w widocznej treści to sygnał spamu i realne ryzyko ręcznej kary,
  a nie przewaga. Ta sama zasada, która jest już zapisana przy `faqJsonLd()`
  i `howToJsonLd()`, obowiązuje wszędzie.
- **`SearchAction` w `WebSite`** — sprawdziłem: żadna publiczna trasa nie przyjmuje
  frazy wyszukiwania w adresie (`searchParams` obsługują wyłącznie `strona` i `tab`).
  Deklarowanie nieistniejącego adresu wyszukiwania to obietnica dla maszyny, której
  serwis nie spełnia. Dodać dopiero, gdy taka trasa powstanie.
- **`Dataset` dla katalogu** — kuszące (36 tys. obiektów brzmi jak zbiór danych), ale
  dane pochodzą z OpenStreetMap na licencji **ODbL**, która przy publikowaniu zbioru
  pochodnego wymaga udostępnienia go na tych samych warunkach. Dopóki nie ma decyzji,
  co dokładnie publikujemy i na jakiej licencji, `Dataset` obiecuje coś, czego nie
  wydajemy. Wraca w rozdziale 8 jako świadome posunięcie, nie jako dodatek do schemy.

### 5d. Co poprawić w tym, co już jest

| Co | Problem | Poprawka |
|---|---|---|
| `ItemList` na hubach | listuje obiekty z `noindex` (D11) | filtrować po progu z 4c — tym samym, co decyduje o indeksacji |
| `SportsEvent` | poprawny, ale strona nie ma `noindex` dla prywatnych (P1) | patrz P1 |
| `BreadcrumbList` na `/boisko/[id]` | prowadzi do hubu, do którego nie ma widocznego linku (D7) | rozwiązuje `<nav>` z 3f |
| `SoftwareApplication.featureList` | mówi o zniżkach z kart i o liście rezerwowej — zgodne z produktem | zostaje |

### 5e. `llms.txt` i `llm-context.md`

Zastrzeżenie z [README.md](./README.md) zostaje aktualne: żaden duży dostawca nie
potwierdził, że czyta `llms.txt`, więc plik ma być krótki i tani. Trzy zmiany:

1. **Ujednolicić liczbę obiektów** (D13). Jedna wartość, w jednym miejscu, z datą.
   Dziś w czterech miejscach są cztery różne.
2. **Dopisać jedno zdanie ujednoznaczniające** do nagłówka `llms.txt` i `llm-context.md`:
   „Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
   dokument dotyczy aplikacji bojo.pl." Model czytający plik na zimno dostaje wtedy
   rozstrzygnięcie od razu, a nie zgaduje.
3. **Nie rozbudowywać.** `llm-context.md` ma 34,8 tys. znaków i dobrą strukturę
   (bloki PROBLEM / ROZWIĄZANIE / MECHANIKA, pytania przy każdej sekcji). Dokładanie
   do niego treści marketingowej zepsuje jedyny plik w repo, który jest napisany
   dokładnie tak, jak trzeba.

**Czego nie robić:** nie dopisywać list słów kluczowych. Badania GEO (Aggarwal i in.,
KDD 2024) pokazują, że keyword stuffing wypada najsłabiej ze wszystkich testowanych
metod i obniża ocenę gęstości informacyjnej. Ta zasada jest już zapisana w AGENTS.md
i obowiązuje tak samo tutaj.

---

## Tło konkurencyjne — poza osią strategii

Oś tego dokumentu została świadomie utrzymana tam, gdzie stawia ją
[wizja.md](./wizja.md): Bojo konkuruje z chaosem w komunikatorach, nie z platformami.
Ten rozdział jest tłem, a nie zmianą kierunku — ale zapisuję go, bo wpływa na ocenę
ryzyka w rozdziale 9.

Rozpoznanie w wyszukiwarce (sierpień 2026) pokazało, że pole nie jest puste:

| Kategoria | Kto | Uwaga |
|---|---|---|
| Aplikacje do organizowania gierek | amator.app, Orlikfy, Meet and Play, LocalPlay | ta sama obietnica co Bojo: zbieranie składu, historia meczów, rozliczenia; LocalPlay ma wzmianki w mediach ogólnopolskich |
| Rezerwacja obiektów wchodząca w społeczność | BallSquad | rezerwacja i płatność online, ale **dokłada „Squad" i poziomy zaawansowania**, czyli wchodzi na pole Bojo od strony obiektów; ma udokumentowane wzmianki w portalach lokalnych i u zarządców obiektów |
| Katalogi boisk | boiskawpolsce.pl (deklaruje ~20 tys. obiektów, z recenzjami), orlik2012.pl, katalogi miejskie i portale MOSiR | bezpośredni incumbent dla klastra „Lokalne: obiekt" (S5) |

Trzy wnioski, które przenoszę dalej:

1. **Klaster lokalny obiektowy jest zajęty przez serwis z przewagą wieku i z recenzjami.**
   To wzmacnia rekomendację z 4c: nie ścigamy się liczbą wierszy, tylko danymi, których
   tamci nie mają.
2. **Wzmianki u zarządców obiektów i w portalach lokalnych działają w tym rynku** —
   widać to po śladzie, jaki zostawił BallSquad. To najlepiej udokumentowany kanał
   off-page dla produktu sportowego w Polsce i dlatego trafia do rozdziału 6 mimo
   ciasnego budżetu czasu.
3. **Zapytanie „jaka aplikacja do organizowania meczów" ma już kandydatów.** W S6
   Bojo nie startuje z pustego pola, tylko wchodzi do istniejącego zestawienia —
   co czyni gęstość faktów i jednoznaczne „czym to nie jest" jeszcze ważniejszymi.

---

## 6. Ślad w sieci przy budżecie poniżej dwóch godzin tygodniowo

Dane dostawców narzędzi GEO z 2026 mówią, że około dwie trzecie cytowań w odpowiedziach
AI pochodzi ze źródeł **spoza** własnej domeny, a pokrycie między pierwszą dziesiątką
Google a cytowaniami modeli spadło poniżej jednej piątej. **Traktuję to jako wskazówkę,
nie jako fakt** — to liczby firm sprzedających usługi GEO, nierecenzowane i wygodne dla
sprzedającego. Kierunek jest jednak zgodny z tym, co widać w S6: model porównuje opisy
z wielu źródeł, nie tylko z witryny producenta.

I tu jest główne napięcie tej strategii: **najmocniejsza dźwignia leży poza repo,
a poza repo mamy poniżej dwóch godzin tygodniowo.** Nie da się tego rozwiązać
planem — da się tylko wybrać. Wybieram cztery rzeczy o trwałej wartości i mówię
wprost, co przez to odpada.

### Co robimy

**1. Spójna nazwa encji — koszt zerowy, wpływ wysoki.**
Wszędzie, gdzie marka pada po raz pierwszy w sekcji: **„Bojo (bojo.pl)"** albo
„aplikacja Bojo", nigdy samo „Bojo". Dotyczy treści stron, opisów profili, wiadomości
do obiektów i wpisów w mediach. To nie jest kosmetyka: przy nazwie kolidującej ze słowem
pospolitym (2c) to jedyny sposób, żeby wzmianka w ogóle policzyła się do właściwej encji.
**Kto:** oboje, przy każdym tekście. **Sygnał:** zapytanie markowe w modelu przestaje
zwracać definicję słownikową.

**2. Trzy profile, raz a dobrze — łącznie ok. 2 godzin, jednorazowo.**
Nie dziesięć katalogów. Trzy miejsca, które modele realnie cytują przy pytaniach
„czym zastąpić X" i „jaka aplikacja do Y", i które nie wymagają utrzymania:
katalogi alternatyw dla oprogramowania oraz katalog aplikacji. Opis w każdym z nich
to ten sam akapit bezpośredniej odpowiedzi co z 3a — jedno źródło, zero wariantów.
Po założeniu profili **wracamy do `sameAs` w danych strukturalnych** (5a), bo dopiero
wtedy jest co tam wpisać. **Kto:** Jan. **Sygnał:** marka pojawia się w odpowiedzi na
pytanie kategorialne z koszyka 2 w Załączniku A.

**3. Wkład zwrotny do OpenStreetMap — ODRZUCONE 2026-08-25.**
Cały katalog Bojo pochodzi z OSM i mamy dane, których OSM nie ma (potwierdzenia
oświetlenia i nawierzchni), ale decyzja właściciela jest: nie ma potrzeby oddawać
tego z powrotem. Nie realizujemy — patrz ryzyko w rozdziale 8, posunięcie F1.

**4. Jeden kontakt tygodniowo do obiektu lub portalu lokalnego — do 1 godziny.**
Kanał z udokumentowanym śladem w tym rynku (patrz tło konkurencyjne). Panel
`/admin/outreach` już istnieje i już jest zadaniem Jana w [strategia.md](./strategia.md) §7 —
**nie dokładamy nowej roboty, tylko dopisujemy do istniejącej rozmowy jedno zdanie**:
prośbę o wzmiankę z linkiem, gdy obiekt i tak publikuje komunikaty o wydarzeniach.
**Kto:** Jan. **Sygnał:** pierwszy link przychodzący spoza własnych profili.

### Co przez ten budżet odpada — i niech to będzie zapisane

- **Regularna obecność na Reddicie, Wykopie i w grupach Facebooka.** Kanał wysokiej
  wartości dla GEO, ale wymaga bycia obecnym co tydzień przez miesiące. Przy dwóch
  godzinach to albo zniknie po trzech tygodniach, albo zamieni się w spam. Jedno i drugie
  jest gorsze niż nieobecność.
- **Blog i treści poradnikowe.** Bez autora z czasem martwy blog szkodzi: sygnalizuje
  porzucony serwis.
- **Wikidata.** Wymaga niezależnych źródeł, których Bojo nie ma. Wpis bez nich zostanie
  usunięty, a usunięcie jest gorszym sygnałem niż brak wpisu. Wracamy do tego, gdy będą
  wzmianki z punktu 4.
- **Kontakt z mediami i noty prasowe.** Kosztowne czasowo, nieprzewidywalne.

### Czego nie robimy nigdy

Żadnego udawania użytkowników, kupowania linków ani zakładania kont, które mają
wyglądać na cudze. Nie z powodów moralnych w pierwszej kolejności, tylko dlatego, że
przy jednej domenie i dwuosobowym zespole wykrycie oznacza utratę wszystkiego, co
zbudowaliśmy, a zysk jest niepewny. Jeśli ktoś kiedyś zaproponuje taktykę z tej szarej
strefy, ten akapit jest odpowiedzią.

---

## 7. Pomiar

Bez tego rozdziału cała reszta jest opinią. Zasada nadrzędna: **pomiar bazowy przed
pierwszą optymalizacją.** Jeśli zaczniemy zmieniać treść przed zmierzeniem, za trzy
miesiące nie odróżnimy poprawy od wrażenia poprawy.

### 7a. Co mierzymy

| Miernik | Czym | Jak często | Wartość bazowa |
|---|---|---|---|
| Pokrycie indeksu (ile stron realnie w Google) | Search Console → Strony | miesięcznie | **nieznana** — patrz Załącznik B.5. To najpewniej największa niespodzianka całego audytu: sitemapy zgłaszają dziesiątki tysięcy adresów, a strony obiektu są dla robota puste (D5) |
| Wyświetlenia i pozycje wg klastra z 2a | Search Console → Skuteczność | miesięcznie | nieznana |
| Obecność w odpowiedziach modeli | 40 promptów z Załącznika A | co 6 tygodni | **niezmierzona** |
| Wzmianki marki poza domeną | wyszukiwanie nazwy z kwalifikatorem | co 6 tygodni | **zero znanych** |
| Ruch crawlerów AI | logi Vercela wg `User-Agent` z `robots.ts:12-19` | miesięcznie | nieznana |
| Core Web Vitals | PageSpeed Insights na 5 typach stron | kwartalnie | **niemierzone nigdy** |
| Kontrakt HTML dla robota | `scripts/audyt-robota.mjs` (niżej) | przy każdym PR | do zbudowania |

### 7b. Progi sukcesu

Celowo skromne, bo punktem wyjścia jest zero, a produkt jest przed startem.

- **30 dni:** wartość bazowa zmierzona dla wszystkich pozycji z 7a. Wszystkie PILNE
  naprawione. Zero stron z pustym HTML wśród typów objętych kontraktem z 7c.
- **90 dni:** liczba stron w indeksie **spada** i to jest sukces (4c) — spada liczba
  śmieci, rośnie udział stron z treścią. W koszyku markowym Załącznika A model podaje
  poprawną odpowiedź, czym jest Bojo, zamiast definicji słownikowej. Pierwszy link
  przychodzący spoza własnych profili.
- **180 dni:** Bojo pojawia się w odpowiedzi na przynajmniej jedno pytanie kategorialne
  (koszyk 2) i przynajmniej jedno problemowe (koszyk 3). Strona kalkulatora (N1) ma
  niezerowe wyświetlenia w Search Console na frazy z klastra „Rozliczenie".

### 7c. Co da się zautomatyzować

Repo ma jedenaście workflowów, w tym gotowy wzorzec bramki
(`.github/bramka-scenariuszy.mjs`). Proponuję jeden nowy skrypt, bo dokładnie ta klasa
błędu przeszła dziś niezauważona przez `tsc`, Vitest, ESLint i Playwrighta naraz:

**`scripts/audyt-robota.mjs`** — pobiera zbudowaną aplikację po HTTP **bez wykonywania
JavaScriptu** (zwykły `fetch`, tak jak robi to crawler) dla po jednym adresie z każdego
typu strony i sprawdza:

1. jest dokładnie jeden `<h1>` i nie jest pusty,
2. `<title>` nie zawiera dwukrotnie `| Bojo`,
3. jest `<meta name="description">` i nie zawiera fraz z `content/zakazaneFrazy.ts`,
4. jest przynajmniej jeden `<a href="/...">` prowadzący w głąb serwisu,
5. strony, które mają być `noindex`, mają `noindex`, a te, które nie mają — nie mają,
6. każdy typ strony wymieniony w `sitemap.ts` przechodzi punkty 1–4.

To jest bramka, która **cofnęłaby dzisiejszy stan** i której brak sprawił, że Fazy 1
i 2b zostały odhaczone jako zrobione. Testy zrzutów ekranu tego nie łapią, bo Playwright
wykonuje JavaScript — czyli patrzy na aplikację z tej strony, z której problemu nie widać.

Pomiar w modelach zostaje ręczny: 40 promptów, raz na sześć tygodni, wynik dopisywany
do tabeli w tym dokumencie. Automatyzacja przez API kosztuje i wymaga kluczy — nie
przy tym budżecie.

---

## 8. Fosa — czego konkurencja nie skopiuje

Wszystko z rozdziałów 3–7 konkurent z budżetem odtworzy w kwartał. Poniższe nie —
bo wymaga posiadania tego, co Bojo ma, a czego nie da się kupić: katalogu 36 tys.
obiektów z OpenStreetMap **połączonego** ze zdarzeniami i z ludźmi, którzy na tych
obiektach grają.

Warunek, który odrzucił połowę pomysłów: **musi działać przy stu użytkownikach.**
Wszystko, co potrzebuje skali, jest planem na cudzy produkt.

### F1. Katalog weryfikowany przez grających, nie przez import

**Na czym polega:** przy każdym obiekcie gracze potwierdzają oświetlenie i nawierzchnię
(mechanizm istnieje od migracji `123`, kworum dwa głosy). To jedyna informacja
o polskich boiskach, której nie ma w OpenStreetMap i nie ma w żadnym katalogu
importującym z OSM — bo wymaga ludzi, którzy tam byli.
**Dlaczego nie do skopiowania:** katalog bez społeczności może dopisać pole
„oświetlenie", ale nie ma kto go wypełnić. Serwis z recenzjami ma opinie o obiektach,
a nie zweryfikowane fakty z kworum.
**Co trzeba zbudować:** wystawić te dane maszynom (5b) i uczynić je warunkiem indeksacji
(4c), czyli domknąć pętlę: gracz potwierdza → strona zyskuje treść → strona wchodzi
do indeksu.
**Ryzyko:** przy małej liczbie użytkowników kworum osiąga niewiele obiektów, więc
indeks rośnie wolno. To jest cecha, nie usterka — patrz F2.

### F2. Indeks, który rośnie razem z produktem

**Na czym polega:** strona obiektu wchodzi do wyszukiwarki dopiero wtedy, gdy ma dowód:
potwierdzenie graczy albo rozegrany mecz (próg z 4c). Wielkość indeksu przestaje być
liczbą wierszy w bazie, a staje się **miarą realnej aktywności**.
**Dlaczego nie do skopiowania:** konkurent może zaindeksować 20 tys. stron w tydzień,
ale nie może sprawić, żeby każda z nich miała dowód aktywności. My nie możemy tego
przyspieszyć pieniędzmi — ale też nikt nie może nas w tym wyprzedzić inaczej niż
budując społeczność.
**Ryzyko:** krótkoterminowo wygląda jak regres (mniej stron w indeksie). Trzeba to
zapisać w progach sukcesu, żeby za trzy miesiące nikt nie uznał tego za awarię —
zrobione w 7b.

### F3. Każdy publiczny mecz zostawia trwały, faktograficzny ślad

**ZAAKCEPTOWANE i ZROBIONE 2026-08-25.**

**Na czym polega:** publiczny mecz to strona z konkretnymi danymi (sport, termin,
miejsce, liczba miejsc, cena) i poprawnym `SportsEvent`. Organizator, który wraca co
tydzień, produkuje świeżą, prawdziwą treść bez żadnej pracy redakcyjnej. Świeżość jest
sygnałem, za który serwisy contentowe płacą redaktorom.
**Dlaczego nie do skopiowania:** wymaga organizatorów, nie budżetu.
**Co trzeba zbudować:** politykę cyklu życia strony meczu — mecz miniony nie może
zostawać w indeksie jako pusta obietnica. Propozycja: po rozegraniu strona meczu
przestaje być indeksowalna, a jego ślad **zasila stronę obiektu** („na tym obiekcie
rozegrano N meczów"), czyli wraca do F1 i F2 zamiast produkować śmieci.
**Ryzyko:** bez tej polityki dostajemy dokładnie ten typ cienkich, przeterminowanych
stron, przed którym ostrzega R1.

### F4. „Czy tu się w ogóle gra" — pytanie, na które nikt w Polsce nie odpowiada

**Na czym polega:** katalogi mówią, gdzie boisko jest. Bojo jako jedyne może
powiedzieć, czy ktoś na nim grał i kiedy — bo ma zdarzenia przypięte do obiektów.
Dla człowieka szukającego miejsca do gry to jest **ważniejsza informacja niż adres**.
**Dlaczego nie do skopiowania:** to pochodna F1 i F3; wymaga jednoczesnego posiadania
katalogu i zdarzeń.
**Ryzyko:** przy dzisiejszej liczbie meczów odpowiedź brzmi „nie wiemy" dla prawie
wszystkich obiektów. Nie wolno tego udawać — brak danych pokazujemy jako brak danych.

### F5. Widget „najbliższe mecze na tym obiekcie" dla zarządców

**Na czym polega:** obiekt osadza na własnej stronie mały widok z nadchodzącymi meczami
u siebie. Zarządca dostaje treść, która sama się aktualizuje, a Bojo — wzmiankę i link
z domeny o lokalnym autorytecie, w miejscu, gdzie sam ruch jest właściwy.
**Dlaczego nie do skopiowania przez katalog:** katalog nie ma czego wyświetlić, bo nie
ma zdarzeń.
**Dlaczego pasuje do budżetu Jana:** rozmowa z obiektem już się odbywa
(`/admin/outreach`, [strategia.md](./strategia.md) §7) — widget jest tym, co można w niej
zaoferować zamiast prośby o link.
**Ryzyko:** koszt utrzymania osadzanego komponentu i pusty widget przy braku meczów
(wtedy nie osadzać).

### F6. Zniżki z kart sportowych jako część modelu domenowego

**Na czym polega:** Multisport, FitProfit i Medicover Sport to polska specyfika,
policzona w `priceForParticipant()` i wpięta w rozliczenie meczu.
**Uczciwie: to nie jest fosa, tylko klin.** Konkurent może to dodać w tydzień. Wpisuję
to tutaj, żeby nie mylić jednego z drugim: kalkulator (N1) ma nam dać wejście do
klastra, którego nikt nie obsługuje, ale nie obroni pozycji sam. Broni jej dopiero
połączenie z F1–F4.

### Ryzyko wspólne: licencja danych

Katalog pochodzi z OpenStreetMap na licencji **ODbL**. Przy publikowaniu zbioru
pochodnego (eksport, publiczne API, `Dataset` w danych strukturalnych — 5c) licencja
wymaga udostępnienia go na tych samych warunkach i zachowania atrybucji. **Zanim
cokolwiek z F1–F5 zamieni się w wydawanie danych na zewnątrz, trzeba to rozstrzygnąć
osobno** — z wyjaśnieniem, co jest bazą z OSM, a co warstwą własną (potwierdzenia,
zdarzenia). Nie jest to przeszkoda, tylko warunek wstępny.

**Wkład zwrotny do OSM (6, punkt 3) — ODRZUCONE 2026-08-25.** Decyzja właściciela:
nie ma potrzeby oddawać potwierdzeń oświetlenia/nawierzchni z powrotem do OSM. Ryzyko
licencyjne opisane wyżej zostaje nieaktualne dla tego posunięcia — nic z warstwy
potwierdzeń nie jest wydawane na zewnątrz.

---

## 9. Roadmapa

Posortowana według stosunku wpływu do trudności. „Kto": Jan (biznes/growth) albo
Franek (tech/produkt), wg podziału z [strategia.md](./strategia.md) §7.

| # | Zadanie | Horyzont | Wpływ | Trudność | Kto | Pliki / miejsce | Miara sukcesu |
|---|---|---|---|---|---|---|---|
| 1 | Wyciek metadanych prywatnego meczu (P1) + test | QUICK WIN | wysoki | łatwa | Franek | `app/wydarzenia/[id]/{page,opengraph-image}.tsx`, `__tests__/` | prywatny mecz zwraca `noindex` i nie ujawnia miejsca ani terminu |
| 2 | Pomiar bazowy: Search Console + 40 promptów | QUICK WIN | wysoki | łatwa | Jan | Załączniki A i B | tabela w 7a wypełniona liczbami zamiast „nieznana" |
| 3 | „Zarezerwuj termin" znika z opisu 32 tys. stron (P2) | QUICK WIN | wysoki | łatwa | Franek | `app/boisko/[id]/page.tsx:180` | `audyt-robota` nie znajduje fraz zakazanych w `description` |
| 4 | Podwójny sufiks w tytułach (P3) | QUICK WIN | średni | łatwa | Franek | 5 plików z listy w P3 | zero tytułów z `\| Bojo \| Bojo` |
| 5 | `noindex` dla tras technicznych i za flagami (P4) | QUICK WIN | średni | łatwa | Franek | `app/robots.ts`, metadane tras | `/auth/*` i trasy za flagami poza indeksem |
| 6 | Serwerowy `<h1>`, opis i `<nav>` na stronie obiektu (3f) | QUICK WIN | **najwyższy** | średnia | Franek | `app/boisko/[id]/page.tsx` | robot bez JS widzi treść i linki na 32 tys. stron |
| 7 | Stopka na wszystkich stronach publicznych (D9) | QUICK WIN | wysoki | łatwa | Franek | `app/boiska/**`, `app/boisko/**` | każda strona publiczna prowadzi do stron treści |
| 8 | Link z landingu do hubów sportowych (4b.2) | QUICK WIN | wysoki | łatwa | Franek | `components/home/landing/` | katalog ma wejście z landingu w HTML |
| 9 | `scripts/audyt-robota.mjs` jako bramka CI (7c) | ŚREDNI | wysoki | średnia | Franek | `scripts/`, `.github/workflows/` | PR z pustą stroną nie przechodzi |
| 10 | ~~Akapit bezpośredniej odpowiedzi na landingu (3a)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | łatwa | Franek | `LandingDirectAnswer.tsx` | do zmierzenia w Załączniku A |
| 11 | ~~Sekcje odróżniające od systemów rezerwacji (3b, 3c, 3d, 4d)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | łatwa | Franek | `content/{jakDziala,dlaczego,faq}.ts` | do zmierzenia w Załączniku A |
| 12 | ~~Strona kalkulatora kosztów (N1)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | średnia | Franek | `/kalkulator-kosztow-boiska`, `lib/{payments,kalkulatorKosztow}.ts` | do zmierzenia: wyświetlenia na klaster „Rozliczenie" |
| 13 | `sameAs` + `disambiguatingDescription` w `Organization` (5a) | ŚREDNI | wysoki | łatwa | Franek po pkt. 15 | `lib/structuredData.ts` | zapytanie markowe przestaje zwracać definicję słownikową |
| 14 | ~~Serwerowy render otwartych gier i boisk na landingu (D18)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `LandingOpenGames.tsx`, `LandingVenues.tsx` | zweryfikowane na atrapie: linki do meczu i obiektu w HTML |
| 15 | Trzy profile poza domeną (6.2) | ŚREDNI | wysoki | łatwa | Jan | poza repo | jest co wpisać w `sameAs` |
| 16 | ~~Linkowanie poziome hubów (4b)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `app/boiska/**`, `lib/sports.ts` | zero stron osieroconych w `sitemap.ts` |
| 17 | ~~Akapity wprowadzające na hubach (3g)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | łatwa | Franek | `content/boiska.ts` | huby przestają być samą listą |
| 18 | ~~Potwierdzenia graczy w `amenityFeature` (5b)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `lib/structuredData.ts#venueAmenityFeatures` | zweryfikowane na atrapie: quorum ≥2 w JSON-LD |
| 19 | ~~Nowy próg indeksacji obiektów (4c)~~ **ODRZUCONE 2026-08-25** | DŁUGI | wysoki | trudna | Franek | migracja + `oblicz_seo_tier()` | — nie realizujemy, decyzja właściciela: nie zmniejszamy indeksu |
| 20 | ~~`/boiska/[sport]/[miasto]` (N2) — próg min. 3 obiekty (decyzja 2026-08-25, nie 4c)~~ **ZROBIONE 2026-08-25** | DŁUGI | średni | trudna | Franek | `app/boiska/[sport]/[miasto]/page.tsx`, `lib/hubMiasta.ts`, `sitemap.ts` | do zmierzenia w Załączniku A: koszyk 4 (lokalne) |
| 21 | ~~Polityka cyklu życia strony meczu (F3)~~ **ZROBIONE 2026-08-25** | DŁUGI | średni | średnia | Franek | `app/wydarzenia/[id]/eventMeta.ts`, `app/boisko/[id]/`, `content/opisObiektu.ts` | zweryfikowane testem: `robots.index=false` dla minionego meczu, treść i JSON-LD zostają |
| 22 | Jeden kontakt tygodniowo o wzmiankę (6.4) | DŁUGI | wysoki | średnia | Jan | `/admin/outreach`, poza repo | pierwszy link spoza własnych profili w 90 dni |
| 23 | ~~Wkład zwrotny do OSM (6.3, F1)~~ **ODRZUCONE 2026-08-25** | DŁUGI | średni | trudna | oboje | do rozstrzygnięcia licencyjnie | — nie realizujemy, decyzja właściciela |
| 24 | Widget dla zarządców obiektów (F5) | DŁUGI | średni | trudna | Franek | nowa trasa osadzalna | pierwszy obiekt z osadzonym widokiem |
| 25 | ~~Ujednolicenie liczby obiektów (D13)~~ **ZROBIONE 2026-08-24** | QUICK WIN | niski | łatwa | Franek | `content/dlaczego.ts`, `llms.txt`, landing | jedna liczba w jednym miejscu |
| 26 | ~~`.in('seo_tier',[1,2])` i usunięcie martwej gałęzi (D12)~~ **ZROBIONE 2026-08-24** | QUICK WIN | niski | łatwa | Franek | `sitemap-boiska/[plik]/route.ts`, `lib/sitemapTier.ts` | test opisuje zachowanie, które istnieje |
| 27 | Core Web Vitals — pomiar, potem decyzja | DŁUGI | nieznany | łatwa | Franek | PageSpeed Insights | są liczby, na których da się oprzeć decyzję |

### Pierwszy tydzień — pięć rzeczy, po kolei

1. **Poniedziałek:** PR z PILNE (pozycje 1, 3, 4, 5) — wyciek naprawiony tego samego dnia.
2. **Wtorek:** pomiar bazowy (pozycja 2). Jan, dwie godziny, Załączniki A i B. **Przed**
   jakąkolwiek zmianą treści.
3. **Środa:** serwerowy render strony obiektu (pozycja 6). Jedna zmiana, 32 tys. stron.
4. **Czwartek:** stopka wszędzie + link z landingu do katalogu (pozycje 7 i 8).
5. **Piątek:** bramka `audyt-robota` (pozycja 9), żeby poniedziałkowa robota nie odjechała
   przy najbliższym refaktorze.

### Czego nie robimy

1. **Nie dokładamy miast do `/[sport]/[miasto]`.** Dwanaście istniejących stron nie ma
   dziś linków przychodzących ani meczów do pokazania. Kolejne miasta pomnożą pustkę.
2. **Nie zwiększamy liczby indeksowanych stron obiektów — zmniejszamy ją** (4c).
   To jedyna rekomendacja w tym dokumencie, która wygląda jak cofanie się, i jedyna,
   która daje przewagę nie do skopiowania.
3. **Nie dodajemy `Review` ani `AggregateRating`.** Nie mamy recenzji. Schema bez
   pokrycia w treści to sygnał spamu.
4. **Nie zakładamy bloga ani sekcji poradnikowej.** Bez autora z czasem martwy blog jest
   gorszy niż jego brak.
5. **Nie walczymy o „rezerwacja boiska «miasto»" ani o samo „bojo".** Pierwsze to
   funkcja wyłączona flagą, drugie to słowo ze słownika (2c). Obie walki są przegrane
   przed startem.
6. **Nie optymalizujemy Core Web Vitals przed pomiarem.** Dziś nikt nie wie, czy jest
   co poprawiać. Zgadywanie tutaj kosztuje dni.
7. **Nie dopisujemy słów kluczowych do `llms.txt` ani nigdzie indziej.** Keyword
   stuffing to najsłabsza z metod GEO i obniża ocenę gęstości informacyjnej.
8. **Nie kupujemy linków i nie udajemy użytkowników** (6, „czego nie robimy nigdy").
9. **Nie budujemy stron per dzielnica ani per nawierzchnia.** Próg jakości z 4a nie do
   utrzymania przy dzisiejszych danych.

### Co może pójść nie tak

**R1. Cienkie strony podkopują zaufanie do całej domeny.** Mamy 32 tys. stron, z których
większość nie ma treści (D5). Jeśli naprawimy render, ale nie zawęzimy indeksu (pozycja
19), dostaniemy 32 tys. stron z jednym wygenerowanym akapitem — czyli dokładnie wzorzec,
który wyszukiwarki uznają za treść masową.
*Sygnał wczesnego ostrzegania:* w Search Console rośnie udział „Zeskanowano — obecnie
bez indeksu" i „Wykryto — obecnie bez indeksu". Reakcja: przyspieszyć pozycję 19.

**R2. Treść obiecuje więcej, niż produkt daje.** To już się dzieje: opis 32 tys. stron
mówi „zarezerwuj termin" o funkcji wyłączonej (D2), a strony miejskie zapraszają do
dołączania do meczów, których bywa niewiele. Konsekwencją nie jest kara od Google,
tylko utrata zaufania człowieka przy pierwszym kontakcie — i modelu, gdy raz zacytuje
nas nietrafnie.
*Sygnał:* rosną wyświetlenia, nie rosną kliknięcia; rosną wejścia na `/boisko/*`, nie
rosną założone mecze. Reakcja: cofnąć obietnicę, nie dokładać treści.

**R3. Ruch przychodzi, organizatorzy nie.** Pole nie jest puste (tło konkurencyjne),
a klastry lokalne są zajęte przez serwisy z przewagą wieku i przez aplikacje z realną
płynnością. Możemy wygrać pozycje i nie zdobyć ani jednego organizatora — bo problem
leży w produkcie albo w pozycjonowaniu, nie w widoczności.
*Sygnał:* po 90 dniach rosną wyświetlenia w klastrze narzędziowym, a liczba założonych
meczów przez osoby spoza kręgu znajomych stoi. Reakcja: przestać inwestować w treść
i wrócić do rozmowy o produkcie — SEO nie naprawi propozycji wartości.

---

## Załącznik A — zestaw pomiarowy: 40 promptów

Zestaw jest **stały**. Sens ma wyłącznie porównanie tej samej listy w czasie; zmiana
pytania w połowie pomiaru kasuje historię. Pytamy w czterech silnikach (ChatGPT,
Perplexity, Gemini, Copilot), bez zalogowanej historii, po polsku.

Dla każdego promptu notujemy trzy rzeczy: **czy Bojo padło** (tak/nie), **w którym
miejscu odpowiedzi** (główna rekomendacja / wyliczenie / przypis), **czy opis jest
prawdziwy** (bo cytowanie z błędem jest gorsze niż brak cytowania — zwłaszcza przy
D2 i D13).

### Koszyk 1 — markowe (czy encja w ogóle istnieje)

1. Czym jest Bojo (bojo.pl)?
2. Do czego służy aplikacja Bojo?
3. Czy Bojo jest darmowe?
4. Czy żeby dołączyć do meczu w Bojo, trzeba zakładać konto?
5. Jakie sporty obsługuje Bojo?
6. Czy przez Bojo zarezerwuję boisko?
7. Czy Bojo przyjmuje płatności za mecz?
8. W jakich miastach działa Bojo?
9. Czym Bojo różni się od aplikacji do rezerwacji obiektów sportowych?
10. Czy Bojo to polska aplikacja?

### Koszyk 2 — kategorialne (czy jesteśmy w zestawieniu)

11. Jaka aplikacja do organizowania amatorskich meczów piłki nożnej w Polsce?
12. Czym zastąpić ankietę na WhatsAppie do zapisów na cotygodniową gierkę?
13. Polska aplikacja do zbierania składu na mecz — co polecasz?
14. Jak prowadzić listę obecności na regularnej gierce ze znajomymi?
15. Narzędzie do organizowania meczów siatkówki dla amatorów?
16. Jak prowadzić zapisy na mecz online bez arkusza kalkulacyjnego?
17. Aplikacja do dzielenia kosztu wynajmu boiska między graczy?
18. Co jest wygodniejsze od grupy na Facebooku do organizowania gierek?
19. Darmowe narzędzie do prowadzenia stałej ekipy sportowej?
20. Aplikacja, w której gracze dołączają do meczu bez zakładania konta?

### Koszyk 3 — problemowe (czy odpowiadamy na ból)

21. Jak ogarnąć granie w piłkę ze znajomymi bez chaosu na WhatsAppie?
22. Jak policzyć, kto naprawdę przyjdzie na mecz, gdy ludzie piszą „+1" w komentarzach?
23. Co zrobić, gdy dzień przed meczem brakuje dwóch graczy do składu?
24. Jak sprawiedliwie podzielić 280 zł za halę między czternaście osób?
25. Jak rozliczyć koszt boiska, gdy część graczy ma kartę Multisport?
26. Jak prowadzić listę rezerwową na mecz, żeby nie było sporu o kolejność?
27. Jak ogarnąć, kto jeszcze nie oddał pieniędzy za boisko?
28. Jak zorganizować cotygodniową gierkę dla stałej ekipy?
29. Jak zaprosić ludzi na mecz, gdy część nie chce instalować kolejnej aplikacji?
30. Co zrobić, gdy ekipa odwołuje mecz w ostatniej chwili?

### Koszyk 4 — lokalne (najtrudniejszy, patrz S4 i S5)

31. Gdzie pograć w siatkówkę w Poznaniu?
32. Jak znaleźć ludzi do gry w piłkę w Warszawie?
33. Gdzie są boiska do siatkówki plażowej w Krakowie?
34. Szukam ekipy do koszykówki w Poznaniu — od czego zacząć?
35. Gdzie znajdę katalog polskich boisk z informacją o oświetleniu?
36. Jak znaleźć orlik w okolicy, na którym ktoś regularnie gra?
37. Przeprowadziłem się do nowego miasta — jak znaleźć ludzi do grania?
38. Gdzie sprawdzić, jaka nawierzchnia jest na konkretnym boisku?
39. Jakie są otwarte mecze piłki nożnej w Poznaniu w ten weekend?
40. Gdzie znajdę listę boisk w województwie wielkopolskim?

### Tabela wyników

| Data pomiaru | Koszyk 1 | Koszyk 2 | Koszyk 3 | Koszyk 4 | Uwagi |
|---|---|---|---|---|---|
| _do wypełnienia_ | –/10 | –/10 | –/10 | –/10 | pomiar bazowy |

---

## Załącznik B — checklista audytu produkcji

Do wykonania przez człowieka albo w środowisku z dostępem sieciowym do `bojo.pl`.
Wszystko poniżej sprawdza rzeczy, których **nie mogłem zweryfikować** z tej sesji.

**1. Co widzi robot na stronie obiektu** (weryfikacja D5 — najważniejszy punkt):

```bash
curl -s https://bojo.pl/boisko/<dowolny-slug> | grep -c "<h1"
# 0 = potwierdza D5: strona bez treści dla robota
curl -s https://bojo.pl/boisko/<dowolny-slug> | grep -o 'href="/[^"]*"' | sort -u
# pusto = potwierdza D6: zero linków wychodzących
```

**2. Podwójny sufiks w tytule** (D3):

```bash
curl -s https://bojo.pl/boisko/<slug> | grep -o "<title>[^<]*</title>"
# oczekiwane dziś: "… | Bojo | Bojo"
```

**3. Obietnica rezerwacji w opisie** (D2):

```bash
curl -s https://bojo.pl/boisko/<slug> | grep -o 'name="description" content="[^"]*"'
```

**4. Wyciek prywatnego meczu** (P1) — na **własnym** meczu prywatnym:

```bash
curl -s https://bojo.pl/wydarzenia/<id-prywatnego> | grep -E "<title>|description"
curl -sI https://bojo.pl/wydarzenia/<id-prywatnego>/opengraph-image | head -3
# obrazek zwracający 200 potwierdza, że karta meczu jest publiczna
```

**5. Pokrycie indeksu** — Search Console → Strony. Notujemy: ile zaindeksowanych, ile
„Zeskanowano — obecnie bez indeksu", ile „Wykryto — obecnie bez indeksu". **To jest
liczba, po której poznamy, czy 32 tys. stron w ogóle kogokolwiek obchodzi.**

**6. Sitemapy i to, czy ktokolwiek je czyta:**

```bash
curl -s https://bojo.pl/sitemap-index.xml | grep -c "<sitemap>"      # oczekiwane: 17
curl -s https://bojo.pl/sitemap-boiska/wielkopolskie.xml | grep -c "<url>"
```

Plus w Search Console: data ostatniego odczytu każdej sitemapy.

**7. Ile obiektów przeszłoby nowy próg indeksacji** (4c) — w SQL Editorze Supabase:

```sql
SELECT count(*) FROM fields f
WHERE f.map_visibility = 'public' AND (
  EXISTS (SELECT 1 FROM potwierdzenia_obiektu p WHERE p.field_id = f.id)
  OR EXISTS (SELECT 1 FROM events e WHERE e.field_id = f.id)
  OR (f.city IS NOT NULL AND f.surface IS NOT NULL)
);
```

**8. Marka w wynikach** — wyszukać w polskim Google: `bojo.pl`, `aplikacja Bojo`,
`site:bojo.pl`. Notujemy, czy cokolwiek jest w indeksie i czy marka nie jest mylona
ze słowem pospolitym (2c).

**9. Ruch crawlerów AI** — logi Vercela, filtr po `User-Agent` z listy w `robots.ts:12-19`.
Odpowiada na pytanie, czy wpuszczenie ich z nazwy cokolwiek dało.

---

## Czego nie sprawdziłem

Uczciwa lista granic tego dokumentu:

- **Produkcji `bojo.pl` nie widziałem.** Polityka sieciowa środowiska blokuje wszystkie
  domeny zewnętrzne poza wyszukiwarką. Każde twierdzenie o tym, co widzi robot, wynika
  z lektury kodu — dlatego Załącznik B istnieje i dlatego kolumna „Produkcja" w rozdziale 0
  jest pusta.
- **Search Console** — brak dostępu. Pokrycie indeksu, pozycje i wyświetlenia są
  nieznane, a nie oszacowane.
- **Odpowiedzi modeli** — nie mam wejścia do ChatGPT, Perplexity ani Gemini z tej sesji.
  Pomiar bazowy z Załącznika A jest niewykonany.
- **Wolumeny fraz** — brak narzędzia. Wszystkie oceny wielkości klastrów w 2a są
  **SZACUNKIEM** na podstawie struktury zapytania.
- **Polski SERP** — wyszukiwarka dostępna w sesji zwraca wyniki dla rynku amerykańskiego.
  Rozpoznanie konkurencji jest wiarygodne co do tego, **że** te produkty istnieją;
  nie jest wiarygodne co do tego, **jak wysoko** rankują w Polsce.
- **Dane liczbowe GEO z 2026** cytowane w rozdziale 6 pochodzą od firm sprzedających
  usługi GEO. Nierecenzowane i nie neutralne — traktowane jako wskazówka kierunku.

---

## Gdyby to był mój produkt i moje pieniądze

Zrobiłbym w tej kolejności trzy rzeczy i nic więcej przez miesiąc: naprawił wyciek
metadanych, bo to jedyna pozycja w tym dokumencie, która jest zobowiązaniem wobec
ludzi, a nie wobec wyszukiwarki; wyrenderował stronę obiektu po stronie serwera, bo
jedna zmiana w jednym pliku decyduje o tym, czy 32 tysiące stron istnieją, czy nie;
i zmierzył stan wyjściowy, zanim cokolwiek innego ruszę. Odpuściłbym w ogóle klaster
lokalny — i „szukam graczy w mieście", i „boiska w mieście" — bo w pierwszym wygrywa
płynność, której nie mamy, a w drugim serwis, który ma dziesięć lat przewagi
i recenzje; wchodzenie tam teraz to opłacanie cudzej przewagi własnym czasem.
Postawiłbym wszystko na jedno zdanie, które Bojo może powiedzieć prawdziwie i którego
nikt inny nie mówi: *to jest narzędzie dla człowieka, który już ma boisko i ekipę,
a ma dość liczenia „+1" w komentarzach.* Cała reszta — kalkulator, potwierdzenia
graczy, próg indeksacji rosnący z produktem — to są konsekwencje tego zdania,
a nie osobne pomysły. I nie budowałbym niczego nowego, dopóki bramka w CI nie pilnuje,
że to, co już zbudowane, faktycznie działa dla robota; bez niej za pół roku ten
dokument będzie opisywał kolejne trzy fazy odhaczone jako zrobione i tak samo
niedziałające.
