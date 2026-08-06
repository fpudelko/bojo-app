# Zapytania diagnostyczne — SQL z GitHub Actions

Workflow **SQL (tylko odczyt)** (`.github/workflows/sql.yml`) uruchamia zapytanie
na produkcyjnej bazie i wypisuje wynik do logu Actions. Powstał po to, żeby agent
pracujący w repo mógł sam sprawdzić stan danych, zamiast prosić o wklejenie wyniku
z Supabase SQL Editora.

Pliki `.sql` w tym katalogu to zapytania, które warto mieć pod ręką. Workflow
przyjmuje albo ścieżkę do pliku, albo zapytanie wpisane wprost.

## Jednorazowy setup

### 1. Rola tylko do odczytu

Supabase → SQL Editor, wklej i uruchom (podstaw własne hasło):

Hasło wygeneruj i **nie wymyślaj własnego** — musi być losowe i złożone
wyłącznie ze znaków bezpiecznych w adresie URI:

```bash
openssl rand -hex 32
```

`openssl rand -base64` **się nie nadaje**: produkuje `+`, `/` i `=`, które
w `postgresql://…` mają swoje znaczenie. Przy takim haśle psql nie rozpozna
adresu jako URI, przejdzie na parsowanie „klucz=wartość" i wypisze fragment
hasła w komunikacie błędu — czyli w publicznym logu Actions. Workflow ma na to
osobny warunek i odmówi uruchomienia, ale lepiej nie polegać na łapaniu w locie.

```sql
CREATE ROLE claude_ro LOGIN PASSWORD 'WKLEJ_WYNIK_openssl_rand_hex_32';

GRANT USAGE ON SCHEMA public TO claude_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_ro;

-- Żeby tabele dodane później też były czytelne bez powtarzania GRANT-a.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_ro;
```

Rola dostaje `SELECT` i nic więcej: żadnego `INSERT`, `UPDATE`, `DELETE` ani DDL.
Nie ma też `BYPASSRLS`, ale to bez znaczenia — właścicielem tabel jest kto inny,
więc polityki RLS jej nie ograniczają w sposób, który mógłby coś ukryć przed
diagnostyką. Jeśli wolisz, żeby widziała dokładnie to co przeglądarka, dopisz
`ALTER ROLE claude_ro SET row_security = on;`.

Odebranie dostępu w każdej chwili: `DROP ROLE claude_ro;`.

### 2. Connection string

Supabase → **Connect** → *Session pooler* → skopiuj adres. Podmień w nim nazwę
użytkownika i hasło na rolę z punktu 1. W poolerze nazwa użytkownika ma postać
`claude_ro.<project-ref>` (ten sam `project-ref`, który jest w gotowym adresie).

Wyjdzie coś w kształcie:

```
postgresql://claude_ro.abcdefghijklmnop:HASLO@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

### 3. Sekret w GitHubie

Settings → Secrets and variables → Actions → New repository secret:

- nazwa: `SUPABASE_DB_URL_RO`
- wartość: adres z punktu 2

Tyle. Od tej pory workflow działa, a hasło nie pojawia się nigdzie poza sekretami.

## Użycie

**Tryb agenta (bez klikania).** Agent zapisuje zapytanie do `biezace.sql`
i pushuje na gałąź `claude/sql/<cokolwiek>`. Push sam uruchamia workflow,
a agent odczytuje wynik z logu. Token agenta nie ma prawa odpalać workflowów
przez API (`403 Resource not accessible by integration`), więc push jest
jedynym wyzwalaczem, który agent kontroluje samodzielnie.

Gałąź jest jednorazowa i nie idzie do mastera — historia zostaje czysta,
a `biezace.sql` to bufor, którego treść nic nie znaczy między uruchomieniami.

Co ten push **nie** uruchamia:

- **Vercela** — `vercel.json` wyłącza deploymenty dla wzorca `claude/sql/*`.
  Bez tego każde zapytanie do bazy kosztowałoby preview build całej aplikacji.
- **CI** (`ci.yml`) — chodzi na `push` tylko dla `master` oraz na pull requestach,
  a dla gałęzi z zapytaniami PR-a się nie otwiera.

**Tryb ręczny.** Actions → *SQL (tylko odczyt)* → Run workflow, i albo `plik`
(np. `supabase/zapytania/mapa-lejek.sql`), albo `zapytanie` wpisane wprost.

Wynik ląduje w logu kroku „Uruchom".

## Uwagi

- Jedno uruchomienie = jeden plik, ale plik może mieć wiele zapytań — inaczej niż
  w SQL Editorze, gdzie widać wynik tylko ostatniego. Warto opisywać wyniki
  literałem w pierwszej kolumnie, żeby dało się je rozróżnić.
- Zapytanie leci w transakcji `READ ONLY`. Do zmian w bazie służą migracje
  w `supabase/migrations/`, uruchamiane ręcznie — ten workflow ich nie zastępuje
  i nie ma jak.
