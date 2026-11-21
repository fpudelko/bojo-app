#!/usr/bin/env bash
# Składa adres roli tylko do odczytu, gdy sekret `SUPABASE_DB_URL_RO` zawiera
# SAMO HASŁO zamiast całego connection stringa (2026-11-21: sekret miał 44
# znaki, bez `postgresql://` i bez `@`, czyli wklejone samo hasło).
#
# Host, port, bazę i identyfikator projektu bierzemy z działającego sekretu
# migracji `SUPABASE_DB_URL_PROD` (użytkownik w poolerze ma postać
# `postgres.<ref>`). Z tamtego sekretu NIE bierzemy hasła: logujemy się rolą
# `claude_ro` (supabase/zapytania/README.md), a sql.yml i tak wymusza
# transakcję READ ONLY.
#
# Wejście:  DB_URL_PROD (pełny adres), HASLO_RO (samo hasło), opcjonalnie ROLA_RO.
# Wyjście:  gotowy adres na stdout; hasło zamaskowane w logu Actions.
set -euo pipefail

ROLA="${ROLA_RO:-claude_ro}"

if [ -z "${HASLO_RO:-}" ]; then
  echo "::error::Brak sekretu SUPABASE_DB_URL_RO. Instrukcja: supabase/zapytania/README.md" >&2
  exit 1
fi
HASLO="$(printf '%s' "$HASLO_RO" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
echo "::add-mask::$HASLO" >&2

# Adres produkcji przez wspólny skrypt: oczyszczony, z hasłem zakodowanym.
PROD="$(DB_URL="${DB_URL_PROD:-}" "$(dirname "$0")/sprawdz-adres-bazy.sh" SUPABASE_DB_URL_PROD)"
BEZ_SCHEMATU="${PROD#*://}"
POSWIADCZENIA="${BEZ_SCHEMATU%@*}"
RESZTA="${BEZ_SCHEMATU##*@}"
UZYTKOWNIK="${POSWIADCZENIA%%:*}"

case "$UZYTKOWNIK" in
  *.*) REF="${UZYTKOWNIK#*.}" ;;
  *)
    echo "::error::Z SUPABASE_DB_URL_PROD nie da się odczytać identyfikatora projektu (użytkownik bez kropki: to nie jest adres Session pooler). Wklej do SUPABASE_DB_URL_RO pełny adres — supabase/zapytania/README.md" >&2
    exit 1
    ;;
esac

zakoduj() {
  local surowe="$1" wynik="" znak i
  local LC_ALL=C
  for (( i = 0; i < ${#surowe}; i++ )); do
    znak="${surowe:i:1}"
    case "$znak" in
      [A-Za-z0-9._~-]) wynik+="$znak" ;;
      *)               wynik+=$(printf '%%%02X' "'$znak") ;;
    esac
  done
  printf '%s' "$wynik"
}
ZAKODOWANE="$(zakoduj "$HASLO")"
echo "::add-mask::$ZAKODOWANE" >&2

echo "SUPABASE_DB_URL_RO zawiera samo hasło: składam adres roli $ROLA na hoście z SUPABASE_DB_URL_PROD." >&2
printf 'postgresql://%s.%s:%s@%s' "$ROLA" "$REF" "$ZAKODOWANE" "$RESZTA"
