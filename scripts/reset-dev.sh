#!/usr/bin/env bash
# Odtwarza bazę DEV od zera: kasuje schemat `public` i puszcza migracje
# z `supabase/migrations/` od `001`.
#
# ─────────────────────────────────────────────────────────────────────────────
# PO CO TO ISTNIEJE
#
# Od 2026-09-22 migracje idą na dev już z GAŁĘZI, nie dopiero po merge'u —
# żeby podgląd z Vercela widział schemat, który niesie PR. Ceną jest to, że
# jedna baza dev zbiera zmiany z wielu gałęzi, więc potrafi się zabrudzić:
#
#   • poprawiłeś migrację, która już poszła (dziennik jej nie uruchomi drugi raz),
#   • porzucony PR zostawił schemat, którego nie ma na masterze,
#   • dwie gałęzie dołożyły migrację o tym samym numerze.
#
# `migruj.sh` wykrywa wszystkie trzy i ZATRZYMUJE się. Ten skrypt jest
# wyjściem z każdego z nich: dev nie jest cenny, cenna jest jego zgodność
# z repo. Reset trwa dwie minuty i nie wymaga niczyjej decyzji.
#
# ─────────────────────────────────────────────────────────────────────────────
# CZEGO TEN SKRYPT NIE ZROBI
#
# • NIE URUCHOMI SIĘ NA PRODUKCJI. Trzy niezależne bezpieczniki niżej. To nie
#   jest paranoja: skrypt, który kasuje schemat, różni się od `migruj.sh`
#   wyłącznie zmienną DB_URL, a pomyłka w zmiennej jest najtańszym możliwym
#   błędem do popełnienia i najdroższym w skutkach.
# • NIE ODTWARZA KONT. `auth.users` to osobny schemat i zostaje nietknięty,
#   więc konta testowe (`test1@example.com` i spółka) przeżywają reset.
# • NIE URUCHAMIA SEEDÓW. Dane testowe wgrywa się osobno, tak jak dotąd.
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${DB_URL:-}" ]; then
  echo "✗ Brak DB_URL." >&2
  exit 1
fi

# ── Bezpiecznik 1: jawna zgoda ──────────────────────────────────────────────
if [ "${POTWIERDZAM_RESET:-}" != "tak" ]; then
  echo "✗ Reset wymaga POTWIERDZAM_RESET=tak." >&2
  echo "  Ten skrypt kasuje CAŁY schemat public." >&2
  exit 1
fi

# ── Bezpiecznik 2: to nie może być adres produkcji ──────────────────────────
# Porównanie z sekretem produkcyjnym, nie dopasowanie nazwy w adresie.
# Pierwsza wersja tego skryptu szukała w DB_URL słów „prod" i „bojo", co jest
# bezwartościowe: adres poolera Supabase niesie LOSOWY identyfikator projektu
# (`postgres.eguzyqzxfpvkonuraxdh@…`), a nie nazwę. Taki bezpiecznik
# przepuszczałby produkcję i dawał fałszywe poczucie osłony.
#
# Workflow podaje `DB_URL_PROD` właśnie po to, żeby dało się je tu porównać.
# Gdy zmiennej nie ma (uruchomienie z ręki), porównanie się nie odbywa i cała
# waga spada na bezpiecznik 3 — dlatego on liczy wiersze w bazie, a nie ufa
# temu, co ktoś wpisał w adresie.
if [ -n "${DB_URL_PROD:-}" ] && [ "$DB_URL" = "$DB_URL_PROD" ]; then
  echo "✗ To jest adres PRODUKCJI. Reset działa wyłącznie na dev." >&2
  exit 1
fi

psql_cicho() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qtA "$@"; }

# ── Bezpiecznik 3: baza musi mieć ślad po tym, że jest dev ──────────────────
# Ostatnia linia obrony i jedyna, która nie ufa niczemu z zewnątrz: patrzy
# na zawartość bazy. Produkcja ma prawdziwych użytkowników, dev ma konta
# testowe. Próg 500 jest z zapasem — seed turniejowy sam zakłada 60 kont,
# a pozostałe seedy dokładają kilkadziesiąt. Chodzi o odróżnienie bazy
# testowej od żywej, nie o dokładny pomiar.
KONTA="$(psql_cicho -c "SELECT count(*) FROM auth.users" 2>/dev/null || echo 0)"
if [ "$KONTA" -gt 500 ]; then
  echo "✗ Baza ma $KONTA kont w auth.users — to nie wygląda na dev." >&2
  echo "  Reset przerwany. Jeśli to NAPRAWDĘ dev, sprawdź adres i zgłoś mi to." >&2
  exit 1
fi

echo "Reset bazy dev. Kont w auth.users: $KONTA (zostaną nietknięte)."
echo ""

# ── Czysta kartka ───────────────────────────────────────────────────────────
# Recepta z docs/baza-danych.md. Granty muszą wrócić razem ze schematem:
# bez nich każde zapytanie kończy się „permission denied", a to wygląda
# jak dziura w politykach RLS, nie jak brak grantu.
echo "→ Kasuję schemat public"
psql_cicho <<'SQL' >/dev/null
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, anon, authenticated, service_role;
SQL

echo "→ Puszczam migracje od 001"
echo ""
DB_URL="$DB_URL" "$KATALOG/scripts/migruj.sh" --wykonaj

echo ""
echo "✓ Dev odtworzony z repo. Seedy wgraj osobno, jeśli ich potrzebujesz."
