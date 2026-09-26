#!/usr/bin/env bash
# Porównuje schemat pod `DB_URL` (dev albo produkcja, TUŻ PO migracjach) z tym,
# co dają migracje z repo puszczone od zera. Wywołuje z `.github/workflows/migracje.yml`.
#
# ─────────────────────────────────────────────────────────────────────────────
# PO CO TO ISTNIEJE
#
# Migracja `164` naprawiła stan, w którym dziennik `schema_migracje` na
# produkcji mówił „zastosowana”, a obiektu (funkcji, kolumny) w bazie NIE
# BYŁO — bo backfill (`--oznacz-do`) widzi wyłącznie TABELE
# (`supabase/migrations/README.md`), więc migracja bez własnej tabeli jest
# dla niego niewidoczna. Skutek: `bojo-przypomnienia` padało na produkcji
# CODZIENNIE od 2026-09-12 do 2026-09-26, i nikt tego nie zauważył, bo żadne
# zadanie nie porównywało bazy z repo — jedynym sygnałem był brak telefonu
# u organizatora.
#
# Ten skrypt jest tym porównaniem. Uruchomiony PO KAŻDYM przebiegu migracji
# (dev i produkcja), łapie ten sam rozjazd następnego dnia, nie za dwa
# tygodnie.
#
# ─────────────────────────────────────────────────────────────────────────────
# JAK LICZY „REPO"
#
# Stawia GOŁY, EFEMERYCZNY Postgres i puszcza na nim WYŁĄCZNIE migracje od
# zera — NIE przez `scripts/baza-testowa.sh` (bootstrap Postgresa jest tu
# świadomie zduplikowany, nie wywołany). Powód: `baza-testowa.sh` wgrywa też
# `supabase/test/shim.sql` (który dokłada w `public` pięć OPAKOWAŃ na funkcje
# pgcrypto — `gen_random_uuid`, `gen_random_bytes`, `crypt`, `gen_salt`,
# `digest` — bo goły Postgres nie ma `extensions` w `search_path`; prawdziwy
# Supabase ma i tych opakowań nigdy nie tworzy) oraz WSZYSTKIE
# `supabase/test/*.sql` (funkcje pomocnicze asercji, `_p_oczekuj` i podobne,
# których żadne środowisko Supabase nigdy nie widzi). Referencja budowana
# przez `--zostaw` porównywana z dev/produkcją zgłaszała te ~19 funkcji jako
# fałszywe „BRAKI" — złapane na PR #439, zanim trafiło to na produkcję: obie
# strony testu lokalnego (referencja vs referencja) miały ten sam fałszywy
# nadmiar i różnica się znosiła, dopóki nie porównano z bazą, która
# faktycznie nigdy nie widziała `shim.sql` ani `test/*.sql`.
#
# Referencja tutaj więc: `shim.sql` (bo migracje zakładają `auth`/`extensions`/
# `storage` i rolę `authenticated` — bez tego nie da się ich w ogóle
# zastosować), potem WYŁĄCZNIE migracje — bez seedów, bez `supabase/test/*.sql`
# — i `DROP FUNCTION` na pięciu opakowaniach z `public` na samym końcu, PO
# migracjach, nie przed nimi. Kolejność ma znaczenie: migracja `036` woła
# `gen_random_bytes()` bez kwalifikacji schematu, licząc na to opakowanie
# (na prawdziwym Supabase `extensions` jest w `search_path` bazy, więc
# wywołanie bez kwalifikacji też się rozwiązuje, tylko inną drogą) — usunięte
# przed migracjami, wywala `036` błędem „function … does not exist”.
# Opakowania nie zmieniają schematu, który zakładają PÓŹNIEJSZE migracje, więc
# zdjęcie ich po fakcie, tuż przed odciskiem, daje ten sam wynik bez wywrócenia
# `036`.
#
# „ODCISK" to lista obiektów w schemacie `public`: funkcje (z sygnaturą
# i md5 ciała po zdjęciu komentarzy/białych znaków — ten sam pomysł co
# w `scripts/ryzyko-migracji.mjs`), kolumny tabel, indeksy, wyzwalacze,
# polityki RLS. Funkcje NALEŻĄCE DO ROZSZERZENIA (`pgcrypto`, `pg_trgm`) są
# wykluczone przez `pg_depend` — ich ciało zależy od wersji rozszerzenia, nie
# od migracji w tym repo, więc porównywanie ich dawałoby fałszywe alarmy przy
# każdej różnicy wersji Postgresa między środowiskami.
#
# WYNIK: obiekty, które są W REPO, a BRAKUJE ich pod `DB_URL` — to jest
# CZERWONE, to dokładnie ta klasa błędu z `164`. Obiekty odwrotnie (są pod
# `DB_URL`, nie ma ich w repo) to INFORMACJA, nie awaria — dawna migracja,
# ręczny eksperyment w SQL Editorze, coś, co repo jeszcze nie wie, że istnieje.
#
# Użycie:
#   DB_URL=postgresql://…  ./scripts/odcisk-schematu.sh
# Kod wyjścia: 0 — brak braków. 1 — są braki (lista w stdout).
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${DB_URL:-}" ]; then
  echo "✗ Brak DB_URL — adres bazy do porównania z repo." >&2
  exit 1
fi

# Zapytanie dające ODCISK: jedna linia na obiekt, posortowane, żeby `comm`
# porównywał zbiory, a nie kolejność. Format `RODZAJ klucz` — rodzaj z przodu,
# żeby brak funkcji i brak kolumny o przypadkiem tej samej nazwie nigdy się
# nie zlały w jedną linię.
ZAPYTANIE="
  SELECT 'FUNC ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
           || left(md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g')), 12)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prolang IN (SELECT oid FROM pg_language WHERE lanname IN ('sql', 'plpgsql'))
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  UNION ALL
  SELECT 'COL ' || c.table_name || '.' || c.column_name
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name IN (
           SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
  UNION ALL
  SELECT 'IDX ' || indexname FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  SELECT 'TRIG ' || event_object_table || '.' || trigger_name
    FROM information_schema.triggers WHERE trigger_schema = 'public'
  UNION ALL
  SELECT 'POL ' || tablename || '.' || policyname
    FROM pg_policies WHERE schemaname = 'public'
  ORDER BY 1;
"

odcisk() { # odcisk <adres>
  psql "$1" -v ON_ERROR_STOP=1 --single-transaction -tA -c "SET TRANSACTION READ ONLY" -c "$ZAPYTANIE"
}

# ── Stawiamy referencję: goły Postgres, `shim.sql` bez opakowań pgcrypto,
#    WYŁĄCZNIE migracje. Bootstrap Postgresa jest tu świadomie zduplikowany
#    z `scripts/baza-testowa.sh` (ten sam JAKO/BIN/lokalizacja UTF-8) —
#    `baza-testowa.sh` NIE jest wołany, bo wgrywa też seedy i `test/*.sql`
#    (patrz komentarz na początku pliku).
JAKO=""
if [[ "$(id -u)" -eq 0 ]] && id postgres >/dev/null 2>&1; then
  JAKO="postgres"
fi
PORT_REF="${PGPORT_ODCISK:-55499}"
DANE_REF="$(mktemp -d)"
[[ -n "$JAKO" ]] && chown "$JAKO" "$DANE_REF"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"

if [[ -z "$BIN" ]]; then
  echo "✗ Brak serwera PostgreSQL (initdb). Zainstaluj postgresql." >&2
  exit 1
fi

jako() { if [[ -n "$JAKO" ]]; then setpriv --reuid="$JAKO" --regid="$JAKO" --clear-groups "$@"; else "$@"; fi; }

posprzataj_ref() {
  if [[ -n "$JAKO" ]]; then
    setpriv --reuid="$JAKO" --regid="$JAKO" --clear-groups "$BIN/pg_ctl" -D "$DANE_REF" -m immediate stop >/dev/null 2>&1 || true
  else
    "$BIN/pg_ctl" -D "$DANE_REF" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$DANE_REF"
}
trap posprzataj_ref EXIT

echo "→ Stawiam bazę z repo do porównania (port $PORT_REF)…"
LOKALIZACJA=C.UTF-8
locale -a 2>/dev/null | grep -qix "c.utf8\|c.utf-8" || LOKALIZACJA=C
jako "$BIN/initdb" -D "$DANE_REF" -U postgres --auth=trust \
  --encoding=UTF8 --locale="$LOKALIZACJA" >/dev/null
jako "$BIN/pg_ctl" -D "$DANE_REF" -o "-p $PORT_REF -k $DANE_REF -c listen_addresses=localhost" -l "$DANE_REF/log" -w start >/dev/null
REF_URL="postgresql://postgres@localhost:$PORT_REF/bojo"
env PGHOST=localhost PGPORT="$PORT_REF" PGUSER=postgres createdb bojo

psql -q -v ON_ERROR_STOP=1 -d "$REF_URL" -f "$KATALOG/supabase/test/shim.sql"

echo "→ Migracje (referencja)…"
for plik in "$KATALOG"/supabase/migrations/*.sql; do
  if ! psql -q -v ON_ERROR_STOP=1 -d "$REF_URL" -f "$plik" 2>"$DANE_REF/blad"; then
    echo "✗ MIGRACJA PADŁA (referencja): $(basename "$plik")" >&2
    sed 's/^/    /' "$DANE_REF/blad" >&2
    exit 1
  fi
done

# Te pięć istnieje tylko jako obejście braku `extensions` w `search_path` na
# gołym Postgresie (patrz komentarz na początku pliku) — prawdziwy Supabase
# ich nie ma, więc w odcisku referencji też nie mogą zostać. Zdjęte TERAZ,
# po migracjach: usunięte wcześniej wywalają migrację `036`, która woła
# `gen_random_bytes()` bez kwalifikacji schematu.
psql -q -v ON_ERROR_STOP=1 -d "$REF_URL" -c "
  DROP FUNCTION public.gen_random_uuid();
  DROP FUNCTION public.gen_random_bytes(int);
  DROP FUNCTION public.crypt(text, text);
  DROP FUNCTION public.gen_salt(text);
  DROP FUNCTION public.digest(text, text);
"

echo "→ Liczę odcisk repo…"
odcisk "$REF_URL" | sort > /tmp/odcisk-repo.txt

echo "→ Liczę odcisk \$DB_URL…"
odcisk "$DB_URL" | sort > /tmp/odcisk-cel.txt

# `comm -23`: linie WYŁĄCZNIE po lewej (repo) — to są BRAKI pod `DB_URL`.
BRAKI="$(comm -23 /tmp/odcisk-repo.txt /tmp/odcisk-cel.txt)"
NADMIAR="$(comm -13 /tmp/odcisk-repo.txt /tmp/odcisk-cel.txt)"

if [ -n "$NADMIAR" ]; then
  echo ""
  echo "ℹ Pod \$DB_URL jest więcej niż w repo (informacja, nie awaria):"
  echo "$NADMIAR" | sed 's/^/    /'
fi

if [ -n "$BRAKI" ]; then
  echo ""
  echo "✗ REPO ZAKŁADA, A POD \$DB_URL TEGO NIE MA:"
  echo "$BRAKI" | sed 's/^/    /'
  echo ""
  echo "  To jest dokładnie rozjazd z migracji 164: dziennik schema_migracje"
  echo "  mógł uznać plik za zastosowany, choć obiekt, który zakłada, nigdy"
  echo "  realnie nie powstał. Sprawdź, czy migracja odpowiadająca brakującemu"
  echo "  obiektowi faktycznie poszła (Actions → Migracje → oznacz_do, albo"
  echo "  ręczne \`--wykonaj\`), zamiast wierzyć samemu dziennikowi."
  exit 1
fi

echo ""
echo "✓ Zgodność schematu: zero braków względem repo."
