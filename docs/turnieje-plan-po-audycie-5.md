# Turnieje: plan po audycie 5, decyzje i migracje

**Stan na:** 2026-11-11 (master `97d7b0f`, po #461, #462, #463).
Źródła: raporty „audyt 5” i „audyt 6” (2026-11-11, sekcja 5a; zewnętrzny tester, telefon 360 px, konta test1/test3/test4),
odpowiedź organizatora z Lubonia ([turnieje-poprawki-lubon.md](./turnieje-poprawki-lubon.md),
zadania T-1…T-5) i przegląd kodu. Ręczny scenariusz testu →
[turnieje-scenariusz-testu-recznego.md](./turnieje-scenariusz-testu-recznego.md).

Audyt powstał PRZED #461–#463, więc połowa jego ustaleń jest już nieaktualna. Poniżej
każde ustalenie zestawione z kodem z dzisiaj.

---

## 1. Audyt 5 a stan kodu

| # | Ustalenie z audytu | Dziś | Dowód |
|---|---|---|---|
| N1a | „Grupy → puchar” kończy się na grupach, brak „Ułóż drabinkę” | **OTWARTE, KRYTYCZNE** | `zbudujPodglad()` w panelu dla `grupy_puchar` układa wyłącznie mecze grupowe; nigdzie nie powstają mecze pucharowe z awansujących. `zapisz_terminarz()` kasuje cały terminarz, więc drabinki nie da się nawet dopisać później. To domyślny format w kreatorze. |
| N1b | Brak „Zakończ turniej” i zwycięzcy | zrobione | #462: „Rozpocznij / Zakończ turniej” na pulpicie; podium z `lib/turniejPodium.ts`. |
| N2 | „Zakończony” po zamknięciu zapisów | zrobione | `stanTurnieju()`: „Zapisy zamknięte”, „Grupy rozegrane · Czeka na drabinkę”, „Zakończony” dopiero po komplecie meczów. |
| N3a | „Wygeneruj od nowa” aktywny po rozegranym meczu | zrobione | przycisk wyłączony z wyjaśnieniem; od #461 wolny los się nie liczy. |
| N3b | „Losuj ponownie” aktywny po rozegranym meczu | **OTWARTE** (małe) | przycisk w sekcji Grupy nie patrzy na `rozegranych` (wybór grupy przy drużynie już tak). |
| N3c | Komunikat serwera „Terminarz ma 1 nie w pełni zaplanowanych meczów — …” | **OTWARTE** (małe, migracja) | `RAISE` w `zapisz_terminarz()` (`146`, przepisane w `171`): długi myślnik, błędna odmiana, zły powód. |
| N4 | Karta listy liczy czekające zgłoszenia | zrobione | `toTurniej()` liczy wyłącznie `przyjeta`. |
| N5 | Przyjęcie drużyny poniżej minimum składu | nieaktualne | minimalny skład wypadł z modułu w #463. |
| N6 | Przebieg meczu bez minuty, osierocony dwukropek | zrobione | `minutaTeraz()` w konsoli, separator tylko przy nazwisku. |
| N7 | Koniec meczu w trzech krokach | zrobione | jeden panel zakończenia; zdanie o drabince tylko w meczu pucharowym. |
| N8 | Odmiana i format („2 zgłoszeń”, „1 fal”, „10:00:00”) | zrobione | `withCount()`/`plural()`, `etykietaTerminu()`, bez „fal”. Zostaje drobiazg: „Zniknie N zawodników” w oknie usuwania drużyny. |
| N9 | Zaplanowany mecz nie pokazuje terminu | **OTWARTE** (małe) | nagłówek meczu sprawdza `zaplanowanyAt`, ale wypisuje tylko boisko. |
| N10 | Czerwone tło kafelka czerwonej kartki | **OTWARTE** (małe) | `bg-red-50` w konsoli. |
| plan 10 | „Popraw wynik” po zakończeniu meczu | **OTWARTE, WAŻNE** | brak w konsoli i w `lib/turniejMecze.ts`; zakończony mecz jest zamrożony (RLS na zdarzeniach i `zakoncz_mecz()` przyjmują tylko `zaplanowany`/`trwa`). |
| plan 11 | Zawodnik dostaje termin swojego meczu | zrobione | powiadomienie `turniej_terminarz_gotowy` (146) + „Wasz mecz jest następny” (155). |
| plan 12 | Notatki testera w polu `opis` seedów | **DO DECYZJI** | patrz D-5. Audytor widział seedy `TU1…TU6` **na produkcji**. |
| uprość | „Ludzie”, podwójne potwierdzenie, „fale” | zrobione | #463, #462. |
| uprość | Sekcja „Galeria” nad treścią przed pierwszą edycją | **DO DECYZJI** | patrz D-6. |
| sprzątanie | Stary „AUDYT TEST do usuniecia” (f29ac055…) | **DO ZROBIENIA ręcznie** | usuwa go jego organizator z panelu albo admin SQL-em. |

---

## 2. Plan poprawek (bez decyzji, kolejność = kolejność wykonania)

| # | Co | Rozmiar | Migracja | Po co |
|---|---|---|---|---|
| P-1 | **Faza pucharowa po grupach** (N1a): gdy wszystkie mecze grupowe mają wynik, pulpit pokazuje „Grupy rozegrane. Ułóż drabinkę”. Drabinka z tabel (`posortujTabele()`), pary na krzyż (A1–B2, B1–A2; przy większej liczbie grup ta sama zasada co rozstawienie), podgląd z zamianą par jak w pucharze, zapis bez kasowania meczów grupowych. | duży | **tak (`174`)** | domyślny format kreatora nie kończy się dziś turniejem |
| P-2 | **Ręczna godzina i boisko meczu** (T-1): karta meczu w panelu → „Zmień termin”. | mały | nie | 28.11 na gotowym harmonogramie organizatora |
| P-3 | **Popraw wynik** zakończonego meczu: dopóki mecz, do którego przeszedł zwycięzca, się nie zaczął. Wpis „wynik poprawiony” w przebiegu. | średni | **tak (`175`)** | błąd wpisu bez wyjścia = Excel w połowie dnia |
| P-4 | Komunikaty serwera po ludzku (N3c) + „Losuj ponownie” wyłączone po rozegranym meczu (N3b). | mały | tak (w `174`) | prowizorka widoczna dla organizatora |
| P-5 | Termin w nagłówku meczu (N9), neutralny kafelek kartki (N10), „Znikną 2 drużyny / zawodnicy” (N8). | mały | nie | wykończenie |
| P-6 | Strona „Turniej w Bojo” dla organizatora (T-3): trzy pytania z Lubonia i „Przetestuj”. | mały | nie | sprzedaż |

**Przed pierwszym prawdziwym turniejem musi być:** P-1 (jeśli format „grupy → puchar”),
P-2 (Luboń 28.11), P-3. P-4 i P-5 jadą razem z nimi, bo są tanie.

---

## 3. Do decyzji właściciela

Każda z rekomendacją. Decyzja zmienia zakres albo dodaje migrację.

| # | Pytanie | Rekomendacja | Skutek decyzji |
|---|---|---|---|
| **D-1** | Czy wolno uruchomić teraz ręczną migrację `167` (kasuje tabele gier cyklicznych i `player_stats`)? Za nią czekają `168`–`173`, w tym naprawa dołączania z linku. | **Tak.** Decyzja o usunięciu gier cyklicznych zapadła w rundzie 9; mecze zostają, znika tylko szablon serii. | Bez tego nic z #461/#463 nie działa w bazie produkcyjnej. |
| **D-2** | Przerwy w harmonogramie (licytacja, techniczne, T-2): osobny blok w terminarzu czy wystarczy ręczna godzina meczu (P-2)? | **Na 28.11 wystarczy P-2** (przerwę robi się luką między meczami). Bloki „Przerwa” jako osobna tabela dopiero, gdy wróci drugi organizator z tym samym pytaniem. | Blok = migracja (`turniej_przerwy`) i zmiany w generatorze. |
| **D-3** | Liga sezonowa dla dzieci od stycznia (T-4, T-5): robimy? | **Tak, ale po P-1…P-3.** Kolejki z datami bez nowej tabeli (data w `zaplanowany_at` meczów kolejki), tryb „tylko imię i inicjał nazwiska” jako kolumna turnieju. | Jedna migracja dokładająca kolumnę (`176`). |
| **D-4** | „Popraw wynik” (P-3): do kiedy wolno? | **Dopóki następny mecz drabinki nie wystartował.** Później tylko admin. | Zakres RPC w `175`. |
| **D-5** | Seedy `TU1…TU6` widoczne na produkcji, z notatkami testera w opisie. | **Usunąć seedy z produkcji** (`wyczysc-testowe.sql`) i nie siać ich tam więcej; seedy żyją na dev i lokalnie (`baza-testowa.sh`). Notatek nie przenosić do osobnej kolumny: problemem jest seed na produkcji, nie pole. | Bez migracji. Wymaga sprawnej bazy dev do testów ręcznych (D-7). |
| **D-6** | Galeria nad treścią strony turnieju dla organizatora przed pierwszą edycją. | **Przenieść „+ Ustaw wygląd strony” pod ogłoszenia**, gdy galeria jest pusta. Gościom i tak się nie pokazuje. | Mała zmiana, bez migracji. |
| **D-7** | Baza dev nie odpowiada od 2026-09-29 (`tenant/user … not found`). | **Naprawić sekret `SUPABASE_DB_URL_DEV`** (projekt `BojoDev` wstrzymany albo zmieniony adres poolera) i zrobić `reset_dev`. | Bez tego migracje z gałęzi nie idą na dev, a podgląd Vercela PR-ów nie działa dla turniejów. |
| **D-8** | „Link do wydarzenia dla gościa z przejęciem” (pomysł z Lubonia). | **Osobny plan, nie teraz.** Nowa granica dostępu (tajny token zamiast `auth.uid()`), wymaga testów RLS. | Duża migracja, osobny PR. |

---

## 4. Migracje

### 4a. Czekają na produkcji (już w repo)

| Nr | Plik | Rodzaj | Co robi |
|---|---|---|---|
| 167 | `167_gry_cykliczne_usuniecie.sql` | **RĘCZNA** (DROP TABLE/COLUMN) | kasuje tabele gier cyklicznych i `player_stats` |
| 168 | `168_gosc_zostawia_email.sql` | dokłada | e-mail gościa |
| 169 | `169_poczta_do_kont_bez_pusha.sql` | dokłada | maile do kont bez pusha |
| 170 | `170_gosc_karta_sportowa.sql` | dokłada | karta sportowa gościa |
| 171 | `171_turniej_dolaczenie_i_wolne_losy.sql` | dokłada | naprawa dołączania z linku, wolne losy |
| 172 | `172_turniej_kapitana_wskazuje_organizator.sql` | dokłada | link bez kapitanatu, `ustaw_kapitana_druzyny()` |
| 173 | `173_turniej_proba_organizatora.sql` | dokłada | „Przetestuj” |

Kolejka zatrzymuje się na pierwszej ręcznej (`167`) i razem z nią stoi cała reszta.
Dlatego `168`–`173` nie poszły automatem przy merge'ach #461 i #463.

### 4b. Nowe, do napisania (po decyzjach)

| Nr | Nazwa robocza | Rodzaj | Zawartość | Zależy od |
|---|---|---|---|---|
| 174 | `turniej_faza_pucharowa` | dokłada | `dopisz_faze_pucharowa(p_turniej, p_mecze jsonb)`: wstawia mecze pucharowe BEZ kasowania grupowych, tylko gdy każdy mecz grupowy jest rozstrzygnięty i drabinki jeszcze nie ma; propaguje wolne losy. Plus komunikaty `zapisz_terminarz()` po ludzku (N3c). Testy w `rls.sql`. | P-1 |
| 175 | `turniej_popraw_wynik` | dokłada | `popraw_wynik_meczu(p_mecz, p_wynik_a, p_wynik_b, p_karne…)`: dla zarządzającego, tylko gdy mecz-następca nie ruszył; przelicza zwycięzcę, przepina go w drabince, zostawia ślad w przebiegu. | D-4 |
| 176 | `turniej_liga_dzieci` | dokłada | `turnieje.skracaj_nazwiska boolean DEFAULT false` (+ ewentualnie data kolejki, jeśli nie z `zaplanowany_at`). | D-3 |

Wszystkie trzy to `CREATE OR REPLACE FUNCTION` / `ADD COLUMN IF NOT EXISTS`, więc po
odblokowaniu kolejki (`167`) **pójdą na produkcję same przy merge'u**. Każda dostaje
nagłówek „dlaczego”, daje się puścić drugi raz i ma asercje w `supabase/test/rls.sql`
odpalane przez `./scripts/baza-testowa.sh`.

---

## 5. Jak wprowadzić migracje (krok po kroku)

### Raz, teraz: odblokowanie produkcji (`167`–`173`)

1. **Kopia bazy.** Supabase → projekt produkcyjny → Database → Backups: sprawdź, że jest
   kopia z dzisiaj (plan płatny robi je codziennie). Jeśli nie ma, zrób eksport
   `pg_dump` przed krokiem 3.
2. **Podgląd.** GitHub → Actions → **Migracje** → Run workflow:
   `srodowisko = produkcja`, **„Zapisz zmiany” odznaczone**. Przebieg wypisze w
   podsumowaniu, co by poszło: ma być `167`…`173`, nic więcej.
3. **Wykonanie.** Run workflow jeszcze raz: `srodowisko = produkcja`, **„Zapisz zmiany”
   zaznaczone**. Jeśli w Settings → Environments → `produkcja` jest ustawiony „Required
   reviewers”, przebieg czeka na Twoje „Approve”.
4. **Sprawdzenie w podsumowaniu przebiegu:**
   - lista zastosowanych `167`…`173`,
   - krok „Zgodność schematu z repo” bez sekcji „REPO ZAKŁADA, A POD $DB_URL TEGO NIE
     MA”. Ostatnio (2026-11-04) zgłaszał brak 7-argumentowej
     `dolacz_do_meczu_jako_goscie`, czyli właśnie `170`: po tym przebiegu ma zniknąć.
     Zostaną tylko informacje „pod $DB_URL jest więcej niż w repo” (to nie awaria).
5. **Dym na produkcji (5 min):** otwórz link drużyny turnieju pokazowego, dołącz jako
   „Nie ma mnie na liście”: ma przejść bez `column reference…`. W panelu „Przetestuj”
   ma utworzyć próbę. Potem pełny scenariusz z
   [turnieje-scenariusz-testu-recznego.md](./turnieje-scenariusz-testu-recznego.md).

**Gdy przebieg padnie:** migracje sprzed błędu są zastosowane i zapisane, a ta, która
padła, cofa się w całości (każdy plik we własnej transakcji). Poprawka idzie jako **nowy
plik** w PR-ze, nie edycja starego, i przebieg rusza od miejsca, w którym stanął. Szczegóły → [supabase/migrations/README.md](../supabase/migrations/README.md),
„Co robić, gdy przebieg padnie”. Nigdy nie wklejaj fragmentu migracji z ręki do SQL
Editora: patrz AGENTS.md, „migracja puszczona w połowie”.

### Na stałe: każda nowa migracja (`174`+)

1. PR z migracją + testem w `rls.sql`; lokalnie `./scripts/baza-testowa.sh` zielone.
2. Push na gałąź → workflow puszcza ją na **dev** (gdy D-7 naprawione) → sprawdzasz na
   podglądzie Vercela.
3. Merge do mastera → zadanie „produkcja (bezpieczne)” puszcza ją **samo**, bo dokłada.
   Sprawdź w Actions, że przeszło i że „Zgodność schematu” jest czysta.
4. Gdy kiedyś pojawi się znów migracja RĘCZNA (DROP, RENAME, `SET NOT NULL`), uruchom ją
   od razu po merge'u, tak jak w sekcji wyżej. Każdy dzień zwłoki to dzień, w którym
   wszystkie kolejne migracje stoją za nią, tak jak od 2026-11-04 stały `168`–`173`.

---

## 5a. Audyt 6 (2026-11-11, „Gramy dla Marysi” i trzy role)

Audyt na żywo na bojo.pl po wdrożeniu kodu #463, ale **przed** migracjami (kolejka stoi
na `167`). Puchar dwóch drużyn przeszedł od utworzenia do podium; „Przetestuj” nie był
uruchamiany. Oceny: zawodnik 2/5, kapitan 3/5, organizator 4/5.

| # | Ustalenie | Dziś w kodzie | Co robimy |
|---|---|---|---|
| A | **Zawodnik z linku nie wchodzi do składu**: `dolacz_do_druzyny_kodem` → 400, `42702 column reference "druzyna_id" is ambiguous`. Na ekranie „Coś poszło nie tak po naszej stronie” (to już mapowanie z #463). | Naprawione w `171`, **nieuruchomionej na produkcji**. | **D-1, sekcja 5.** Audyt jest dowodem, że to jedna rzecz blokująca rolę zawodnika. |
| B | Marysia: start 10:00, a pierwszy mecz 09:00; format „puchar”, a opis zapowiada grupy i „min. 60 min gry”; limit 15, a opis „12 drużyn”; skład „do 40”, a opis „bez limitu”. | Od #463 godzinę startu da się zmienić w Ustawieniach **bez** przeliczenia terminarza, więc taka rozbieżność powstaje jednym polem. Format „grupy → puchar” i tak nie domknie się bez P-1. | **D-9** (treść u organizatora) + **P-9** (ostrzeżenie w pulpicie). |
| C | Na 360 px „Utwórz turniej” jest pod banerem cookies i dolnym menu; zadziałało dopiero klawiaturą. | `/turnieje/nowe` ma `py-8` bez zapasu na dolne menu i bezpieczny obszar. | **P-7.** |
| D | Po terminie zapisów naraz „Trwają zapisy”, „Zostało 1 miejsce” i „Zapisy zamknięte”. | `stanTurnieju()` przy minionym `zapisy_do` wraca do „Trwają zapisy” (data liczy się tylko, gdy jest w przyszłości), a plakat liczy wolne miejsca bez względu na termin. Sam formularz `/zglos` blokuje poprawnie. | **P-8.** |
| E | Nagłówek, zdjęcie i ogłoszenie przed każdą zakładką; „Mecze” i „Tabela i drabinka” to podobne listy. | zgodnie z opisem | **P-11** (układ, średnie). |
| F | Brak „Popraw wynik”. | jak w N3 audytu 5 | **P-3** (bez zmian). |
| G | Kapitan po zgłoszeniu nie jest zawodnikiem (0 osób). | zgodnie z opisem | **P-10**: przy zgłoszeniu „Gram w tej drużynie” (domyślnie zaznaczone). |
| H | Publiczny mecz przed startem pokazuje „0:0”. | wynik renderowany zawsze | **P-12**: przed startem zamiast wyniku „Zaplanowany” i godzina (razem z N9). |
| I | Czerwony licznik na dzwonku. | `bg-red-500` w `NotificationBell.tsx`, poza paletą znaczeń z AGENTS.md | **D-10.** |
| J | Stała podpowiedź „Przytrzymaj Ekipy…” zasłania dół ekranów turnieju. | `BottomNav.tsx` | **D-11.** |
| K | Opis OG: „bez wpisowego”, „start” małą literą po kropce + cały długi opis. | `turniejMeta.ts` | w P-5 (wykończenie). |

### Nowe pozycje planu

| # | Co | Rozmiar | Migracja |
|---|---|---|---|
| P-7 | Kreator turnieju: zapas na dolne menu, cookies i `env(safe-area-inset-bottom)` pod przyciskiem; test klikalności na 360 px ze świeżą sesją i widocznym banerem cookies (Playwright, `*.klikalnosc.spec.ts`). | mały | nie |
| P-8 | Jeden status zapisów: po terminie „Zapisy zamknięte” (szary) wszędzie, bez „Zostało N miejsc”; licznik „14 drużyn z 15” zostaje. Test w Vitest dla `stanTurnieju()` i `stanZapisowTurnieju()`. | mały | nie |
| P-9 | Pulpit: ostrzeżenie, gdy godzina startu jest późniejsza niż pierwszy mecz (albo odwrotnie o więcej niż godzinę), z akcją „Wygeneruj terminarz od nowa” / „Ustaw start na 09:00”. Po zmianie godziny startu w Ustawieniach to samo pytanie od razu. | mały | nie |
| P-10 | `/zglos`: „Gram w tej drużynie” dopisuje zgłaszającego do składu. | mały | nie (`turniej_zawodnicy` przyjmuje kapitana z `145`) |
| P-11 | Strona turnieju: pełny nagłówek tylko na pierwszym wejściu, ogłoszenie zwinięte do jednej linii, dla grającego najpierw „Wasz następny mecz”. Zakładka „Drabinka” w pucharze, „Tabela” w lidze. | średni | nie |
| P-12 | Mecz przed startem bez „0:0”; termin w nagłówku (z N9). | mały | nie |

### Nowe decyzje

| # | Pytanie | Rekomendacja |
|---|---|---|
| **D-9** | Marysia: jaki jest prawdziwy format i start? Opis obiecuje grupy i min. 60 min gry, terminarz to puchar od 09:00, nagłówek 10:00. | Ustalić z organizatorem z Lubonia. Jeśli grupy → puchar, potrzebne P-1 **przed** 28.11; jeśli zostaje puchar z jego harmonogramem, P-2 i poprawa opisu (bez drugiej listy zasad w opisie). |
| **D-10** | Licznik powiadomień na dzwonku jest czerwony. | Zmienić na neutralny (szary/ciemny) albo pomarańczowy „nowość”; czerwień zostaje dla błędów. Decyzja dotyczy całej aplikacji, nie tylko turniejów. |
| **D-11** | Podpowiedź „Przytrzymaj Ekipy…” na stałe w dolnym menu. | Pokazywać raz, z zamknięciem; nie na trasach `/turnieje/*`. |

### Audyt 7 (2026-11-11, po migracjach `167`–`173`): co zrobiono

Audyt potwierdził: dołączenie z linku działa, „Przetestuj” tworzy izolowaną kopię,
„Ustaw kapitanem” działa. Zrobione w PR po audycie: Z-1 (baner cookies rezerwuje miejsce,
przycisk kreatora 48 px, test klikalności), Z-2 (powrót z linku), Z-3 = P-8 (jeden status
zapisów), Z-5 (następny mecz na górze ekranu drużyny), Z-6 (pełna nazwa, okładka i
ogłoszenia tylko na Info), Z-7 (jeden komunikat sukcesu), Z-8 (próba na szarym,
„Samobójczy”, cele 44 px), P-9 (ostrzeżenie start a pierwszy mecz), P-12 i N9 (przed
meczem „vs” i termin), N3b, N10. **Odkryty przy okazji błąd strefy czasowej**: godziny
meczów pokazywały UTC, stąd „10:00 a 09:00” u Marysi; naprawione we froncie i w
powiadomieniu (migracja `174`). Z-4 (treść opisu Marysi) zostaje po stronie organizatora.

### Co zmienia się w kolejności

Na pierwsze miejsce wchodzi bez zmian **D-1 (migracje)**: audyt 6 pokazał wprost, że to
jedyna przyczyna oceny 2/5 dla zawodnika. Do PR-a z P-1 dochodzą P-7, P-8 i P-9 (małe,
bez migracji). P-10…P-12 idą razem z P-2 i P-5.

## 6. Kolejność całości

1. **Ty:** D-1 → odblokowanie produkcji (sekcja 5) → dym.
2. **Ty:** D-7 (sekret dev) → `reset_dev`. D-5 (sprzątanie seedów i „AUDYT TEST”).
3. **My:** PR 1 = P-1 + P-4 (`174`) + P-7, P-8, P-9. PR 2 = P-2 + P-5 + P-10, P-12. PR 3 = P-3 (`175`). PR 4 = P-11.
4. **Ty:** pełny scenariusz testu ręcznego na produkcji, turnieje `TEST…` tylko z linku.
5. **Przed 28.11:** D-9, czyli decyzja, czy Luboń idzie jako tablica wyników na jego harmonogramie (P-2 wystarcza), czy jako grupy → puchar (wtedy P-1 jest warunkiem).
6. **Styczeń:** D-3 → liga sezonowa i tryb dzieci (`176`).
