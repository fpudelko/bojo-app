#!/usr/bin/env bash
# Lokalna baza testowa: goły Postgres + atrapy Supabase + wszystkie migracje.
#
# PO CO: sprawdza, że migracje aplikują się OD ZERA i nie odwołują się do
# rzeczy, które wcześniejsze usunęły. Ta klasa błędu dwa razy wywróciła
# produkcję — raz `get_player_stats()` po skasowanej kolumnie `status`
# (migracja `064` usunęła kolumnę, `074` musiała naprawiać funkcję), raz kod
# wołający `dolacz_do_meczu()` wdrożony przed uruchomieniem migracji `078`.
#
# Nie odtwarza Supabase — nie ma tu GoTrue ani PostgREST. Sprawdza schemat
# i dane, nie działanie aplikacji.
#
#   ./scripts/baza-testowa.sh            # postaw, zwaliduj, posprzątaj
#   ./scripts/baza-testowa.sh --zostaw   # zostaw działającą bazę (port 55432)
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Postgres odmawia startu jako root. Gdy skrypt leci z roota (kontenery CI
# i środowiska agenta), przełączamy się na systemowego użytkownika `postgres`
# — katalog danych musi wtedy do niego należeć.
JAKO=""
if [[ "$(id -u)" -eq 0 ]] && id postgres >/dev/null 2>&1; then
  JAKO="postgres"
fi
PORT="${PGPORT_TEST:-55432}"
DANE="$(mktemp -d)"
[[ -n "$JAKO" ]] && chown "$JAKO" "$DANE"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
ZOSTAW=0
[[ "${1:-}" == "--zostaw" ]] && ZOSTAW=1

if [[ -z "$BIN" ]]; then
  echo "✗ Brak serwera PostgreSQL (initdb). Zainstaluj postgresql." >&2
  exit 1
fi

sprzataj() {
  [[ $ZOSTAW -eq 1 ]] && { echo "Baza działa dalej: postgresql://postgres@localhost:$PORT/bojo"; return; }
  if [[ -n "${JAKO:-}" ]]; then
    setpriv --reuid="$JAKO" --regid="$JAKO" --clear-groups "$BIN/pg_ctl" -D "$DANE" -m immediate stop >/dev/null 2>&1 || true
  else
    "$BIN/pg_ctl" -D "$DANE" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$DANE"
}
trap sprzataj EXIT

echo "→ Stawiam Postgresa (port $PORT)…"
jako() { if [[ -n "$JAKO" ]]; then setpriv --reuid="$JAKO" --regid="$JAKO" --clear-groups "$@"; else "$@"; fi; }

jako "$BIN/initdb" -D "$DANE" -U postgres --auth=trust >/dev/null
jako "$BIN/pg_ctl" -D "$DANE" -o "-p $PORT -k $DANE -c listen_addresses=localhost" -l "$DANE/log" -w start >/dev/null
export PGHOST=localhost PGPORT="$PORT" PGUSER=postgres
createdb bojo

echo "→ Atrapy Supabase (schemat auth, pgcrypto, role)…"
psql -q -v ON_ERROR_STOP=1 -d bojo -f "$KATALOG/supabase/test/shim.sql"

echo "→ Migracje…"
LICZBA=0
for plik in "$KATALOG"/supabase/migrations/*.sql; do
  nazwa="$(basename "$plik")"
  if ! psql -q -v ON_ERROR_STOP=1 -d bojo -f "$plik" 2>"$DANE/blad"; then
    echo "✗ MIGRACJA PADŁA: $nazwa" >&2
    sed 's/^/    /' "$DANE/blad" >&2
    exit 1
  fi
  LICZBA=$((LICZBA + 1))
done
echo "  $LICZBA migracji zastosowanych bez błędu"

echo "→ Konta testowe…"
psql -q -v ON_ERROR_STOP=1 -d bojo -f "$KATALOG/supabase/seed-test-users.sql"

# Konta osobowe, których seedy oczekują w auth.users.
psql -q -v ON_ERROR_STOP=1 -d bojo <<'SQL'
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (extensions.gen_random_uuid(), 'franekks@gmail.com', now(), '{"display_name":"Franek P."}'::jsonb),
       (extensions.gen_random_uuid(), 'j4n.brz0@gmail.com', now(), '{"display_name":"Jan Brzos"}'::jsonb)
ON CONFLICT (email) DO NOTHING;
SQL

for seed in seed_regresja.sql; do
  echo "→ Seed: $seed"
  if ! psql -q -v ON_ERROR_STOP=1 -d bojo -f "$KATALOG/supabase/$seed" 2>"$DANE/blad"; then
    echo "✗ SEED PADŁ: $seed" >&2
    sed 's/^/    /' "$DANE/blad" >&2
    exit 1
  fi
done

echo "→ Testy reguł dostępu (RLS)…"
if ! psql -q -v ON_ERROR_STOP=1 -d bojo -f "$KATALOG/supabase/test/rls.sql" 2>"$DANE/blad"; then
  echo "✗ TESTY RLS PADŁY" >&2
  sed 's/^/    /' "$DANE/blad" >&2
  exit 1
fi
sed -n 's/^psql:[^ ]* NOTICE:  //p' "$DANE/blad" || true

echo "→ Sanity: liczby wierszy"
psql -q -d bojo -c "SELECT
  (SELECT count(*) FROM auth.users)          AS konta,
  (SELECT count(*) FROM events)              AS mecze,
  (SELECT count(*) FROM event_participants)  AS uczestnicy;"

echo "✓ Schemat i dane spójne."
