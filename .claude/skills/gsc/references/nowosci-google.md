# Co Google zmienił w 2025–2026 i co z tego wynika dla Bojo

Stan researchu: 2026-09-25/26 (WebSearch; strony developers.google.com są z kontenera
niedostępne do pobrania, więc źródłem są streszczenia wyników i wpisy blogów Google
Search Central). Przed decyzją zależną od jednego punktu potwierdź go w aktualnej
dokumentacji Google.

## Wyniki rozszerzone: co jeszcze działa

| Funkcja | Stan | Dla Bojo |
|---|---|---|
| **Wydarzenia (Event)** | działa; wymagane `name`, `startDate`, `location` (z `address`); zalecane m.in. `description`, `endDate`, `eventStatus`, `image`, `offers` (`availability`, `price`, `priceCurrency`, `url`, `validFrom`), `organizer`, `performer`. Tylko wydarzenia w fizycznym miejscu: sekcję wydarzeń online Google usunął z dokumentacji w czerwcu 2025 | mecze publiczne; raport „Wydarzenia” istnieje od 2026-09-22 |
| **Okruszki (BreadcrumbList)** | działa, ale od stycznia 2025 **tylko na komputerze**; na telefonie wynik pokazuje samą domenę. Raport w GSC zostaje | ~87% kliknięć Bojo jest z telefonu, więc okruszki prawie nie zmieniają wyglądu wyniku |
| **FAQ (FAQPage)** | od sierpnia 2023 tylko witryny rządowe i medyczne; w 2026 wycofane całkiem (wynik, raport, test wyników rozszerzonych, potem API) | 7 typów stron emituje `faqJsonLd()` (landing, treść, każda strona sport + miasto); zostawić (nie szkodzi, bywa czytane przez modele), ale **nie czekać na wynik FAQ** |
| **HowTo** | wycofane we wrześniu 2023 | jw. |
| **Pole wyszukiwania w linkach witryny** | wycofane w listopadzie 2024 | nic do zrobienia |
| **Ciche wycofania 2025–2026** | czerwiec 2025: Book Actions, Course Info, Claim Review, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing; styczeń 2026: m.in. Practice Problems, Nutrition Facts, „Nearby offers” | Bojo z nich nie korzysta |
| **Local business** | brak raportu w GSC; wyniki lokalne zasila głównie Profil Firmy w Google | `SportsActivityLocation` na stronach obiektów pomaga zrozumieniu strony, nie daje wyniku rozszerzonego |
| **Nazwa witryny** | z `WebSite` (`name`, `alternateName`, `url`) na stronie głównej | kolizja „bojo”/„boisko”: `alternateName` to tani sygnał (mapa SEO, otwarte tematy) |

## Nowe w Search Console

| Kiedy | Co | Jak użyć w Bojo |
|---|---|---|
| czerwiec 2025 | ruch z **AI Mode** wliczany do Skuteczności → Wyniki wyszukiwania | wzrost wyświetleń bez kliknięć może pochodzić z AI; nie mieszać z CTR klasycznych wyników |
| paź 2025 | **Grupy zapytań** (Query groups) w Search Console Insights: AI grupuje zapytania o tej samej intencji; tylko dla usług z dużym ruchem | gdy się pojawi: klastry z rozdziału 2 strategii SEO porównać z grupami Google |
| lis 2025 | **Własne adnotacje** na wykresach Skuteczności (prawy klik → Dodaj adnotację; 120 znaków, maks. 200, kasowane po 500 dniach, nie widać ich w trybie porównania) | każdy deploy zmieniający SEO dostaje adnotację; tekst podaje agent |
| lis 2025 → mar 2026 | **Filtr zapytań markowych** (Branded / Non-branded), od 11.03.2026 dla wszystkich kwalifikujących się usług | marka „bojo” vs ruch z katalogu bez regexów; słownikowe „bojo” to test, jak Google rozumie markę |
| czerwiec 2026, dla wszystkich od 31.08.2026 | **Raporty skuteczności w funkcjach generatywnej AI** (AI Overviews, AI Mode; osobno Discover): wyświetlenia wg strony, kraju, urządzenia, daty. **Bez kliknięć, bez zapytań, bez API**, tylko eksport CSV | pierwszy twardy pomiar GEO: które strony Bojo cytuje AI. Zestawić z Załącznikiem A (40 promptów) w docs/seo-geo-strategia.md |
| lipiec 2026 | usługi typu **platforma** (Instagram, TikTok, X, YouTube) | jeśli Bojo założy profile (sameAs, rozdz. 5a strategii), można je śledzić w GSC |
| styczeń 2026 | usunięcie wycofanych typów z raportów GSC i API | puste raporty FAQ nie są błędem |

## API

- Search Analytics: do 25 000 wierszy na zapytanie (`startRow` do stronicowania),
  ~50 000 wierszy dziennie na usługę i typ wyszukiwania.
- URL Inspection: 2000 zapytań dziennie, 600 na minutę na usługę. Pokazuje wersję
  zaindeksowaną (bez testu na żywo).
- Raport AI: brak API (stan 2026).

## Sitemapy

- `priority` i `changefreq` Google ignoruje.
- `lastmod` Google bierze pod uwagę tylko wtedy, gdy jest „spójnie i sprawdzalnie
  prawdziwy” (wpis Google z czerwca 2023). `new Date()` przy każdej generacji uczy
  Google ignorować pole (Bojo: `app/sitemap.ts`).
- W sitemapie mają być adresy kanoniczne, nie przekierowania (naprawione w Bojo 2026-09-26).

## Źródła (wyszukane 2026-09-25/26)

- Google Search Central Blog: „Simplifying the search results page” (06.2025), „Here's an update on our efforts to simplify the search results page” (11.2025), „Simplifying the visible URL element on mobile search results” (01.2025), „Introducing Query groups in Search Console Insights” (10.2025), „Adding context to your Search Console data with custom annotations” (11.2025), „Introducing the branded queries filter in Search Console” (11.2025), „Introducing Search Generative AI performance reports in Search Console” (06.2026)
- Google Search Central: dokumentacja danych strukturalnych Event, Breadcrumb, Organization; Search Console API „Usage limits”
- Search Console Help: „Validation details”, „Core Web Vitals report”
- Omówienia branżowe: Search Engine Land, Search Engine Journal, Search Engine Roundtable (FAQ 2026, breadcrumbs 2025, AI reports 2026)
