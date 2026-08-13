#!/usr/bin/env bash
# Pełny lokalny Supabase (Postgres + GoTrue + PostgREST) z migracjami i danymi.
#
# Różnica wobec `scripts/baza-testowa.sh`: tamten stawia goły Postgres i sprawdza
# WYŁĄCZNIE schemat — jest tani i wchodzi do głównej bramki CI. Ten podnosi cały
# stos, więc aplikacja może się realnie zalogować i czytać dane przez API.
# Wymaga Dockera, dlatego stoi w nieblokującym workflow `wizualne.yml`.
#
# Po uruchomieniu wypisuje zmienne środowiskowe do podstawienia buildowi.
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KATALOG"

echo "→ Podnoszę stos Supabase…"
supabase start >/dev/null

DB_URL="$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DB_URL"])')"
API_URL="$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["API_URL"])')"
ANON="$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["ANON_KEY"])')"

echo "→ Migracje (po kolei, jak w SQL Editorze)…"
LICZBA=0
for plik in supabase/migrations/*.sql; do
  if ! psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$plik" >/dev/null 2>/tmp/blad-migracji; then
    echo "✗ MIGRACJA PADŁA: $(basename "$plik")" >&2
    sed 's/^/    /' /tmp/blad-migracji >&2
    exit 1
  fi
  LICZBA=$((LICZBA + 1))
done
echo "  $LICZBA migracji"

echo "→ Konta testowe…"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed-test-users.sql

echo "→ Dane do zrzutów (daty na sztywno)…"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed_wizualne.sql

# Zmienne dla builda i testów.
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON"
} >> "${GITHUB_ENV:-/dev/stdout}"

echo "✓ Stos gotowy: $API_URL"
