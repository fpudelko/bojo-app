# Metodyka: jak czytać Skuteczność, żeby nie oszukać samego siebie

## Spis

1. Metryki i ich pułapki
2. Dlaczego krzywa CTR Bojo, a nie „branżowa”
3. Istotność: przedział Wilsona i test dwóch proporcji
4. Porównywanie okresów
5. Eksperyment na szablonie (test A/B)
6. Szablon wpisu do dziennika

## 1. Metryki i ich pułapki

- **Wyświetlenie** = link Bojo był na stronie wyników, którą ktoś zobaczył (nie
  musiał przewinąć do niego). Od czerwca 2025 wlicza się też AI Mode.
- **Pozycja** = średnia ważona wyświetleniami najwyższej pozycji Bojo w wyniku.
  Średnia z 3 i 30 to 16,5, co nie odpowiada żadnemu realnemu wynikowi. Dlatego
  `gsc-okazje.mjs` liczy krzywą CTR na poziomie wiersza (strona/zapytanie), a nie średniej globalnej.
- **CTR z CSV jest zaokrąglony**: skrypty liczą go ze sumy kliknięć i wyświetleń.
- **Suma tabeli Zapytania < suma całości**: rzadkie zapytania są anonimizowane. Suma
  tabeli Strony też bywa niższa (limit 1000 wierszy). Pełne sumy są tylko w `Daty.csv`.
- **Filtr po zapytaniu gubi wiersze anonimizowane**: „CTR strony dla zapytań z X”
  nie jest CTR strony.
- **Dane dzienne dochodzą 2–3 dni.** Ostatnie dni zaniżają wszystko.
- **Kraje:** Bojo celuje w Polskę (7a.2: 114 z 116 kliknięć). Nagły ruch z innego kraju
  najczęściej oznacza boty albo przypadkową frazę, a nie rynek.

## 2. Dlaczego krzywa CTR Bojo, a nie „branżowa”

Publikowane krzywe CTR pochodzą z innych rynków i typów zapytań, a większość sprzed
AI Overviews (które obniżają CTR klasycznych wyników). Bojo ma własny profil:
zapytania o konkretny obiekt, wyniki lokalne i mapy nad wynikami organicznymi.
Oczekiwany CTR strony liczymy więc z innych stron Bojo w tym samym koszyku pozycji
(1, 2, 3, 4–5, 6–10, 11–20, 21+), z pominięciem samej strony (bez tego jedna duża
strona zaniża oczekiwanie dla siebie). Koszyk jest wiarygodny od 300 wyświetleń.

## 3. Istotność

- **Luka CTR** jest zgłaszana tylko wtedy, gdy nawet GÓRNA granica 95% przedziału
  Wilsona dla CTR strony leży poniżej oczekiwania. 0 kliknięć na 10 wyświetleń daje
  przedział 0–28%, czyli nic nie wiadomo. 0 na 900 daje 0–0,4%, a to już jest wiedza.
- **„Utracone kliknięcia”** = wyświetlenia × (oczekiwany − faktyczny CTR). Porządkuje
  listę po wadze, nie jest prognozą.
- **Porównanie dwóch grup** (eksperyment, przed/po): test dwóch proporcji. Uwaga:
  wyświetlenia tej samej strony nie są niezależne (jedna fraza, jeden układ wyniku),
  więc przy kilku dominujących stronach traktuj p-wartość ostrożnie i patrz też na
  rozkład po stronach.

## 4. Porównywanie okresów

- Równe długości, **te same dni tygodnia** (amatorska piłka ma rytm tygodniowy:
  szczyt wyszukiwań przed weekendem).
- Sezon: wiosna i jesień to boiska otwarte, zima to hale i kryte obiekty. Porównanie
  wrzesień → listopad pokaże spadek otwartych boisk niezależnie od SEO.
- Aktualizacje Google (core updates) zmieniają wszystko naraz. Grupa kontrolna
  (eksperyment) jest jedynym czystym porównaniem.
- Zmiana indeksu (np. PR #435: ~21 tys. obiektów trafia do sitemapy) zmienia
  mianownik. Więcej zaindeksowanych stron o niskich pozycjach obniża średni CTR i średnią
  pozycję, choć kliknięcia rosną. Czytaj kliknięcia i wyświetlenia, nie same średnie.

## 5. Eksperyment na szablonie (test A/B)

1. **Hipoteza** z danych (np. luka CTR na stronach obiektów z nazwą rodzajową).
2. **Podział:** parzystość ostatniej cyfry hex końcówki id (A bez zmian, B nowy
   szablon). Implementacja w `metaOpisObiektu()`/`generateMetadata()`, z testem
   jednostkowym, że obie grupy dostają swój wariant. Stały podział, bez losowania
   przy renderze (ISR trzyma stronę tydzień, a losowanie przy każdym renderze mieszałoby grupy).
3. **Linia bazowa A i B przed startem** (`gsc-okazje.mjs --eksperyment parzystosc`):
   grupy muszą mieć podobny CTR i pozycję już przed zmianą.
4. **Czas trwania:** do osiągnięcia liczby wyświetleń z `wymaganaProba()` (skrypt ją
   podaje), minimum 2 pełne tygodnie. Google musi też ponownie pobrać strony (ISR tydzień).
5. **Decyzja:** B wygrywa, jeśli CTR istotnie wyższy przy podobnej pozycji i lejek
   (`boisko_zorganizuj`) nie spada → wdrożenie dla wszystkich. Inaczej wycofanie.
   Wynik (także porażka) idzie do dziennika.

## 6. Szablon wpisu do dziennika

```
### RRRR-MM-DD — Skuteczność: <co zmierzono / co zmieniono>
Źródło: API | eksport z RRRR-MM-DD | zrzut. Zakres: od → do.
Liczby: kl …, wyśw …, CTR …, poz … (gsc-okazje.mjs, linia bazowa).
Wniosek: …
Zmiana (jeśli jest): PR #…, deploy RRRR-MM-DD, adnotacja w GSC: „…”.
Ponowny odczyt: RRRR-MM-DD (+28 dni).
```
