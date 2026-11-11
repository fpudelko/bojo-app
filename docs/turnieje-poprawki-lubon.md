# Turnieje: poprawki przed pierwszym prawdziwym turniejem (Luboń, 28.11.2026)

**Stan na:** 2026-11-08. Punkt wyjścia: turniej pokazowy „Gramy dla Marysi, Turniej
Piłkarski Luboń 28.11.2026" (`/turnieje/6c501b7d-…/panel`), zbudowany na danych
organizatorów, którzy rozważają Bojo. Dokument zbiera błędy znalezione przy tym
pokazie, przyczyny potwierdzone w kodzie i pomysły. Kolejność według jednego kryterium:
**czy bez tego da się przeprowadzić turniej 28.11 bez nas obok** (rozstrzygnięcie 4
w [turnieje-scenariusze-ux.md §10](./turnieje-scenariusze-ux.md)).

Strony organizatorów (`poma-gramy.pl/turniej-pilkarski-lubon-28-11-2026[-dla-marysi]`)
nie zostały przeczytane: host jest poza siecią sesji agenta. Format (liczba drużyn,
grupy czy od razu puchar, czas meczu, liczba boisk) trzeba potwierdzić, zanim
dostroimy terminarz.

---

## P0: błędy, przez które turniej się nie odbędzie

### P0-1. Dołączenie do drużyny z linku zawsze kończy się błędem

**ZROBIONE 2026-11-08** (migracja `171`, `czyWolnyLos()`, testy w `rls.sql` i `turniejWolnyLos.test.ts`).

**Objaw:** `/t/[kod]` → „Nie ma mnie na liście" → imię → „Dołącz" → czerwony napis
`column reference "druzyna_id" is ambiguous`.

**Przyczyna (potwierdzona):** `dolacz_do_druzyny_kodem()` (migracja `145`) zwraca
`RETURNS TABLE (druzyna_id, turniej_id, zostal_kapitanem, zawodnik_id)`. W PL/pgSQL
kolumny wyniku są zmiennymi, więc każde niekwalifikowane `druzyna_id` w ciele funkcji
koliduje z kolumną tabeli `turniej_zawodnicy`:

- krok 2: `SELECT id … FROM turniej_zawodnicy WHERE druzyna_id = … AND user_id = …`,
- krok 3a („to ja"): `UPDATE turniej_zawodnicy … WHERE id = … AND druzyna_id = …`,
- krok 3b (nowy wiersz): `SELECT count(*) … WHERE druzyna_id = …`.

Pada więc **każda** droga: wybór siebie z listy, dopisanie się, dołączenie jako
zawodnik, a także „Zostań kapitanem" (po przejęciu kapitanatu funkcja idzie dalej do
kroku 3b i cała transakcja się wycofuje). Działa tylko zgłoszenie drużyny przez
`/zglos`, bo nie woła tej funkcji. Kluczowa pętla modułu (kapitan wysyła link
na WhatsAppie, ludzie dołączają, `S-13`/`C1`) nie działa od pierwszego dnia, bo
ani Vitest, ani `rls.sql`, ani scenariusze Playwrighta nie wołają tej funkcji.

**Poprawka:** migracja `171_dolacz_do_druzyny_bez_dwuznacznosci.sql`, `CREATE OR
REPLACE` z `#variable_conflict use_column` na początku ciała ALBO aliasami tabel
(`z.druzyna_id`) we wszystkich trzech miejscach. Do tego:

- asercja w `supabase/test/rls.sql` (albo osobny `supabase/test/turnieje.sql`
  w `baza-testowa.sh`): każda z trzech dróg (kapitan, „to ja", nowy wiersz)
  wołana jako `authenticated` kończy się wierszem w `turniej_zawodnicy`,
- przegląd pozostałych funkcji `RETURNS TABLE` w modułach `145`–`162` pod tym samym
  kątem (np. `turniej_kontakty` jest w SQL, nie PL/pgSQL, więc go to nie dotyczy;
  sprawdzić resztę jednym grepem).

### P0-2. Wolny los wygląda jak rozegrany walkower i blokuje terminarz na zawsze

**ZROBIONE 2026-11-08** (migracja `171`, `czyWolnyLos()`, testy w `rls.sql` i `turniejWolnyLos.test.ts`).

**Objaw:** M1 „Chaos United 0:0 TBD", plakietka „Walkower". Pod przyciskiem:
„Rozegrano już 2 mecze, więc terminarz da się tylko przesuwać", choć nikt nie zagrał.

**Przyczyna (potwierdzona):** generator (`lib/turniejFormat.ts`) zapisuje wolny los
w pierwszej rundzie pucharu jako mecz `status: 'walkower'` bez drugiej drużyny. Potem:

- `PanelClient.tsx` liczy `rozegranych` po statusie (`zakonczony | walkower | trwa`),
  więc wolne losy liczą się jako rozegrane i przycisk „Wygeneruj od nowa" jest
  wyłączony,
- `zapisz_terminarz()` (migracja `146`) odmawia tak samo: `status <> 'zaplanowany'`,
- `KartaMeczu` pokazuje wynik `0:0` i „TBD" po drugiej stronie; publiczna strona
  i drabinka przynajmniej przygaszają kartę (`przygaszona`), panel nie.

Skutek dla Lubonia: przy liczbie drużyn innej niż potęga dwójki (14 → dwa wolne losy)
**pierwsza wygenerowana drabinka jest ostateczna**. Dopisanie drużyny, zmiana liczby
boisk albo godziny startu po wygenerowaniu jest niemożliwe bez kasowania turnieju.

**Poprawka:**

- jedna funkcja `czyWolnyLos(m)` w `lib/turniejWynik.ts` (walkower + brak jednej strony
  i brak źródła), używana przez licznik w panelu, `KartaMeczu`, tabelę, podium,
  statystyki,
- `zapisz_terminarz()` liczy jako „rozegrane" wyłącznie `trwa | zakonczony` oraz
  walkower z OBIEMA drużynami (migracja razem z P0-1),
- karta wolnego losu: „Chaos United, wolny los, awans do 1/4" zamiast wyniku i „TBD",
  bez godziny i areny, przygaszona także w panelu,
- tekst pod przyciskiem: liczba mówi prawdę, a forma `plural(…, 'Rozegrano już' ×3)`
  do usunięcia (trzy identyczne formy niczego nie odmieniają).

### P0-3. Turniej nigdy nie przechodzi w stan „trwa" ani „zakończony"

**ZROBIONE 2026-11-08** w #462: „Rozpocznij turniej” i „Zakończ turniej” na pulpicie.

**Przyczyna (do potwierdzenia na bazie dev):** w repo nie ma żadnego miejsca, które
ustawia `turnieje.status = 'trwa'` lub `'zakonczony'`: ani przycisku w panelu, ani
wyzwalacza po pierwszym/ostatnim meczu. Panel zmienia status tylko na
`zamkniete_zapisy`/`zapisy`/`odwolany`. Tymczasem od `'trwa'` zależy:

- pulpit „wieża kontrolna" (co gra na której arenie, „Przesuń resztę o N min"),
- powiadomienie „Wasz mecz jest następny" (`155`, warunek `v_turniej.status = 'trwa'`),
- od `'zakonczony'`: podium, „Udostępnij wyniki", „Zamień drużynę w ekipę".

Czyli w dniu turnieju organizator zobaczy listę kontrolną zamiast pulpitu, a gracze
nie dostaną ani jednego powiadomienia o kolejnym meczu.

**Poprawka:** wyzwalacz na `turniej_mecze`: pierwszy mecz `trwa` → turniej `trwa`;
ostatni mecz rozstrzygnięty (finał albo cała liga) → `zakonczony`. Do tego ręczne
„Rozpocznij turniej" / „Zakończ turniej" na pulpicie jako droga awaryjna.
Test w bazie testowej: zakończenie finału przestawia status.

### P0-4. Organizator nie może poprawić składu drużyny

**ZROBIONE 2026-11-08** (ekran drużyny, `172`).

`DruzynaClient.tsx` pokazuje dopisywanie i usuwanie zawodników wyłącznie kapitanowi
(`jestKapitanem`), choć RLS (`czy_kapitan_druzyny()` w `145`) przepuszcza też
zarządzających turniejem. Przy turnieju charytatywnym organizator dostaje listy
składów na kartce albo w mailu i chce je wpisać sam; drużyny dodane ręcznie w panelu
nie mają kapitana, więc dziś **nikt** nie może wpisać im składu.

**Poprawka:** na ekranie drużyny i w panelu (Drużyny → klik w drużynę) organizator
widzi to samo co kapitan plus „Przekaż kapitana" / „Odbierz kapitana".

---

## P1: organizator się gubi (najważniejsze zgłoszenie)

### P1-1. Co jest publiczne, a co widzę tylko ja

Dziś nie da się tego odczytać z ekranu. Konkretnie:

- „Ustawienia" mieszają publiczną stronę (nazwa, opis, regulamin, okładka, galeria,
  sponsorzy) z rzeczami prywatnymi (BLIK widzą tylko kapitanowie, kontakty CSV tylko
  organizator) i operacyjnymi (zapisy, odwołanie, usunięcie),
- `widocznosc` (`publiczny` / `na_link`) ustawia się wyłącznie w kreatorze i potem
  nie ma jej w ogóle w panelu,
- baner „szkic, nikt poza Tobą go nie widzi" mówi nieprawdę: RLS „Turniej czyta każdy"
  (`145`), szkic znika tylko z list, a link działa dla każdego.

**Propozycja:**

- przy każdej sekcji plakietka **„Widzą wszyscy" / „Widzą kapitanowie" / „Tylko Ty"**,
  jedna mała ikona oka, ten sam zapis wszędzie,
- Ustawienia rozbite na trzy bloki z nagłówkami: **Strona turnieju** (publiczne),
  **Zapisy i wpisowe**, **Strefa niebezpieczna** (odwołaj, usuń),
- przełącznik widoczności w panelu: „Na liście turniejów Bojo" / „Tylko dla osób
  z linkiem", z jednym zdaniem, co to znaczy,
- poprawić tekst banera szkicu: „Szkic: nie ma go na liście turniejów, ale każdy
  z linkiem go zobaczy",
- „Zobacz turniej oczami kapitana" zamienić na przełącznik **„Podgląd jako: gość /
  kapitan / zawodnik"** na publicznej stronie (organizator widzi dokładnie to, co
  pokaże ludziom).

### P1-2. Nie da się zmienić podstaw po utworzeniu

Panel edytuje nazwę, opis, regulamin, termin zapisów. **Nie** edytuje: daty i godziny
startu, miejsca, formatu, czasu meczu i przerwy, maksymalnej liczby zawodników,
liczby drużyn, wpisowego. Przy pokazie dla klienta to pierwsza rzecz, którą trzeba
poprawić („jednak start o 9:00"). Propozycja: sekcja „Zasady gry" z tymi polami,
zablokowana z wyjaśnieniem, gdy terminarz zawiera rozegrane mecze.

### P1-3. Zapisywanie „po wyjściu z pola" bez żadnego sygnału

Nazwa, opis, regulamin i data zapisów zapisują się na `onBlur`, bez toastu
i bez obsługi błędu (`updateTurniej(...).then(wczytaj)` bez `catch`). Organizator
nie wie, czy zapisał. Propozycja: dyskretne „Zapisano ✓" przy polu, błąd w toaście.

### P1-4. Terminarz jako jeden długi ekran

Areny, grupy, generator, podgląd, lista meczów i „Przesuń od meczu" stoją pod sobą.
Propozycja:

- kroki z numerami: **1. Boiska → 2. Grupy → 3. Terminarz**, każdy z ✓ jak na pulpicie,
- przed wygenerowaniem: godzina startu, czas meczu, przerwa, liczba boisk w jednym
  miejscu z wyliczeniem „skończycie ok. 15:40" (`szacunekCzasu` już to liczy),
- lista meczów pogrupowana: faza → godzina, z nagłówkami „Grupa A", „1/8 finału",
- „Przesuń od meczu" przenieść do menu karty meczu („Przesuń ten i kolejne o…").

### P1-5. Drużyny: lista bez treści

W „W turnieju" widać nazwę, liczbę zawodników, „Opłacone" i dwie ikony bez podpisu
(kopiuj link, usuń: krzyżyk obok kopiowania, łatwo o pomyłkę). Brakuje: kapitana,
stanu „ma kapitana / czeka na kapitana", wejścia w drużynę. Propozycja: karta
drużyny klikalna, a na karcie stan w jednym wierszu: „Kapitan: Maciej · 7/10 ·
wpisowe ✓"; usuwanie schowane w ekranie drużyny, nie obok kopiowania.

### P1-6. Rozesłanie linków do drużyn wprowadzonych ręcznie

Organizator, który sam wpisał 14 drużyn, musi kopiować 14 linków po jednym.
Propozycja: „Udostępnij linki wszystkim drużynom" → gotowa wiadomość do wklejenia
(nazwa drużyny + link w każdej linii) oraz pojedynczo przez systemowe „Udostępnij".

---

## P2: dołączanie gracza jest nieintuicyjne

### P2-1. Ekran `/t/[kod]` mówi za mało

Na zrzucie gracz widzi nazwę drużyny, turniej, dwa nazwiska i „Nie ma mnie na liście".
Nie wie: kto jest kapitanem, ile osób już jest i ile może być, co się stanie po
dołączeniu, czy musi coś zapłacić.

**Propozycja:**

- nagłówek „Maciej zaprasza Cię do drużyny **Chaos United**" (imię kapitana),
- licznik „W składzie 2 z 10" i pełna lista (z kontem / wpisani przez kapitana),
- przy liście wolnych wpisów: „To ja: Maciej" zamiast samej nazwy w przycisku,
- „Nie ma mnie na liście" jako zwykły drugi przycisk, nie zwijane `<details>`,
- po dołączeniu ekran potwierdzenia: „Jesteś w składzie. Pierwszy mecz: sob. 9:20,
  Boisko 1" + „Dodaj do kalendarza" + „Wyślij link dalej", zamiast przekierowania
  na zakładkę Drużyny,
- błąd z bazy nigdy surowy: mapować komunikaty techniczne na „Nie udało się dołączyć,
  spróbuj jeszcze raz" (dziś użytkownik zobaczył `column reference …`).

### P2-2. Pierwszy z linku zostaje kapitanem

Gdy drużyna nie ma kapitana, ekran proponuje „Zostań kapitanem tej drużyny" jako
główny przycisk. Przy drużynach wpisanych przez organizatora oznacza to, że kapitanem
zostaje losowy kolega, któremu link przesłano dalej. Propozycja: osobny **link
kapitański** (organizator wysyła go jednej osobie) i zwykły link zawodnika; zwykły
link nie oferuje kapitanatu.

### P2-3. Gracz bez linku nie ma drogi do drużyny

Na publicznej stronie zakładka Drużyny pokazuje składy, ale nie ma „Dołącz" ani
„Poproś o dołączenie". Przy turnieju charytatywnym w małym mieście ludzie trafią
na stronę z plakatu, nie z WhatsAppa. Minimum: przy drużynie „Grasz tu? Poproś
kapitana o link" z kontaktem przez Bojo (wiadomość prywatna, `125`).

---

## P3: wygląd

- **Karta meczu:** wynik `0:0` dla niegranego meczu, „TBD" po angielsku. Zamiast „TBD":
  „Zwycięzca M3" (już jest w `nazwaSlotu`, ale tylko gdy jest źródło), a dla wolnego
  losu „wolny los".
- **Plakietki statusów** w panelu i publicznie: jeden słownik (`STATUS_MECZU`) już
  jest, ale „Walkower" i „Zaplanowany" mają podobną szarość. „Zaplanowany" bez
  plakietki (to stan domyślny), plakietka tylko gdy coś odbiega: na żywo, walkower,
  przełożony.
- **Panel na telefonie:** pasek zakładek przewija się w bok; 5 zakładek to za dużo
  na 360 px. Propozycja: „Pulpit · Drużyny · Terminarz · Więcej" (Ludzie i Ustawienia
  pod „Więcej").
- **Wyszarzony przycisk bez powodu na ekranie:** „Wygeneruj terminarz od nowa" jest
  dziś wyłączony przez P0-2, a jedynym wyjaśnieniem jest drobny szary tekst pod spodem.
  Wyłączony przycisk zawsze z powodem w jednym zdaniu tuż obok, czytelnym kolorem.
- **Ekran `/t/[kod]` po zalogowaniu:** dwie karty o tym samym tytule turnieju (nagłówek
  i wizytówka) powtarzają nazwę dwa razy. Nagłówek: nazwa drużyny; wizytówka: turniej.

---

## P4: pomysły pod Luboń (sprzedaż, nie blokada)

- **Cel charytatywny na stronie turnieju:** pasek „Zebraliśmy X zł dla Marysi"
  z ręcznie wpisywaną kwotą przez organizatora, link do zbiórki. To jest powód,
  dla którego ludzie przyjdą, więc powinien stać wyżej niż regulamin.
- **Tryb tablicy na hali:** `/turnieje/[id]/tv`, pełny ekran na rzutnik/telewizor:
  trwające mecze, następne, tabela. Odświeżanie co 15 s, bez logowania.
- **Plakat z kodem QR** do wydruku (S-3): QR do strony turnieju, termin, miejsce,
  sponsorzy. Organizatorzy rozwieszą go w Luboniu.
- **Sponsorzy i galeria** już są (`159`, R2): na pokazie warto je wypełnić logotypami
  organizatorów, robi to dużą różnicę w odbiorze.
- **Wynik z boiska przez sędziego bez konta**: link prowadzącego do jednego boiska
  (rola „może prowadzić mecze" już istnieje, ale wymaga konta i dodania w „Ludzie").
- **Po turnieju:** jedno udostępnienie „Wyniki + podium + zdjęcia" na Facebooka
  organizatora (OG per stan, `S-28`).

---

## Proponowana kolejność

| Kiedy | Co | Uwagi |
|---|---|---|
| od razu, jeden PR | P0-1, P0-2 (migracja + front), test w bazie testowej | bez tego pokaz się nie obroni |
| ten sam tydzień | P0-3, P0-4, P2-1 (komunikaty błędów, potwierdzenie) | warunek dnia turnieju |
| przed decyzją organizatorów | P1-1, P1-2, P1-3, P3 (karta meczu) | to jest to, co zobaczą na pokazie |
| po decyzji | P1-4, P1-5, P1-6, P2-2, P2-3, P4 wg tego, który turniej wybiorą | |
| tydzień przed 28.11 | próba generalna na dev z seedem 14 drużyn, dwa telefony, `SHOW_TURNIEJE` | patrz [testy-przedpremierowe.md](./testy-przedpremierowe.md) |

Każda zmiana zachowania widocznego dla gracza → wpis w [llm-context.md](./llm-context.md);
migracje → [baza-danych.md](./baza-danych.md).

---

## Decyzje właściciela z 2026-11-08 i co z nich zrobiono

Zrobione w jednym PR po #461 i #462 (migracje `172`, `173`), szczegóły w
[funkcje.md](./funkcje.md) („Uproszczenie modułu przed turniejem w Luboniu”):

| Decyzja | Stan |
|---|---|
| Wywalić datę końca, minimum drużyn, minimalny skład | zrobione (kolumny zostają w bazie) |
| Szacunek czasu mniej widoczny, nic na sztywno | zrobione: jedna linijka, liczy z „Zasad gry” i liczby boisk |
| Widok dnia turnieju do zobaczenia wcześniej: „Przetestuj” obok „Rozpocznij” | zrobione (`173`) |
| „Zobacz oczami kapitana” wypada | zrobione |
| Drużyna dodana ręcznie: link, przez który gracz przejmuje wpis albo dołącza | zrobione: „Wyślij link do drużyny”, organizator wpisuje skład |
| Pierwsza osoba z linku nie zostaje kapitanem | zrobione (`172`), kapitana wskazuje organizator |
| Tylko organizator, bez innych ról na start | zrobione: zakładka „Ludzie” schowana |
| Grupy: losowanie albo ręcznie, edycja po losowaniu | zrobione, plus zamiana par w 1. rundzie pucharu |
| Godzina niczego nie uruchamia, wszystko klikane | zrobione: bez „Przesuń od meczu” i licznika opóźnienia (start kliknięciem z #462) |
| Potwierdzenie zapisu ustawień | zrobione: „Zapisano” albo błąd przy każdym polu |
| Okładka na stronie turnieju | zrobione |
| Strzelcy opcjonalni, wynik wpisywany ręcznie, pytanie o brakujących strzelców | zrobione |
| Asysty całkowicie wywalić, zawodnik meczu bardzo opcjonalny | zrobione |

Zostaje na później z tej listy: P2-3 (gracz bez linku prosi o dołączenie), P4 (zbiórka,
tablica na hali, plakat z QR). Termin zapisów zostaje świadomie, bo to decyzja
organizatora, a nie zegar sterujący rozgrywką.

---

## Odpowiedź organizatora z Lubonia (2026-11-08) i wnioski

Organizator obejrzał turniej pokazowy. Streszczenie jego wiadomości i to, co z nich
wynika. Stan kodu sprawdzony 2026-11-11.

### Co powiedział

1. Czy da się dostosować **wszystko** pod turniej: przerwy na licytację, przerwy techniczne?
2. Kto tworzy drużynę: on czy kapitan sam, z nazwą i składem?
3. Czy to się zapisuje na bieżąco, gdyby coś się zepsuło?
4. W FC App przerosło go to: jedno blokowało drugie, przy kilku boiskach system sobie nie radził.
   Wrócił do organizowania „tradycyjnie".
5. Pomysły: kreator do wypełnienia bez konta, rejestracja przy publikacji; na stronie
   obiektu animacja ze strony głównej i od razu otwarty pierwszy krok kreatora; link do
   turnieju z nazwy i daty; link, którym gość bez konta widzi wydarzenie jako organizator
   i może je przejąć.
6. **Na 28.11 ma już dopięty harmonogram** i nie chce teraz zmuszać drużyn do niczego.
   Chętnie przy kolejnych. **Planuje ligę dla dzieci od nowego roku.**

### Wnioski

**W1. Na 28.11 Bojo nie wejdzie jako system zapisów, tylko jako tablica wyników.**
Drużyny i harmonogram już są. Realny wariant: organizator (albo my za niego) wpisuje
drużyny ręcznie, układa terminarz pod swój harmonogram i wpisuje wyniki, a widzowie
i drużyny patrzą na stronę turnieju (wyniki na żywo, tabela, drabinka, podium). Zero
pracy dla drużyn. **Blokuje to dziś jedno: nie da się ręcznie ustawić godziny i boiska
pojedynczego meczu** (`ulozHarmonogram()` układa wszystko sam, od godziny startu,
mecz po meczu). Jego gotowego harmonogramu nie da się więc odtworzyć.
→ **Zadanie T-1:** edycja godziny i boiska meczu w panelu (karta meczu → „Zmień"),
plus kolejność meczów. Mała zmiana, bez migracji (`updateMecz` już pisze
`zaplanowany_at` i `arena_id`).

**W2. Przerwy w harmonogramie (licytacja, techniczne, obiad) są nieobsłużone.** Jest
tylko stała przerwa między meczami. Dla turnieju charytatywnego licytacja to punkt
programu, nie margines.
→ **T-2:** bloki „Przerwa" w terminarzu (od–do, nazwa, widoczne na stronie turnieju
jako pozycja harmonogramu). Generator przesuwa mecze za blok. Wymaga tabeli
(`turniej_przerwy`) albo meczu typu „przerwa"; prościej osobna tabela.
Po T-1 można to obejść ręcznie, więc T-1 pierwsze.

**W3. Odpowiedzi, które mamy, ale ich nie widać.** Na pytania 2–4 odpowiedź brzmi „tak",
tylko nic na stronie tego nie mówi:
- drużyny: obie drogi (kapitan zgłasza się sam z nazwą i składem albo organizator dodaje
  i rozsyła link) — od #463 w pełni działające,
- zapis na bieżąco: każde kliknięcie idzie od razu do bazy, a przy błędzie sieci
  wynik da się zapisać ponownie bez dublowania goli (`wpiszWynikZeStrzelcami()`).
  **Trybu offline nie ma**: w hali bez zasięgu zapis się nie uda i trzeba będzie
  powtórzyć. Warto to sprawdzić na miejscu przed turniejem,
- kilka boisk: generator rozkłada mecze na boiska równolegle; to dokładnie miejsce,
  na którym poległ FC App.
→ **T-3:** krótka strona „Turniej w Bojo" (dla organizatora, nie gracza): trzy pytania
wyżej z odpowiedziami + „Przetestuj". To jest argument sprzedażowy, nie dokumentacja.

**W4. Jego obawa nr 1 to „przerośnie mnie".** Odpowiedzią jest #463 (mniej opcji, jedna
rola, „Przetestuj"). Następny krok: dać mu próbę na JEGO danych, zanim cokolwiek obieca
drużynom. „Przetestuj" robi dokładnie to.

**W5. Liga dla dzieci od stycznia: format „liga" jest, ale nie dla sezonu.** Dziś liga
to „każdy z każdym" jednego dnia, mecz po meczu. Liga sezonowa potrzebuje:
- **kolejek z datami** (kolejka 1 = sobota 10.01, kolejka 2 = 17.01…), generator
  rozkładający kolejki na kolejne terminy, przełożenie pojedynczego meczu,
- tabeli przez cały sezon (już działa, liczy się z wyników),
- **dzieci bez kont**: skład prowadzi trener albo organizator (od #463 może), rodzice
  oglądają. Powiadomienia trafiają do rodzica/trenera, nie dziecka,
- **ochrona danych małoletnich**: składy są dziś za ścianą logowania (dobrze), ale
  każdy zalogowany widzi pełne imiona i nazwiska dzieci. Potrzebna opcja „tylko imię
  i inicjał" na poziomie turnieju i zgoda rodzica w regulaminie.
→ **T-4:** liga sezonowa (daty kolejek). Średnia zmiana: generator + pole daty kolejki,
bez nowej encji, jeśli datę trzymamy w `zaplanowany_at` meczów.
→ **T-5:** tryb „dzieci" (skrócone nazwiska, bez kont zawodników). Mała zmiana.
Na styczeń trzeba mieć T-1, T-4, T-5.

**W6. Pomysły spoza modułu: dwa są duże i warte zrobienia, dwa są szybkie.**
- *Kreator bez konta, rejestracja przy publikacji*: kreator meczu ma już szkic
  w przeglądarce (`saveEventDraft()`), więc wystarczy przenieść bramkę logowania
  z wejścia na przycisk „Opublikuj" i odtworzyć szkic po powrocie. Kreator turnieju
  przekierowuje do logowania od razu i szkicu nie ma. Wysoki wpływ na konwersję
  organizatorów, średni koszt.
- *Wydarzenie gościa z linkiem organizatora i przejęciem*: organizator bez konta
  dostaje tajny link „zarządzaj" i przejmuje wydarzenie po rejestracji. Najmocniejszy
  z jego pomysłów (zero tarcia na start), ale to nowa granica dostępu w RLS: tajny
  token zamiast `auth.uid()`. Duży koszt i ryzyko, robić świadomie i z testami RLS.
- *Link do turnieju z nazwy i daty* (`/turnieje/turniej-pilkarski-lubon-2026-11-28`):
  ten sam wzorzec co `slugBoiska()`, z id w końcówce, żeby nazwy się nie zderzały.
  Mały koszt, dobry dla udostępniania i SEO.
- *Strona obiektu: animacja i otwarty pierwszy krok kreatora* zamiast „Zorganizuj tutaj":
  sensowne, ale strona obiektu to ruch z Google; trzeba zmierzyć, czy nie pogorszy
  wejść (`gsc-skutecznosc`). Średni koszt.

### Kolejność

| Priorytet | Zadanie | Po co |
|---|---|---|
| 1 | Migracje na produkcję (ręcznie) | bez tego #461 i #463 nie działają w bazie |
| 2 | T-1 ręczna godzina i boisko meczu | 28.11 jako tablica wyników na jego harmonogramie |
| 3 | T-2 przerwy w harmonogramie | licytacja w programie dnia |
| 4 | T-3 strona „Turniej w Bojo" | odpowiedź na jego trzy pytania |
| 5 | T-4, T-5 liga sezonowa i tryb dzieci | styczeń |
| 6 | link z nazwy i daty, kreator bez konta | wzrost, nie blokuje |
| 7 | wydarzenie gościa z przejęciem | duże, osobny plan z RLS |
