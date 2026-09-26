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
# Stawia GOŁY, EFEMERYCZNY Postgres i puszcza na nim WSZYSTKIE migracje od
# zera przez `scripts/baza-testowa.sh --zostaw` — dokładnie ten sam kod, który
# już dziś sprawdza to samo w CI („Migracje od zera"), więc nie duplikujemy
# osobnej ścieżki bootstrapu Postgresa, która mogłaby się z tamtą rozjechać.
# Seedy i asercje z `baza-testowa.sh` nic tu nie szkodzą (nie zmieniają
# SCHEMATU) i nie są tu sednem — sednem jest sama baza po migracjach.
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

# ── Stawiamy referencję: repo, migracje od zera, bez seedów w naszych rękach —
#    seedy `baza-testowa.sh` i tak wgrywa, ale nie zmieniają schematu.
PORT_REF="${PGPORT_ODCISK:-55499}"
LOG_REF="$(mktemp)"
echo "→ Stawiam bazę z repo do porównania (port $PORT_REF)…"
if ! PGPORT_TEST="$PORT_REF" "$KATALOG/scripts/baza-testowa.sh" --zostaw >"$LOG_REF" 2>&1; then
  echo "✗ Baza z repo (migracje od zera) nie stanęła — to jest awaria repo, nie porównania:" >&2
  cat "$LOG_REF" >&2
  exit 1
fi
REF_URL="postgresql://postgres@localhost:$PORT_REF/bojo"

posprzataj_ref() {
  local pid
  pid="$(pgrep -f "postgres -D .*-p $PORT_REF " || true)"
  [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  rm -f "$LOG_REF"
}
trap posprzataj_ref EXIT

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
