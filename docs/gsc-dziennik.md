# Dziennik Search Console bojo.pl

Pamięć między sesjami: co zmierzono, co zmieniono pod Google i kiedy sprawdzić efekt.
Bez linii bazowej sprzed zmiany za miesiąc nie da się odróżnić efektu od szumu. Wpisy
dopisują skille `gsc*` (`.claude/skills/gsc/SKILL.md`) i ludzie.

Pomiary sprzed 2026-09-23 (pierwsze zgłoszenie sitemapy, skok indeksu 2026-09-05,
pierwszy tydzień kliknięć) są w [seo-geo-strategia.md](./seo-geo-strategia.md#7a2-search-console--pomiar-bazowy-z-2026-08-29)
i tam zostają.

## Czeka na odczyt

| Termin | Co sprawdzić | Gdzie | Skąd się wzięło |
|---|---|---|---|
| 2026-10-14 | Strony: przykładowe adresy trzech przyczyn (Duplikat bez canonicala 149, Inny błąd 4xx 77, Przekierowanie 131) oraz kolejny punkt wykresu (po 2026-10-04 brak danych) | eksport Strony: kliknąć przyczynę → Eksportuj | 2026-10-07 |
| 2026-10-08 | Wydarzenia: wynik 5 weryfikacji (rozpoczęte 2026-09-24) | Ulepszenia → Wydarzenia | 2026-09-24 |
| 2026-10-10 | Mapy witryn i Strony po poprawce adresów obiektów: „Strona zawiera przekierowanie”, zaindeksowane, Statystyki indeksowania (udział 307, wykrywanie) | eksport Strony + Statystyki indeksowania | 2026-09-26 |
| 2026-10-24 | jw., drugi odczyt; Skuteczność: kliknięcia i wyświetlenia stron obiektów (28 dni przed i po) | eksport Skuteczność (z porównaniem) albo API | 2026-09-26 |

## Wpisy

### 2026-10-07 — Strony: zaindeksowane 24 214, trzy przyczyny bez przykładów

Źródło: eksport „Indeksowanie → Strony” z 2026-10-07 (wykres do 2026-10-04, sitemap
„Wszystkie znane strony”). Eksport nie niesie przykładowych adresów, tylko liczby.

| | 2026-09-21 | 2026-10-04 |
|---|---|---|
| Zindeksowane | 16 938 | **24 214** (skok 2026-09-22, od tej daty płasko) |
| Niezindeksowane | 1 478 | 2 579 |
| Wyświetlenia / dzień | 890 | 2 769 (max 2 989 w dniu 2026-10-03) |

Przyczyny (2026-10-04): alternatywna z canonicalem 1 904; noindex 162; duplikat bez
canonicala 149 (poprzednie odczyty: 54, potem 78); przekierowanie 131; robots.txt 91; inny błąd 4xx 77;
zeskanowana bez indeksu 65 (było 85 na 2026-09-14, 0,2% znanych adresów).

Odczyt:
- Spadek z 2026-09-15…19 (17 473 → 16 938) odwrócony i przebity: +7 276 w jednym
  punkcie wykresu po PR #435 (2026-09-26 sitemapa; skok datowany 2026-09-22, więc
  część wzrostu poprzedza tę poprawkę, a wykres Google jest punktowy i opóźniony:
  **nie przypisywać całości #435**).
- R1 nie ruszył: „zeskanowano bez indeksu” maleje (85 → 65), a „wykryto bez indeksu”
  nie występuje. Sygnał spokojny.
- Znane adresy 26 793 z ok. 32 tys. w sitemapie: ok. 5,3 tys. Google jeszcze nie odkrył.
- **Hipoteza „podwójny import OSM” dla duplikatów jest w większości fałszywa.** Zapytanie
  `GROUP BY name, address` z `przyczyny.mjs` daje 3 998 grup, bo `fields.address` to
  często sama dzielnica albo miasto. Z współrzędnymi (4 miejsca): 25 grup, 33 nadmiarowe
  wiersze. Zapytanie poprawione w skillu i w strategii (rozdz. 7a.2).
- Kolizje końcówki sluga (12 znaków id): tylko 2, oba dla ręcznie zasianych
  obiektów `00000000-…` i `c0000000-…` (hidden, Tier 3, nie w sitemapie), a w slugu jest
  też nazwa, więc nie powodują 404.
- Nie znaleziono błędu w kodzie, który wyjaśniałby 149 duplikatów albo 77 × 4xx.
  Hipoteza dla 4xx, NIEZWERYFIKOWANA: odpowiedzi 402/429 z Vercela przy wyczerpanym
  limicie CPU (komentarz przy `revalidate` w `boisko/[id]/page.tsx`; 24 tys. nowych
  stron do pierwszego wyrenderowania). Sprawdza ją tylko lista przykładowych adresów
  oraz Statystyki indeksowania (kody odpowiedzi) i wykres zużycia w Vercelu.
- Strona meczu nadal linkuje obiekt po UUID (mapa SEO, pkt 6.7), co daje część z 1 904
  „alternatywnych”. Nie naprawiam: `event.fieldName` bywa inne niż `fields.name`, a
  resolver slugów wymaga dokładnej nazwy, więc błędny slug dałby 404 zamiast
  nieszkodliwego canonicala. Poprawka wymagałaby pobrania nazwy z `fields` w zapytaniu
  o mecz.

Do zrobienia przez właściciela (minuty): w GSC wejść w trzy przyczyny (duplikat bez
canonicala, inny błąd 4xx, przekierowanie) → „Eksportuj” i wrzucić przykładowe adresy.
Ponowny odczyt: 2026-10-14.

### 2026-09-26 (2) — „Brakujące pole endDate”: zbadane, nie jest błędem kodu

Źródło: mail GSC 10:31 (skrzynka bojopolska@gmail.com, konektor Gmail podłączony
tego dnia), „Wydarzenia — problemy (1)”: „Brakujące pole „endDate””, bez listy
przykładowych adresów.

Sprawdzenie produkcyjnej bazy (tylko SELECT): **0 publicznych meczów przyszłych**
bez `end_time`; **11 publicznych meczów przeszłych** bez niego, wszystkie
`created_at` 2026-06-21…2026-08-10 — sprzed funkcji liczącej koniec z czasu startu
(`EventDateTimeField.tsx`, PR #370, 2026-09-13). Wszystkie 11 mają dziś
`noindex,follow` (miniony mecz). Odtworzenie z buildera (`jsonld-z-buildera.mjs`)
na dwóch meczach z poprzedniego zgłoszenia (2026-09-23) potwierdza: oba mają
`end_time` i poprawnie wystawiają `endDate` — to nie one.

Werdykt: **kod jest poprawny dla całych dzisiejszych danych.** Zgłoszenie
najpewniej pochodzi z pierwszego przetworzenia starych stron przy odkrywaniu
długiego ogona katalogu, nie z regresji. Jedyny realny, nieobsłużony przypadek:
mecz zaczynający się na tyle późno, że czas gry przekracza północ — `addMinutes()`
świadomie zwraca wtedy brak `end_time` (szczegóły i uzasadnienie:
`.claude/skills/gsc/references/mapa-seo-bojo.md`, punkt 1). Nie dotyczy dziś
żadnego meczu w bazie.

Decyzja: **nie backfillować** 11 starych meczów zgadywaną godziną końca —
to byłaby nieprawda w danych o rozegranym meczu. Nie klikać „Sprawdź poprawkę”
bez adresów przykładów (mail ich nie podał): jeśli Google poda w przyszłości
adres AKTYWNEGO/przyszłego meczu z tym problemem, to będzie sygnał, że
przypadek „po północy” jednak wystąpił naprawdę — wtedy wraca jako zadanie do
zaprojektowania (nie prostej łatki), bo dotyka `end_time` w całym repo.

Ponowny odczyt: przy następnym mailu o tym samym raporcie, z adresami przykładów.

### 2026-09-26 — Sitemapa i huby katalogu na adresach kanonicznych obiektów

Źródło: analiza kodu i produkcyjnej bazy przy budowie skilli GSC (nie mail z GSC).

Sitemapa boisk i huby `/boiska/…` budowały adres obiektu z samej nazwy (klucz
historyczny, 307 na adres kanoniczny). Stan produkcji: 32 096 wpisów w sitemapach boisk,
10 608 różnych adresów, 21 488 obiektów Tier 1+2 (67%) bez własnego adresu w sitemapie,
„boisko-pilkarskie” 10 048 razy. Kliknięcie obiektu na liście miasta mogło otworzyć boisko
z innej miejscowości.

Zmiana: PR #435, merge 2026-09-26 (`slugBoiska(name, id)` w sitemapie, linkach
i `ItemList` hubów; strażnik `linkiObiektuKanoniczne.test.ts`).

Adnotacja do wykresu GSC (do dodania przez właściciela):
„Sitemapa i huby: adresy kanoniczne obiektów (PR #435)”.

Oczekiwane: zaindeksowane rosną w miarę odkrywania ~21 tys. obiektów; „przekierowanie”
chwilowo w górę, potem w dół. Ponowny odczyt: 2026-10-10 i 2026-10-24.

### 2026-09-24 — Wydarzenia: 5 pól zalecanych, weryfikacja rozpoczęta

Źródło: mail GSC z 2026-09-23 i eksport „Events” z 2026-09-24 (2 mecze, 0 nieprawidłowych,
5 problemów niekrytycznych: `description`, `image`, `performer`, `offers.validFrom`,
`offers.availability`).

Zmiana: PR #424 (merge 2026-09-24), `eventJsonLd()` emituje wszystkie pięć pól.

Weryfikacja: pierwsze kliknięcia „Sprawdź poprawkę” (4 z 5) odpadły na prekontroli,
bo trafiły w HTML sprzed deployu. Po ponownym kliknięciu wszystkie 5 „Rozpoczęto”
2026-09-24. Wynik do odczytu: ~2026-10-08.

Walidator (`sprawdz-jsonld.mjs`) na kodzie po poprawce: następni kandydaci na
„Brakujące pole” to `endDate` (mecze bez godziny końca). Ponadto data bez strefy
czasowej (informacja, nie błąd).
