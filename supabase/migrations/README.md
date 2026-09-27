# Migracje — jak trafiają do baz

Do 2026-09-20 odpowiedź brzmiała „ręcznie, przez SQL Editor". Dziś robi to
workflow **Migracje** (`.github/workflows/migracje.yml`) przez
`scripts/migruj.sh`. Ten plik opisuje jednorazowy setup i to, co trzeba
wiedzieć, zanim się go użyje.

## Co się dzieje kiedy

| Zdarzenie | Baza | Co robi |
|---|---|---|
| merge do `master` ruszający `supabase/migrations/**` | **dev** (`BojoDev`) | uruchamia brakujące, automatycznie |
| push na `claude/migracje/**` | **dev** | tylko wypisuje, co by poszło |
| Actions → Migracje → Run workflow | dev albo **produkcja** | podgląd domyślnie; zapis po zaznaczeniu „wykonaj" |

**Produkcja nigdy nie dzieje się sama.** Merge do mastera wdraża KOD na
Vercelu; schemat bazy zmienia się osobno, wtedy, gdy ktoś świadomie kliknie.
Powód jest asymetryczny: deploy da się cofnąć w minutę, a `DROP COLUMN` nie.

## Jednorazowy setup

### 1. Rola z prawem zapisu

Workflow **musi** móc tworzyć tabele, polityki RLS, funkcje `SECURITY DEFINER`
i nadawać granty — czyli potrzebuje uprawnień właściciela schematu. W Supabase
praktyczną odpowiedzią jest użytkownik `postgres` projektu. Nie próbuj wycinać
węższej roli „na wszelki wypadek": połowa migracji w tym repo kończy się
`GRANT`/`ALTER POLICY`, a rola, która nie może tego zrobić, wywróci przebieg
w połowie — czyli w najgorszym możliwym momencie.

**To jest inna rola niż `SUPABASE_DB_URL_RO`** z `sql.yml`. Tamta ma wyłącznie
`SELECT` i ma taka zostać; nie podmieniaj jej na tę.

Hasło projektu znajdziesz w Supabase → Settings → Database. **Wklej je tak,
jak jest** — znaki specjalne nie są problemem: `scripts/sprawdz-adres-bazy.sh`
zakoduje hasło procentowo przed podaniem go psql-owi. Stało tu wcześniej, żeby
zresetować hasło na `openssl rand -hex 32`, jeśli zawiera `+`, `/` albo `=`,
i to była zła rada: wina leżała po stronie zapisu w adresie, nie po stronie
hasła, a wysyłanie człowieka na reset hasła bazy tylko po to, żeby zadziałał
jeden workflow, jest niewspółmierne.

Powód, dla którego kodowanie w ogóle jest potrzebne, zostaje bez zmian: przy
`+`, `/` albo `=` psql nie rozpoznaje adresu jako URI, przechodzi na parsowanie
„klucz=wartość" i potrafi wypisać fragment hasła w komunikacie błędu, czyli
w publicznym logu Actions. Maskowanie sekretów tego nie łapie, bo to część
sekretu, a nie całość. Zdarzyło się raz.

Jedyne, co skrypt nadal odrzuca, to placeholder `[YOUR-PASSWORD]` zostawiony
w skopiowanym adresie: to nie jest hasło i zakodowanie go zamieniłoby czytelny
błąd na mylący.

### 2. Sekrety w GitHubie

Settings → Secrets and variables → Actions:

| Sekret | Skąd |
|---|---|
| `SUPABASE_DB_URL_DEV` | projekt `BojoDev` → Connect → Session pooler |
| `SUPABASE_DB_URL_PROD` | projekt produkcyjny → Connect → Session pooler |

**Session pooler, nie Direct connection — to nie jest kosmetyczny wybór.**
Adres `db.<ref>.supabase.co` (Direct connection) ma w Supabase wyłącznie
rekord AAAA, a runnery GitHub Actions nie mają IPv6. Połączenie nie ma wtedy
jak dojść, a psql mówi tylko „Network is unreachable", co czyta się jak awaria
Supabase albo źle ustawiona zapora. Session pooler idzie po IPv4:

```
postgresql://postgres.<ref>:HASŁO@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Zwróć uwagę, że **zmienia się także nazwa użytkownika**: `postgres.<ref>`
zamiast samego `postgres`. To jest miejsce, w którym najłatwiej skleić adres
z dwóch zakładek i dostać błąd uwierzytelnienia zamiast sieciowego.
`scripts/sprawdz-adres-bazy.sh` rozpoznaje adres Direct connection i mówi to
wprost, zanim dojdzie do próby połączenia.

### 2b. Co idzie na produkcję samo, a co wymaga kliknięcia

Merge do mastera aplikuje na produkcji **tylko migracje, które DOKŁADAJĄ** rzeczy:
kolumnę, tabelę, politykę, funkcję, indeks. Takiej migracji nie da się zepsuć danych,
których jeszcze nie ma, a kazanie człowiekowi klikać przy każdej z nich uczy go klikać
bez patrzenia, czyli psuje ochronę dokładnie tam, gdzie jest potrzebna.

Kliknięcia wymaga to, czego nie odwróci ponowne uruchomienie:

```
DROP TABLE   DROP SCHEMA   DROP COLUMN   DROP TYPE
TRUNCATE     DELETE FROM   SET NOT NULL
ALTER COLUMN … TYPE        RENAME COLUMN   RENAME TO
```

Decyduje `scripts/ryzyko-migracji.mjs`, nie deklaracja autora: migrację kasującą kolumnę
pisze się równie beztrosko jak każdą inną, a autor, który zapomni ją oznaczyć, jest
dokładnie tym, którego migracja jest groźna. Podejrzeć klasyfikację całego katalogu:

```bash
node scripts/ryzyko-migracji.mjs          # cały katalog
node scripts/ryzyko-migracji.mjs plik.sql # jeden plik, kod wyjścia 1 = ręczna
```

Na dzisiejszych 155 migracjach ręcznych jest siedem (`041`, `054`, `064`, `088`, `110`,
`121`, `151`).

**Dopóki produkcja nie ma sekretu ALBO nie ma backfillu, zadanie pomija się po cichu.**
Oba to stany konfiguracji, nie awarie, więc nie świecą czerwono na masterze: czerwony
znaczek, który nic nie znaczy, uczy ignorować czerwone znaczki, a wtedy przestaje
działać ten, który coś znaczy. Wiadomość idzie do podsumowania przebiegu. Ręczne
uruchomienie na produkcji zachowuje się odwrotnie i MA zaświecić czerwono: ktoś
świadomie kliknął i musi zobaczyć, że nic nie poszło.

**Zadanie produkcyjne zatrzymuje się PRZED pierwszą ręczną, razem z całą resztą za nią.**
Migracji nie da się przeskoczyć: gdy `158` jest bezpieczna, `159` ręczna, a `160`
bezpieczna, puszczenie `160` bez `159` dałoby schemat nieodpowiadający żadnej wersji
repo. Co czeka, widać w podsumowaniu przebiegu.

Gdy wiesz coś, czego skaner nie zobaczy (backfill blokujący tabelę na minuty), dopisz
w nagłówku pliku:

```sql
-- RECZNA: backfill przepisuje 400 tys. wierszy, blokuje tabelę
```

Znacznika odwrotnego nie ma i nie będzie. Byłby furtką, przez którą wyjdzie każdy `DROP`.

### 3. Bramka na produkcję

Settings → **Environments** → `produkcja` → **Required reviewers** → dodaj
siebie. Od tej pory każde RĘCZNE uruchomienie na produkcji czeka na kliknięcie
„Approve", a w mailu widać, co ma pójść.

Automat z sekcji 2b tej bramki nie ma i mieć nie może: zadanie przypięte do środowiska
z „Required reviewers" zatrzymałoby się na zatwierdzeniu, czyli zamieniło automat
z powrotem w klikanie. Dlatego to osobne zadanie (`produkcja-bezpieczne`) i dlatego
puszcza wyłącznie migracje dokładające. Bramka pilnuje `DROP`-ów, nie wszystkiego.

Bez tego kroku workflow zadziała, ale produkcja nie będzie miała żadnej
bramki poza tym, że trzeba ją wybrać z listy — czyli zabezpieczeniem przed
pomyłką, nie przed pośpiechem.

### 4. Backfill — najważniejszy krok

Obie bazy mają już schemat postawiony ręcznie i **zerowy dziennik migracji**.
Pierwszy przebieg to zauważy i zatrzyma się, zamiast zacząć od `001` na żywej
bazie.

Dla każdej bazy osobno:

1. **Numeru nie musisz znać.** Odpal zwykły podgląd (Actions → Migracje → Run
   workflow → wybierz bazę → Run, bez zaznaczania „Zapisz zmiany"). Sonda
   przejdzie po plikach migracji, porówna tabele, które każdy z nich tworzy,
   ze stanem bazy i wypisze gotowy numer. Na `BojoDev` wyszło:

   ```
   Ostatnia rozpoznana: 147_turniej_rozgrywka.sql
   Pierwsza brakująca:  150_turniej_ogloszenia_blik.sql (brak tabeli turniej_ogloszenia)
   → Uruchom raz:  Actions → Migracje → oznacz_do = 147
   ```

   To jest **dolna granica**: migracja bez własnej tabeli (sama polityka,
   funkcja albo kolumna) jest dla sondy niewidoczna, więc sonda woli policzyć
   ją jako niezastosowaną i puścić drugi raz. Przy idempotentnych migracjach
   to nic nie kosztuje, a pomyłka w drugą stronę cicho zostawiłaby dziurę
   w schemacie. `supabase/zapytania/stan-migracji.sql` zostaje jako droga
   awaryjna, ale zna pliki tylko do `125`.
2. Actions → Migracje → Run workflow → wybierz bazę → w polu **oznacz_do**
   wpisz ten numer → **zaznacz „Zapisz zmiany"** → Run.

Sam backfill niczego nie uruchamia, zapisuje tylko, że pliki do tego numeru już
były. Zaznaczone „Zapisz zmiany" dokłada do tego drugi krok w tym samym
przebiegu: od razu puszcza to, co z dziennika wyszło jako brakujące. Bez tego
trzeba klikać Run workflow dwa razy, a podsumowanie pokazuje wtedy sam dziennik,
czyli nie odpowiada na pytanie, które się naprawdę zadaje: czy poszło.

**Po backfillu dziennik może dalej kłamać — sonda widzi WYŁĄCZNIE tabele.**
Zdarzyło się naprawdę (migracja `164`, 2026-09-26): backfill na produkcji
zaliczył `131` (jest tabela z sąsiedniego pliku), a funkcja `odmien_nie_oddalo()`,
którą TA migracja zakłada, nigdy realnie nie powstała. Skutek: zadanie
`bojo-przypomnienia` padało w bazie **codziennie przez dwa tygodnie**, zanim
ktoś zapytał wprost — żadne CI tego nie widziało, bo żadne nie porównuje bazy
z repo PO backfillu, tylko przed nim. Workflow „Migracje" robi to teraz sam,
jako krok „Zgodność schematu z repo" po każdym przebiegu
(`scripts/odcisk-schematu.sh`) — ale jeśli kiedykolwiek robisz backfill ręcznie,
z pominięciem workflowu, puść ten skrypt osobno od razu potem:

```bash
DB_URL=<adres bazy po backfillu> ./scripts/odcisk-schematu.sh
```

Brak wypisanych braków = dziennik i baza mówią to samo. Backfill BEZ tego
kroku jest wyłącznie stawianiem hipotezy, nie potwierdzeniem.

## Dziennik — `schema_migracje`

```sql
SELECT plik, zastosowana_at FROM schema_migracje ORDER BY plik DESC LIMIT 10;
```

Wpis powstaje **w tej samej transakcji** co sama migracja, więc nie ma stanu
„migracja poszła, ale dziennik o tym nie wie" ani odwrotnego. Tabelę tworzy sam
skrypt (`CREATE TABLE IF NOT EXISTS`), nie migracja z tego katalogu — musi
istnieć, zanim cokolwiek stąd ruszy, więc nie da się jej ustawić w kolejce za
samą sobą.

Dziennik zastępuje `supabase/zapytania/stan-migracji.sql`, które zgadywało stan
po obecności kolumn i wymagało ręcznego dopisywania przy każdej migracji (przez
co zdążyło zgnić — zna pliki do `125`). Tamto zostaje jako droga awaryjna dla
bazy bez dziennika i jako podpowiedź do kroku 4.

## Co robić, gdy przebieg padnie

Migracje sprzed błędu **są zastosowane i zapisane**; ta, która padła, została
cofnięta w całości (każdy plik leci we własnej transakcji). Popraw plik
i uruchom ponownie — ruszy od miejsca, w którym stanął.

Jedyny przypadek wymagający ręki to migracja, która przeszła na dev, a padła
na produkcji z powodu różnicy w danych (np. `ALTER TABLE … NOT NULL` przy
istniejących `NULL`-ach). Wtedy poprawka idzie jako **nowy plik**, nie jako
edycja starego: plik już zapisany w dzienniku nie zostanie uruchomiony drugi
raz, a skrypt wypisze ostrzeżenie, że repo i baza mówią co innego.

## Czego ten workflow nie robi

- **Nie cofa migracji.** Nie ma `down`. Odwrócenie zmiany to nowa migracja —
  ta sama zasada co dotąd.
- **Nie pilnuje kolejności między bazami.** Można wypuścić migrację na
  produkcję, pomijając dev; skrypt tego nie zablokuje. Pilnuje tego nawyk
  i to, że dev dostaje ją i tak automatycznie po merge'u.
- **Nie uruchamia seedów.** Dane testowe zostają ręczne — patrz
  `supabase/bundles/04-seedy.sql`.
