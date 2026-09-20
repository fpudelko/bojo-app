#!/usr/bin/env bash
# Uruchamia BRAKUJĄCE migracje na wskazanej bazie i zapisuje, które poszły.
#
#   DB_URL=… ./scripts/migruj.sh                 # podgląd (nic nie zmienia)
#   DB_URL=… ./scripts/migruj.sh --wykonaj
#   DB_URL=… ./scripts/migruj.sh --oznacz-do 156 # backfill, NIC nie uruchamia
#
# ─────────────────────────────────────────────────────────────────────────────
# PO CO TO POWSTAŁO
#
# Do 2026-09-20 migracje szły ręcznie: człowiek otwierał plik na GitHubie,
# kopiował do SQL Editora i klikał Run — osobno na `BojoDev` i osobno na
# produkcji. Kosztowało to trzy rzeczy naraz:
#   1. nikt (łącznie z bazą) nie wiedział, KTÓRE pliki już poszły —
#      `supabase/zapytania/stan-migracji.sql` zgaduje to po obecności kolumn
#      i trzeba go dopisywać ręcznie przy każdej migracji, więc zdążył zgnić,
#   2. baza dev regularnie zostawała w tyle, a wtedy podgląd PR-a wygląda na
#      zepsuty, choć zepsuty jest tylko jej schemat,
#   3. agent pracujący w repo nie mógł tego zrobić sam i kończył pracę zdaniem
#      „migracja wymaga ręcznego uruchomienia".
#
# DZIENNIK (`schema_migracje`) ROZWIĄZUJE PUNKT 1 RAZ NA ZAWSZE. Wpis powstaje
# W TEJ SAMEJ TRANSAKCJI co sama migracja, więc nie ma stanu „migracja poszła,
# ale dziennik o tym nie wie" ani odwrotnego.
#
# ─────────────────────────────────────────────────────────────────────────────
# DLACZEGO TO JEST BEZPIECZNE (i gdzie dokładnie przestaje być)
#
# • Każda migracja leci we WŁASNEJ transakcji. Błąd w 155 cofa 155 w całości
#   i zatrzymuje przebieg; 154 zostaje zastosowana i zapisana. Sprawdzone:
#   żaden plik w `supabase/migrations/` nie zawiera własnego BEGIN/COMMIT ani
#   `CREATE INDEX CONCURRENTLY`, których nie wolno opakować w transakcję.
# • Cały przebieg trzyma blokadę doradczą, więc dwa równoległe uruchomienia
#   (merge i ręczny klik w tej samej minucie) nie wejdą sobie w drogę.
# • Domyślny tryb to PODGLĄD. Zapis wymaga jawnego `--wykonaj`.
# • PUSTY DZIENNIK NA NIEPUSTEJ BAZIE ZATRZYMUJE SKRYPT. To najważniejszy
#   warunek w tym pliku: baza produkcyjna ma dziś 153 migracje zastosowane
#   ręcznie i zero wpisów w dzienniku, więc naiwny przebieg zacząłby od `001`.
#   Migracje są wprawdzie idempotentne (AGENTS.md wymaga, żeby dawały się
#   puścić drugi raz), ale „wprawdzie" nie jest poziomem pewności, na którym
#   uruchamia się 153 pliki na żywej bazie. Trzeba wtedy raz użyć
#   `--oznacz-do <numer>`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRACJE="$KATALOG/supabase/migrations"

TRYB="podglad"
OZNACZ_DO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --wykonaj)   TRYB="wykonaj"; shift ;;
    --podglad)   TRYB="podglad"; shift ;;
    --oznacz-do) TRYB="oznacz"; OZNACZ_DO="${2:-}"; shift 2 ;;
    *) echo "Nieznany argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "${DB_URL:-}" ]; then
  echo "✗ Brak DB_URL." >&2
  exit 1
fi

psql_cicho() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qtA "$@"; }

# ── Dziennik ────────────────────────────────────────────────────────────────
# `IF NOT EXISTS`, bo skrypt musi działać zarówno na bazie, która go już ma,
# jak i na świeżej. Tabela NIE jest zwykłą migracją w `supabase/migrations/`:
# musi istnieć, ZANIM cokolwiek z tego katalogu ruszy, więc nie ma jak ustawić
# jej w kolejce za samą sobą.
psql_cicho <<'SQL' >/dev/null
-- `client_min_messages` wycisza „relation already exists, skipping" — przy
-- każdym uruchomieniu na istniejącej bazie to jedyne, co ten blok wypisuje,
-- a NOTICE w logu udaje problem.
SET client_min_messages = warning;
CREATE TABLE IF NOT EXISTS schema_migracje (
  plik            text PRIMARY KEY,
  numer           int  NOT NULL,
  suma_kontrolna  text,
  zastosowana_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE schema_migracje IS
  'Które pliki z supabase/migrations/ poszły na tej bazie. Pisze scripts/migruj.sh.';
SQL

ZASTOSOWANE="$(psql_cicho -c 'SELECT plik FROM schema_migracje ORDER BY plik')"
LICZBA_ZASTOSOWANYCH="$(printf '%s' "$ZASTOSOWANE" | grep -c . || true)"

# ── Czy baza jest pusta ─────────────────────────────────────────────────────
NIEPUSTA="$(psql_cicho -c "SELECT to_regclass('public.events') IS NOT NULL")"

if [ "$LICZBA_ZASTOSOWANYCH" -eq 0 ] && [ "$NIEPUSTA" = "t" ] && [ "$TRYB" != "oznacz" ]; then
  cat >&2 <<'BLAD'
✗ Ta baza ma już schemat, ale dziennik migracji jest PUSTY.

  Znaczy to, że migracje szły na nią ręcznie i nikt tego nie zapisał. Gdybym
  ruszył teraz, zacząłbym od 001 — na żywej bazie.

  Zrób to RAZ, dla tej bazy:
      1. sprawdź, która migracja poszła jako ostatnia,
      2. DB_URL=… ./scripts/migruj.sh --oznacz-do <numer>

  Nic to nie uruchamia — tylko zapisuje, że pliki do tego numeru już były.
BLAD
  exit 1
fi

# ── Lista do zrobienia ──────────────────────────────────────────────────────
DO_ZROBIENIA=()
for plik in "$MIGRACJE"/*.sql; do
  nazwa="$(basename "$plik")"
  if ! printf '%s\n' "$ZASTOSOWANE" | grep -qxF "$nazwa"; then
    DO_ZROBIENIA+=("$nazwa")
  fi
done

numer_z_nazwy() { printf '%s' "${1%%_*}" | sed 's/^0*//'; }

# ── Tryb: oznacz (backfill) ─────────────────────────────────────────────────
if [ "$TRYB" = "oznacz" ]; then
  if ! printf '%s' "$OZNACZ_DO" | grep -qE '^[0-9]+$'; then
    echo "✗ --oznacz-do wymaga numeru, np. --oznacz-do 156" >&2
    exit 2
  fi
  ILE=0
  for plik in "$MIGRACJE"/*.sql; do
    nazwa="$(basename "$plik")"
    numer="$(numer_z_nazwy "$nazwa")"
    [ "$numer" -le "$OZNACZ_DO" ] || continue
    suma="$(sha256sum "$plik" | cut -c1-16)"
    psql_cicho -c "INSERT INTO schema_migracje (plik, numer, suma_kontrolna)
                   VALUES ('$nazwa', $numer, '$suma')
                   ON CONFLICT (plik) DO NOTHING" >/dev/null
    ILE=$((ILE + 1))
  done
  echo "✓ Oznaczono $ILE plików (do numeru $OZNACZ_DO) jako już zastosowane."
  echo "  Niczego nie uruchomiono."
  exit 0
fi

# ── Nic do zrobienia ────────────────────────────────────────────────────────
if [ ${#DO_ZROBIENIA[@]} -eq 0 ]; then
  echo "✓ Baza jest aktualna — $LICZBA_ZASTOSOWANYCH migracji w dzienniku, zero do zrobienia."
  exit 0
fi

# ── Ostrzeżenia, nie blokady ────────────────────────────────────────────────
NAJWYZSZY="$(psql_cicho -c 'SELECT COALESCE(max(numer), 0) FROM schema_migracje')"
for nazwa in "${DO_ZROBIENIA[@]}"; do
  numer="$(numer_z_nazwy "$nazwa")"
  if [ "$numer" -lt "$NAJWYZSZY" ]; then
    # Zdarza się po zmergowaniu dwóch gałęzi, z których każda dołożyła
    # migrację. Nie jest błędem, ale warto to zobaczyć w logu.
    echo "⚠ $nazwa ma numer niższy niż najwyższy zastosowany ($NAJWYZSZY) — kolejność się rozjechała."
  fi
done

# Zmiana pliku, który już poszedł, nie zostanie uruchomiona drugi raz. Przy
# poprawce komentarza to bez znaczenia; przy zmianie SQL-a znaczy, że baza
# i repo mówią co innego — i lepiej dowiedzieć się o tym z logu niż z błędu
# aplikacji.
while IFS= read -r nazwa; do
  [ -n "$nazwa" ] || continue
  plik="$MIGRACJE/$nazwa"
  [ -f "$plik" ] || { echo "⚠ $nazwa jest w dzienniku, ale nie ma go już w repo."; continue; }
  zapisana="$(psql_cicho -c "SELECT COALESCE(suma_kontrolna, '') FROM schema_migracje WHERE plik = '$nazwa'")"
  teraz="$(sha256sum "$plik" | cut -c1-16)"
  if [ -n "$zapisana" ] && [ "$zapisana" != "$teraz" ]; then
    echo "⚠ $nazwa zmieniła się od zastosowania — baza ma STARĄ wersję (nie uruchamiam ponownie)."
  fi
done <<< "$ZASTOSOWANE"

echo ""
echo "Do zrobienia (${#DO_ZROBIENIA[@]}):"
for nazwa in "${DO_ZROBIENIA[@]}"; do echo "  • $nazwa"; done
echo ""

if [ "$TRYB" = "podglad" ]; then
  echo "To był PODGLĄD — nic nie zostało uruchomione. Dopisz --wykonaj."
  exit 0
fi

# ── Wykonanie ───────────────────────────────────────────────────────────────
# Jedna sesja psql na cały przebieg: blokada doradcza musi przeżyć wszystkie
# pliki, a blokada jest związana z sesją. Każdy plik dostaje własne
# BEGIN/COMMIT, więc błąd w środku nie cofa tych, które już przeszły.
SKRYPT="$(mktemp)"
trap 'rm -f "$SKRYPT"' EXIT
{
  echo "\\set ON_ERROR_STOP on"
  # Gdyby drugi przebieg ruszył równolegle, ten poczeka, zamiast aplikować to
  # samo dwa razy. Po zwolnieniu zobaczy już zapisany dziennik i nie zrobi nic.
  echo "SELECT pg_advisory_lock(hashtext('bojo_migracje'));"
  for nazwa in "${DO_ZROBIENIA[@]}"; do
    numer="$(numer_z_nazwy "$nazwa")"
    suma="$(sha256sum "$MIGRACJE/$nazwa" | cut -c1-16)"
    echo "\\echo '→ $nazwa'"
    echo "BEGIN;"
    echo "\\i $MIGRACJE/$nazwa"
    echo "INSERT INTO schema_migracje (plik, numer, suma_kontrolna) VALUES ('$nazwa', $numer, '$suma');"
    echo "COMMIT;"
  done
  echo "SELECT pg_advisory_unlock(hashtext('bojo_migracje'));"
} > "$SKRYPT"

if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$SKRYPT"; then
  echo ""
  echo "✓ Zastosowano ${#DO_ZROBIENIA[@]} migracji."
else
  echo ""
  echo "✗ Przebieg przerwany. Migracje SPRZED błędu zostały zastosowane i zapisane" >&2
  echo "  w dzienniku; ta, która padła, została cofnięta w całości." >&2
  echo "  Popraw plik i uruchom ponownie — ruszy od miejsca, w którym stanął." >&2
  exit 1
fi
