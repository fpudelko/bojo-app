# Turnieje: scenariusz ręcznego testu całego modułu

**Stan na:** 2026-11-11, po #461, #462 i #463 (migracje `171`–`173`).
Cel: jedno przejście, w którym przeklikasz każdą funkcję modułu z trzech stron (organizator,
kapitan, zawodnik) i ze strony widza bez konta. Czas: ok. 60–75 min. Każdy krok ma
**oczekiwany wynik**; jeśli wychodzi inaczej, zapisz numer kroku i zrób zrzut.

---

## 0. Zanim zaczniesz (bez tego połowa kroków pokaże błąd)

| # | Co | Jak sprawdzić |
|---|---|---|
| 0.1 | **Migracje na produkcji.** Do 2026-11-11 nie poszły: kolejka stoi przed ręczną `167` (kasuje tabele gier cyklicznych), za nią `168`–`173`. | GitHub → Actions → Migracje → Run workflow → `produkcja`. Po przebiegu w podsumowaniu nie ma „czeka na świadome uruchomienie". |
| 0.2 | Testujesz **na produkcji** (bojo.pl). Baza dev nie odpowiada od 2026-09-29, więc podgląd Vercela nie pokaże turniejów. | — |
| 0.3 | Flaga `SHOW_TURNIEJE` jest wyłączona: w menu nie ma turniejów. Wchodzisz adresem. | `bojo.pl/turnieje/nowe` |
| 0.4 | Wszystkie turnieje testowe zakładasz jako **„Tylko z linku"**, nazwa zaczyna się od `TEST`. | Nie pojawią się na `/turnieje`. |

### Konta i urządzenia

| Rola | Konto | Urządzenie |
|---|---|---|
| **O**: organizator | `franekks@gmail.com` | komputer |
| **K**: kapitan drużyny zgłoszonej samodzielnie | `franciszekpudelko@gmail.com` | telefon |
| **Z**: zawodnik z linku, nowy w Bojo | nowe konto e-mail (np. alias `+turniej@`), albo `test1@example.com` / `test1234` | telefon, okno prywatne |
| **W**: widz bez konta | — | dowolna przeglądarka, okno prywatne |

---

## 1. Turniej A: „grupy → puchar", 6 drużyn, 2 boiska (główny przebieg)

### 1A. Kreator (O)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.1 | `/turnieje/nowe`. Nazwa `TEST Puchar Luboń`, piłka nożna, data za tydzień, godzina 10:00, zapisy do dnia przed. | Brak pól „Data końca", „Minimum drużyn", „Min. skład". |
| 1.2 | Format **Grupy → puchar**, 6 drużyn, 8 zawodników w drużynie. | Pole „Zawodników w drużynie" z dopiskiem „razem z rezerwowymi". |
| 1.3 | Zasady gry: **2 boiska**, mecz 12 min, przerwa 3 min, 3/1 pkt, z grupy wychodzą 2, mecz o 3. miejsce ✓. | Linijka pod formularzem zmienia liczbę meczów i godzinę końca przy każdej zmianie. |
| 1.4 | Widoczność: **Tylko z linku**. Akceptacja zgłoszeń: włączona. Wpisowe 50 zł. | — |
| 1.5 | „Utwórz turniej". | Ekran „Turniej jest ogłoszony" z linkiem. Komunikat „Turniej utworzony". |

### 1B. Ustawienia i strona publiczna (O, W)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.6 | Panel → **Ustawienia**. Zmień godzinę startu na 9:30 i wyjdź z pola. | Toast **„Zapisano"**. |
| 1.7 | Zmień czas meczu na 1 (poniżej minimum) i wyjdź z pola. | Pole wraca do 5 i zapisuje się („Zapisano"), bez błędu z bazy. |
| 1.8 | Wgraj okładkę. Otwórz stronę turnieju. | Okładka jako baner na górze strony, nie tylko miniatura. |
| 1.9 | Wpisz numer BLIK, opis i regulamin. | Każde pole kończy się „Zapisano". |
| 1.10 | Panel ma zakładki: Pulpit, Drużyny, Terminarz, Ustawienia. | **Nie ma** „Ludzie". Na pulpicie **nie ma** „Zobacz oczami kapitana". |
| 1.11 | (W) Otwórz link turnieju w oknie prywatnym. | Widać termin, miejsce, zasady (12 min, przerwa 3, mecz o 3. miejsce), wpisowe „od drużyny", przycisk „Zgłoś drużynę", okładka na górze. Skład opisany jako „skład do 8", nie „5–8". |

### 1C. Drużyny: obie drogi (O, K, Z)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.12 | (K) Z linku turnieju: „Zgłoś drużynę" → `Chaos United`, kontakt, akceptacja regulaminu. | Zgłoszenie wysłane, K jest kapitanem. |
| 1.13 | (O) Panel → Drużyny: `Chaos United` w „Czekają na decyzję" → **Przyjmij**. | Przechodzi do „W turnieju", pod nazwą „ma kapitana". |
| 1.14 | (O) Dodaj ręcznie 5 drużyn: `Młodzi emeryci`, `Ekipa Marysi`, `Emer Instalacje`, `KS Pyry`, `Ejbry Luboń`. | Każda z dopiskiem „bez kapitana" i przyciskiem **„Link do drużyny"** (podpisany, nie sama ikonka). |
| 1.15 | (O) Kliknij nazwę `Ekipa Marysi` → ekran drużyny. Dopisz `Maciej`, `Kamil Z.`, `Bartek W.`. | Organizator widzi blok „Skład: 3 z 8", „Wolne miejsca: 5", przycisk „Wyślij link do drużyny". |
| 1.16 | (O) Skopiuj link `Ekipa Marysi` i wyślij go na telefon Z. | — |
| 1.17 | (Z, bez konta) Otwórz link. | Nazwa drużyny, turniej, data, miejsce, „W składzie już…". Przycisk „Dołącz do drużyny" prowadzi do logowania. |
| 1.18 | (Z) Załóż konto, wróć na link. | Lista „Jesteś na tej liście? Wybierz swoje imię": Maciej, Kamil Z., Bartek W. **Nie ma** „Zostań kapitanem". |
| 1.19 | (Z) Kliknij `Kamil Z.`. | Toast „Jesteś w składzie!", przejście na ekran drużyny. Przy Kamilu brak dopisku „bez konta". **Żadnego** komunikatu typu `column reference…`. |
| 1.20 | (Z) Otwórz link drugi raz. | Nic się nie dubluje, Z dalej jest jednym wpisem. |
| 1.21 | (O) Ekran `Ekipa Marysi` → przy Kamilu **„Ustaw kapitanem"**. | Toast „Kamil Z. jest kapitanem". W panelu `Ekipa Marysi` ma „ma kapitana". |
| 1.22 | (O) Przy `Maciej` (bez konta) nie ma „Ustaw kapitanem". | Kapitanem zostaje tylko ktoś z kontem. |
| 1.23 | (Z, teraz kapitan) Na ekranie drużyny dopisz `Ola N.` i ją usuń. | Działa. Kapitan widzi też „Zaproś z ekipy". |
| 1.24 | (K) Ekran `Chaos United`: dopisz 2 zawodników, zobacz BLIK i kwotę wpisowego. | BLIK widoczny dla kapitana. |
| 1.25 | (O) Panel → Drużyny: przełącz „Opłacone" przy dwóch drużynach. Pobierz CSV kontaktów. | CSV z kontaktem `Chaos United`. |

### 1D. Grupy i terminarz (O)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.26 | Terminarz → Boiska: widać „Boisko 1" i „Boisko 2" (z kreatora). Dodaj „Boisko 3", usuń je. | — |
| 1.27 | Grupy: **Losuj grupy** (2). | Dwie grupy po 3. Przy każdej drużynie wybór grupy. |
| 1.28 | Przenieś jedną drużynę do drugiej grupy. | Toast „X w grupie B". Grupy 2+4. Przenieś z powrotem. |
| 1.29 | „Wygeneruj terminarz" → podgląd → „Zapisz terminarz". | Mecze rozłożone na 2 boiska naraz, godziny od 9:30 co 15 min. |
| 1.30 | Pulpit. | Lista kontrolna z ✓. Przyciski **„Rozpocznij turniej"** i **„Przetestuj"** obok siebie. |

### 1E. Próba (O)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.31 | **Przetestuj** → potwierdź. | Przejście do panelu kopii `Próba: TEST Puchar Luboń`. Baner „To jest próba". Status „trwa". |
| 1.32 | W próbie wpisz 3 wyniki (patrz 1F), jeden z remisem. | Tabela grupy w próbie się liczy. |
| 1.33 | (K) Sprawdź powiadomienia na telefonie. | **Brak** powiadomień z próby. |
| 1.34 | Wróć do prawdziwego turnieju. | Żaden mecz nie jest rozegrany, status dalej „zapisy". |
| 1.35 | W próbie: „Zakończ próbę i usuń kopię". | Kopia znika. |

### 1F. Dzień turnieju (O, K, Z, W)

| # | Zrób | Oczekiwane |
|---|---|---|
| 1.35a | Ustawienia → **data startu = dziś**. Powiadomienie „Wasz mecz jest następny" idzie tylko w dniu meczu, inaczej 1.45 nic nie pokaże. | „Zapisano". |
| 1.36 | **Rozpocznij turniej**. | Pulpit: „Turniej trwa", „Rozegrane 0 z N", lista „Wpisz wynik". |
| 1.37 | Mecz grupowy: wpisz **z klawiatury** 3 i 1 (nie plusem). | Liczby się wpisują. Pojawia się „Strzelcy (opcjonalnie)". |
| 1.38 | Wskaż 1 strzelca dla drużyny z 3 golami, resztę zostaw. „Zapisz wynik". | Pytanie **„Zapisać wynik bez wszystkich strzelców?"**, „3 gole zostaną bez strzelca". Zapisz. |
| 1.39 | Strona meczu po zapisie. | Wynik 3:1, przebieg: 1 gol ze strzelcem, 3 bez. |
| 1.40 | Drugi mecz: wynik 0:0, bez strzelców. | Bez pytania o strzelców (brak goli). |
| 1.41 | Trzeci mecz: „Prowadź mecz na żywo" → Rozpocznij → GOL → wybierz strzelca. | **Brak** pytania o asystę. Zegar tyka. |
| 1.42 | W tym meczu „Cofnij ostatnie", potem GOL „Nie wiem kto". „Zakończ". | „Zawodnik meczu (opcjonalnie)" jest zwinięty. |
| 1.43 | Jeden mecz: menu „⋯" → walkower. | Zwycięzca ma 3 pkt w tabeli. |
| 1.44 | (W) Strona turnieju w oknie prywatnym podczas meczów. | Blok „Na żywo", odświeża się sam (~20 s). |
| 1.45 | (Z, K) Telefon po zakończeniu meczu na ich boisku. | Powiadomienie „Wasz mecz jest następny" (tylko dla kont w składzie). |
| 1.46 | Dograj grupy, potem drabinka (półfinały, mecz o 3., finał). Półfinał z remisem. | Przy remisie w pucharze wymagane karne. Zwycięzca wchodzi do finału, przegrany do meczu o 3. |
| 1.47 | **Zakończ turniej**. | Podium (3 miejsca), król strzelców, „Udostępnij wyniki". Brak klasyfikacji asyst. Lista „Zawodnik meczu" tylko, jeśli ktoś go wskazał. |
| 1.48 | (K) Na zakończonym turnieju: „Zamień drużynę w ekipę". | Powstaje ekipa ze składem z kontem. |

---

## 2. Turniej B: „puchar", 5 drużyn (wolne losy i zamiana par)

| # | Zrób | Oczekiwane |
|---|---|---|
| 2.1 | (O) Nowy turniej `TEST Wolne losy`, format **Puchar**, 1 boisko, tylko z linku. Dodaj 5 drużyn ręcznie. | — |
| 2.2 | Wygeneruj terminarz (bez zapisu). | Podgląd: 3 „wolne losy". Napis „Dotknij dwóch drużyn w pierwszej rundzie, a zamienią się miejscami". |
| 2.3 | Dotknij drużyny z wolnym losem, potem drużyny z meczu. | Zamieniają się. Wolny los ma nowego zwycięzcę. |
| 2.4 | Zapisz terminarz. | Karta wolnego losu: plakietka „Wolny los", „awans bez gry", **bez „0:0" i „TBD"**. |
| 2.5 | Terminarz. | **Brak** napisu „Rozegrano już N meczów". „Wygeneruj terminarz od nowa" **aktywny**. |
| 2.6 | Wygeneruj od nowa i zapisz. | Działa (przed #461 baza odmawiała). |
| 2.7 | (W) Zakładka Mecze na stronie turnieju. | Wolnych losów nie ma na liście. W drabince są przygaszone. |

---

## 3. Turniej C: „liga", 4 drużyny (szybko, tylko to, co inne)

| # | Zrób | Oczekiwane |
|---|---|---|
| 3.1 | Format **Liga**, 4 drużyny, wygeneruj terminarz. | „Każdy z każdym", 6 meczów. **Wszystkie jednego dnia**, jeden po drugim. |
| 3.2 | Wpisz 2 wyniki. | Tabela ligi z punktami 3/1. |

To jest właśnie ograniczenie dla ligi dziecięcej (patrz wnioski): kolejki nie mają osobnych dat.

---

## 4. Rzeczy, które warto sprawdzić przy okazji

- [ ] Telefon 360 px: panel, kreator, ekran meczu. Nic nie wychodzi poza ekran, przyciski −/+ duże.
- [ ] Ustawienia: zmiana formatu jest zablokowana po wygenerowaniu terminarza (z wyjaśnieniem).
- [ ] Widoczność „Na liście turniejów" ↔ „Tylko z linku": turniej pojawia się i znika z `/turnieje`.
- [ ] Odwołanie turnieju (na turnieju B): zawodnicy z kontem dostają powiadomienie.
- [ ] Usunięcie turnieju (na turnieju B i C po teście).

## 5. Sprzątanie

Usuń turnieje `TEST…` z panelu (Ustawienia → Usuń turniej). Próby, które zostały, sprząta
też `supabase/wyczysc-testowe.sql` (marker `[TURNIEJ-TEST]`). Konto Z możesz zostawić.

## 6. Co zgłosić

Dla każdego odstępstwa: numer kroku, rola, urządzenie, zrzut. Osobno zapisz wszystko, co
było **niejasne**, nawet jeśli działało. To jest dokładnie ta klasa problemów, przez którą
organizator wraca do Excela.
