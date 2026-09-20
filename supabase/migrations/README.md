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

### 3. Bramka na produkcję

Settings → **Environments** → `produkcja` → **Required reviewers** → dodaj
siebie. Od tej pory każdy przebieg produkcyjny czeka na kliknięcie „Approve",
a w mailu widać, co ma pójść.

Bez tego kroku workflow zadziała, ale produkcja nie będzie miała żadnej
bramki poza tym, że trzeba ją wybrać z listy — czyli zabezpieczeniem przed
pomyłką, nie przed pośpiechem.

### 4. Backfill — najważniejszy krok

Obie bazy mają już schemat postawiony ręcznie i **zerowy dziennik migracji**.
Pierwszy przebieg to zauważy i zatrzyma się, zamiast zacząć od `001` na żywej
bazie.

Dla każdej bazy osobno:

1. sprawdź, która migracja poszła jako ostatnia (jeśli nie wiesz —
   `supabase/zapytania/stan-migracji.sql` zgaduje to po obecności kolumn),
2. Actions → Migracje → Run workflow → wybierz bazę → w polu **oznacz_do**
   wpisz ten numer → Run.

To nic nie uruchamia; zapisuje tylko, że pliki do tego numeru już były.
Potem zwykły podgląd pokaże wyłącznie prawdziwą resztę.

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
