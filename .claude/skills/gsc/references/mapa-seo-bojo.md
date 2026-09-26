# Mapa SEO bojo.pl

Źródło prawdy dla „adres → typ strony → plik → oczekiwana indeksacja” to
`scripts/lib/mapa-bojo.mjs` (testowane: każdy plik istnieje, reguły robots.txt czyta
z `frontend/src/app/robots.ts`). Ten plik dokłada to, czego kod nie powie: DLACZEGO
tak jest, co już naprawiono i co czeka.

## Spis

1. Typy stron w skrócie
2. Host i canonical
3. Sitemapy
4. Dane strukturalne według typu strony
5. Historia napraw z GSC
6. Otwarte tematy (kandydaci na następne PR-y)

## 1. Typy stron w skrócie

| Typ | Adres | Ile | Indeksacja (zamierzona) |
|---|---|---|---|
| Obiekt | `/boisko/<nazwa>-<12 hex>` | ~36 tys. (Tier 1: 3,6 tys., Tier 2: 28,5 tys., Tier 3: 4,2 tys.) | Tier 1/2 tak; Tier 3 `noindex,follow` (migracja `112`) |
| Hub sportu | `/boiska/<sport>` | 6 | tak |
| Hub miasta | `/boiska/<sport>/<miasto>` | pary powyżej progu `lib/hubMiasta.ts` | tak; poniżej progu 404 |
| Hub województwa | `/boiska/woj/<woj>` | 16 | tak |
| Sport + miasto | `/<sport>/<miasto>` | iloczyn `FOCUS_SPORTS` × `content/miasta.ts` | tak |
| Mecz | `/wydarzenia/<uuid>` | każdy mecz | publiczny i przyszły: tak; publiczny miniony: `noindex,follow`; prywatny/nieistniejący: `noindex,nofollow`, bez JSON-LD i bez szczegółów w metadanych |
| Treść | `/`, `/jak-dziala-bojo`, `/dlaczego-bojo`, `/o-bojo`, `/faq`, `/kalkulator-kosztow-boiska`, `/regulamin`, `/prywatnosc` | 8 | tak |
| Listy aplikacji | `/wydarzenia`, `/grupy`, `/mapa` | 3 | tak, ale treść dociąga się po zamontowaniu (dług D10), niski priorytet w sitemapie |
| Zablokowane | lista `DISALLOW` w `robots.ts` | | kody dołączenia `/d/ /g/ /t/`, profile `/gracz/`, kreatory, `/turnieje` (flaga wyłączona), technika |

Warianty adresu obiektu (ważne przy każdym raporcie indeksowania):

| Wariant | Przykład | Co robi strona |
|---|---|---|
| kanoniczny | `/boisko/dubidzkie-lwy-741e4f384561` | renderuje, `canonical` na siebie |
| UUID | `/boisko/4ca4de66-…` | renderuje z `canonical` na kanoniczny → w GSC „Alternatywna strona z prawidłowym tagiem kanonicznym” |
| historyczny (sama nazwa) | `/boisko/boisko-pilkarskie` | `redirect()` = **307** na kanoniczny; przy nazwach rodzajowych trafia w przypadkowy obiekt |

## 2. Host i canonical

- Usługa w GSC: `https://www.bojo.pl/` (prefiks URL). Przykładowe adresy w raportach
  są z `www`.
- Kod bierze host z `NEXT_PUBLIC_SITE_URL`, a domyślnie ma `https://bojo.pl`
  (`app/layout.tsx`, `robots.ts`, `sitemap.ts`, `lib/structuredData.ts`). Sitemapy
  przechodzą w GSC jako „Sukces”, więc produkcja najpewniej ma ustawione `www`.
  **NIEZWERYFIKOWANE z repo.** Sprawdza to inspekcja adresu (`userCanonical`) albo
  podgląd sitemapy w przeglądarce. Rozjazd hostów wychodzi jako „Duplikat, Google
  wybrał inną stronę kanoniczną” i adresy z dwóch hostów w `gsc-eksport.mjs --adresy`.

## 3. Sitemapy

- Indeks: `/sitemap-index.xml` (`app/sitemap-index.xml/route.ts`) → `/sitemap.xml`
  (`app/sitemap.ts`: treść, huby, sport+miasto) + 16 × `/sitemap-boiska/<woj>.xml`
  (`app/sitemap-boiska/[plik]/route.ts`: tylko Tier 1+2, tylko `map_visibility = public`).
- Zgłoszona w GSC 2026-08-29; wcześniej Google znał 2 strony (docs/seo-geo-strategia.md, 7a.2).
- **Od 2026-09-26 wpisy boisk to adresy kanoniczne** (PR #435). Wcześniej sitemapa
  podawała klucz historyczny: 32 096 wpisów → 10 608 różnych adresów, każdy przez 307.
- Cache: dobę na CDN (`lib/naglowkiSitemap.ts`), więc zmiana w sitemapie dochodzi do
  Google najpóźniej po dobie plus czas ponownego pobrania przez Google.

## 4. Dane strukturalne według typu strony

| Strona | JSON-LD | Budowniczy | Raport w GSC |
|---|---|---|---|
| każda (layout) | Organization, WebSite, SoftwareApplication (`@graph`) | `siteJsonLd()` w `frontend/src/lib/structuredData.ts` | brak (Organization zasila logo/panel wiedzy) |
| mecz publiczny | SportsEvent | `eventJsonLd()` | Ulepszenia → Wydarzenia |
| obiekt | SportsActivityLocation + BreadcrumbList | inline w `frontend/src/app/boisko/[id]/page.tsx` + `breadcrumbsJsonLd()` | Menu nawigacyjne (okruszki) |
| huby katalogu | ItemList | `venueListJsonLd()` | brak (karuzela nie dla obiektów sportowych) |
| treść, sport+miasto | FAQPage, HowTo, BreadcrumbList | `faqJsonLd()`, `howToJsonLd()`, `breadcrumbsJsonLd()` | FAQ/HowTo wycofane przez Google; okruszki w Menu nawigacyjnym |

## 5. Historia napraw z GSC

| Data | Co zgłosił GSC | Przyczyna | Naprawa |
|---|---|---|---|
| 2026-08-29 | Mapy witryn: 0 zgłoszonych | sitemapa nigdy nie zgłoszona | zgłoszona ręcznie; 32 400 wykrytych 2026-09-01 |
| 2026-09-23 | Wydarzenia: 5 problemów niekrytycznych (2 mecze) | `eventJsonLd()` bez `description`, `image`, `performer`, `offers.validFrom`, `offers.availability` | PR #424 (2026-09-24), weryfikacja ruszyła 2026-09-24 |
| 2026-09-26 | (analiza, nie mail) przekierowania w Strony | sitemapa i huby budowały adres z samej nazwy | PR #435 |

Bieżący stan i terminy odczytów: `docs/gsc-dziennik.md`.

## 6. Otwarte tematy (kandydaci na następne PR-y)

Każdy z dowodem. Nie ruszać bez pomiaru przed i po (dziennik).

1. **`endDate` meczu bez godziny końca — ZBADANE 2026-09-26 (mail GSC z 10:31), NIE jest
   błędem kodu.** `eventJsonLd()` emituje `endDate` tylko przy `end_time`, a
   sprawdzenie produkcyjnej bazy pokazało: **0 publicznych meczów przyszłych** bez
   `end_time`, **11 publicznych meczów przeszłych** bez niego. Wszystkie 11 mają
   `created_at` między 2026-06-21 a 2026-08-10 — sprzed `EventDateTimeField.tsx`
   (2026-09-13, PR #370), czyli sprzed funkcji liczącej koniec z czasu startu i
   długości gry. Nie jest to defekt aktualnego kodu: powstały, zanim ta funkcja
   w ogóle istniała. Wszystkie są dziś `noindex,follow` (miniony mecz,
   `metadataDlaMeczu()`), więc Google i tak nie ma ich indeksować — zgłoszenie
   najpewniej pochodzi z pierwszego przetworzenia tych starych stron przy
   odkrywaniu długiego ogona katalogu (patrz „Wykryte strony” w 7a.2), nie z
   niedawnej zmiany. Builder odtworzony na dwóch meczach z poprzedniego zgłoszenia
   (`f1e98fe0…`, `4ca4de66…`, oba stworzone PO 2026-09-13) emituje `endDate`
   poprawnie u obu — to nie te dwa mecze.

   **Jeden prawdziwy, wąski przypadek pozostaje nieobsłużony:** `addMinutes()`
   w `EventDateTimeField.tsx` zwraca `null` (czyli brak `end_time`), gdy start +
   czas gry przekracza północ (np. 22:30 + 90 min). To ŚWIADOME, udokumentowane
   w kodzie ograniczenie, nie przeoczenie: `end_time` to kolumna `TIME` bez daty,
   powiązana niejawnie z `event_date`, więc koniec po północy wymagałby przejścia
   na kolejny dzień, którego dzisiejszy model nie ma jak zapisać bez zmiany schematu
   i bez przejrzenia WSZYSTKICH konsumentów `end_time` (eksport do kalendarza,
   `lib/bookings.ts`, wykrywanie kolizji rezerwacji, cykliczne mecze) — z tego
   REPO nie robimy tego przy okazji jednego niekrytycznego ostrzeżenia. Odtwarza
   się to tylko dla meczów zaczynających się na tyle późno, że standardowy czas gry
   (30–180 min) sięga za północ; dziś w bazie nie ma na to przykładu wśród
   przyszłych meczów.

   **Backfill 11 starych meczów guessed-durą (np. +90 min) świadomie ODŁOŻONY** —
   wymaga zgody właściciela: zmyślenie czasu zakończenia rozegranego meczu jest
   nieprawdą w danych, nawet jeśli nieszkodliwą (`docs/gsc-dziennik.md`, wpis
   2026-09-26).
2. **Data meczu bez strefy czasowej** (`2027-01-07T18:00:00`). Google przyjmie strefę
   miejsca, więc to nie błąd, ale jawne `+01:00`/`+02:00` (Europe/Warsaw, z uwzględnieniem
   zmiany czasu) usuwa zgadywanie. Jest `lib/czasPolski.ts`.
3. **Organization bez `logo`.** Google zaleca je do logo w wynikach i panelu wiedzy.
   Obraz ≥ 112×112, stały adres, indeksowalny.
4. **WebSite bez `alternateName`.** Nazwa witryny w wynikach pochodzi z WebSite na
   stronie głównej. Przy kolizji „bojo”/„boisko” (docs/seo-geo-strategia.md, 2c)
   `alternateName: ["Bojo.pl"]` to tani sygnał.
5. **`lastmod` w sitemapach.** `app/sitemap.ts` wpisuje `new Date()` każdej stronie przy
   każdej generacji, a Google używa `lastmod` tylko wtedy, gdy jest „spójnie
   i sprawdzalnie” prawdziwy. Sitemapy boisk nie mają `lastmod` wcale, choć
   `fields.updated_at` istnieje (wyzwalacz z `001`). Najpierw sprawdzić, czy importy
   i wzbogacania nie dotykają wszystkich wierszy naraz, bo wtedy data też kłamie.
6. **307 na adresie historycznym.** `redirect()` w Next 14 to przekierowanie
   tymczasowe. Dla nazw unikalnych stałe (`permanentRedirect()`, 308) lepiej scala
   sygnały. Dla nazw rodzajowych adres historyczny i tak jest niejednoznaczny. Decyzja
   świadoma, nie odruch.
7. **Strona meczu linkuje obiekt po UUID** (`EventDetailClient.tsx`). Nieszkodliwe
   (canonical), ale każdy taki link to „alternatywna strona” w raporcie i dodatkowe
   pobranie przez Google.
8. **Pojemność serwera a skanowanie.** Plan darmowy Vercela (limit CPU funkcji,
   komentarz przy `revalidate` w `boisko/[id]/page.tsx`). Wzrost „Wykryto, obecnie bez
   indeksu” albo 5xx w statystykach skanowania może mieć źródło tutaj, a nie w jakości
   treści.
