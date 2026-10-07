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
| 2026-10-08 | Wydarzenia: wynik 5 weryfikacji (rozpoczęte 2026-09-24) | Ulepszenia → Wydarzenia | 2026-09-24 |
| 2026-10-10 | Mapy witryn i Strony po poprawce adresów obiektów: „Strona zawiera przekierowanie”, zaindeksowane, Statystyki indeksowania (udział 307, wykrywanie) | eksport Strony + Statystyki indeksowania | 2026-09-26 |
| 2026-10-24 | jw., drugi odczyt; Skuteczność: kliknięcia i wyświetlenia stron obiektów (28 dni przed i po) | eksport Skuteczność (z porównaniem) albo API | 2026-09-26 |
| przy najbliższej okazji | Przykładowe adresy dla „Duplikat bez canonical” (149, rośnie szybciej niż reszta) i „błąd 4xx” (77, nowa, nierozpoznana kategoria) — w GSC: kliknij przyczynę → Eksportuj | eksport per przyczyna | 2026-10-07 |

## Wpisy

### 2026-10-07 — Strony: 24 214 zaindeksowane (z 17 473), R1 nadal spokojny, dwie nowe kategorie do zbadania

Źródło: eksport ZIP „Coverage” (Indeksowanie → Strony) z 2026-10-07, przepuszczony
przez `gsc-eksport.mjs`.

**Trend** (dzienny szereg, 2026-08-14 → 2026-10-04): zaindeksowane 2 (29.08) →
59 (29.08) → 17 473 (05.09) → **24 214** (22.09), płasko od 22.09 do 04.10 (13 dni).
Niezindeksowane 5 → 530 (05.09) → 1033 (15.09) → 1478 (19.09) → **2579** (22.09),
płasko razem z zaindeksowanymi. Wyświetlenia: skoki 25–26.09 (933→1358→1817) i
2–3.10 (1476→2228→2989) — zbiegają się z merge PR #435 (26.09, adresy kanoniczne
w sitemapie/hubach).

Możliwy, **niepotwierdzony** czynnik skoku indeksacji 22.09: PR #404 (merge 19.09,
cache sitemapów + tygodniowy ISR boisk), trzy dni wcześniej — spójne w czasie
z ponownym odczytem przyspieszonych sitemapów przez Google, ale to korelacja,
nie potwierdzone źródło.

**R1: 65 „zeskanowano, jeszcze nie zindeksowano” / 26 794 znanych adresów = 0,2%
— SPOKÓJ**, lepszy wynik niż 0,5% z 14.09 (seo-geo-strategia.md, 7a.2). Zamyka
termin z 2026-09-29 (spóźniony odczyt, ale sam kierunek się nie zmienił: rośnie,
nie zamroziło się na R1).

**Pełne rozbicie, 8 przyczyn** (poprzedni odczyt 14.09 miał 6, łącznie 530;
dziś 2579):

| Przyczyna | Strony | Werdykt skilla |
|---|---|---|
| Alternatywna strona z prawidłowym canonical | 1904 (z 233) | zamierzone — `/boisko/<uuid>` → canonical na slug |
| Strona wykluczona tagiem „noindex” | 162 (z 111) | zamierzone — Tier 3, minione mecze, prywatne |
| Duplikat, brak canonical | 149 (z 54) | **do zbadania — rośnie szybciej niż reszta (~3×)** |
| Strona zawiera przekierowanie | 131 (z 45) | oczekiwany chwilowy wzrost po PR #435, ma spaść do 10.10/10.24 |
| Zablokowana przez robots.txt | 91 (nowa) | zamierzone, o ile przykłady pasują do `robots.ts` |
| Błąd 4xx | 77 (nowa) | **nierozpoznane — skill nie ma dla niej werdyktu** |
| Zeskanowano, jeszcze nie zindeksowano | 65 (z 85) | sygnał R1 — spokój |
| Zindeksowana, ale zablokowana robots.txt | 1 (nowa) | zamierzone, jak wyżej |

Cztery pierwsze kategorie rosną proporcjonalnie do skali katalogu i mają gotowe
wyjaśnienie w kodzie (`mapa-seo-bojo.md`) — nie wymagają działania poza
sklasyfikowaniem przykładów. Dwie zasługują na realną uwagę: **„Duplikat bez
canonical” rośnie szybciej niż reszta** (54→149, podczas gdy zaindeksowane
urosły ~2,5×) — ta sama hipoteza co 16.09 (podwójny import OSM w `fields`), ale
tempo wzrostu zasługuje teraz na faktyczne zapytanie SQL, nie tylko odłożenie.
**„Błąd 4xx” (77) jest kategorią, której `gsc-eksport.mjs` w ogóle nie rozpoznaje**
— ani zamierzoną, ani znanym błędem; wymaga przykładowych adresów, zanim da się
cokolwiek powiedzieć.

**Czego brakuje do zamknięcia tego odczytu:** przykładowe adresy dla „Duplikat
bez canonical”, „błąd 4xx” i „Przekierowanie” — ten eksport to tylko zbiorcze
Coverage, bez list adresów per przyczyna (w GSC: kliknij przyczynę → Eksportuj).
Dopisane do tabeli „Czeka na odczyt” wyżej.

Ponowny odczyt: 2026-10-10 (zaplanowany, efekt PR #435) i 2026-10-24 (jw. +
Skuteczność) — bez zmian co do terminu.

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
