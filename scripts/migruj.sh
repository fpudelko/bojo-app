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

# Numer z nazwy pliku: `154_turniej_zaproszenia.sql` → `154`.
numer_z_nazwy() { printf '%s' "${1%%_*}" | sed 's/^0*//'; }

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

DZIENNIK_PUSTY_NA_ZAJETEJ=0
if [ "$LICZBA_ZASTOSOWANYCH" -eq 0 ] && [ "$NIEPUSTA" = "t" ] && [ "$TRYB" != "oznacz" ]; then
  DZIENNIK_PUSTY_NA_ZAJETEJ=1
  # PODGLĄD PRZEPUSZCZAMY. Strażnik istnieje po to, żeby nie URUCHOMIĆ 001 na
  # żywej bazie — a podgląd niczego nie uruchamia. Zatrzymanie go tutaj
  # odbierało jedyną drogę, którą da się sprawdzić, JAKI numer podać
  # w `--oznacz-do`, czyli blokowało dokładnie tę diagnozę, do której strażnik
  # ma skłonić.
  if [ "$TRYB" != "podglad" ]; then
    cat >&2 <<'BLAD'
✗ Ta baza ma już schemat, ale dziennik migracji jest PUSTY.

  Znaczy to, że migracje szły na nią ręcznie i nikt tego nie zapisał. Gdybym
  ruszył teraz, zacząłbym od 001 — na żywej bazie.

  Zrób to RAZ, dla tej bazy:
      1. uruchom podgląd (bez --wykonaj) — podpowie numer,
      2. DB_URL=… ./scripts/migruj.sh --oznacz-do <numer>

  Nic to nie uruchamia — tylko zapisuje, że pliki do tego numeru już były.
BLAD
    exit 1
  fi
fi

# ── Podpowiedź numeru do backfillu ──────────────────────────────────────────
#
# Baza ma schemat, dziennika nie ma. Pytanie brzmi: do którego pliku migracje
# już poszły. `supabase/zapytania/stan-migracji.sql` odpowiada na to listą
# pisaną ręcznie — i dlatego zgnił (zna pliki do `125`, a jest ich 156).
#
# Tutaj wyprowadzamy to Z SAMYCH MIGRACJI: z każdego pliku wyciągamy tabele,
# które zakłada, i pytamy bazę, czy istnieją. Idziemy po kolei i zatrzymujemy
# się na pierwszym pliku, którego tabel BRAKUJE — bo migracje szły po kolei,
# więc szukamy końca ciągłego przedrostka, nie najwyższego trafienia.
#
# OGRANICZENIE, KTÓRE TRZEBA ZNAĆ: migracja, która nie zakłada żadnej tabeli
# (sama polityka, funkcja, kolumna), jest dla tej sondy NIEWIDOCZNA i zostaje
# pominięta w liczeniu. Wynik jest więc DOLNĄ GRANICĄ, a nie wyrokiem.
if [ "$DZIENNIK_PUSTY_NA_ZAJETEJ" -eq 1 ]; then
  echo "⚠ Baza ma schemat, a dziennik migracji jest pusty."
  echo "  Sprawdzam, dokąd migracje już doszły."
  echo ""

  # `|| true` przy grepie NIE jest ostrożnościowe: większość migracji nie
  # zakłada żadnej tabeli (sama polityka, funkcja, kolumna), grep zwraca wtedy
  # 1, a `set -o pipefail` wywraca na tym całą funkcję i skrypt.
  tabele_pliku() {
    sed 's/--.*//' "$1" \
      | { grep -oiE 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(public\.)?[a-z_][a-z0-9_]*' || true; } \
      | sed -E 's/.*[[:space:]]+(public\.)?([a-z_][a-z0-9_]*)$/\2/' \
      | sort -u
  }

  # TABELE SKASOWANE PRZEZ PÓŹNIEJSZE MIGRACJE TRZEBA ODJĄĆ. Bez tego sonda
  # na kompletnej bazie zatrzymywała się na `029_tournaments.sql`: zakłada ona
  # tabelę `tournaments`, którą `151` świadomie kasuje razem ze starym „BOJO
  # Cup". Ciąg urywał się na braku, który jest stanem docelowym, nie luką.
  # Ta sama reguła co w `scripts/check-docs.mjs` przy liczeniu tabel:
  # CREATE minus DROP.
  #
  # Tabela skasowana i założona ponownie wypada z liczenia w obie strony —
  # sonda ma wtedy mniej sygnału, ale nie może pokazać fałszywego trafienia.
  # Liczy się też ZMIANA NAZWY, nie tylko `DROP`: migracja `133` zakłada
  # `maile_goscia`, a `134` robi z niej `maile_wyslane`. Stara nazwa nie
  # istnieje na poprawnie zmigrowanej bazie i bez tego sonda urywała ciąg
  # dokładnie tam, uznając stan docelowy za lukę.
  SKASOWANE="$(for f in "$MIGRACJE"/*.sql; do
    BEZ_KOMENTARZY="$(sed 's/--.*//' "$f")"
    printf '%s\n' "$BEZ_KOMENTARZY" \
      | { grep -oiE 'DROP[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?(public\.)?[a-z_][a-z0-9_]*' || true; } \
      | sed -E 's/.*[[:space:]]+(public\.)?([a-z_][a-z0-9_]*)$/\2/'
    printf '%s\n' "$BEZ_KOMENTARZY" \
      | { grep -oiE 'ALTER[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?(public\.)?[a-z_][a-z0-9_]*[[:space:]]+RENAME[[:space:]]+TO' || true; } \
      | sed -E 's/^ALTER[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?(public\.)?([a-z_][a-z0-9_]*)[[:space:]]+RENAME.*$/\3/I'
  done | sort -u)"

  bez_skasowanych() {
    while IFS= read -r tab; do
      [ -n "$tab" ] || continue
      printf '%s\n' "$SKASOWANE" | grep -qxF "$tab" || printf '%s\n' "$tab"
    done
  }

  # Wszystkie tabele ze wszystkich migracji, odpytane JEDNYM zapytaniem.
  WSZYSTKIE_TABELE="$(for f in "$MIGRACJE"/*.sql; do tabele_pliku "$f"; done | sort -u | bez_skasowanych)"
  LISTA_SQL="$(printf '%s\n' "$WSZYSTKIE_TABELE" | { grep . || true; } | sed "s/.*/'&'/" | paste -sd, -)"
  ISTNIEJACE=""
  if [ -n "$LISTA_SQL" ]; then
    ISTNIEJACE="$(psql_cicho -c "SELECT t FROM unnest(ARRAY[$LISTA_SQL]) t WHERE to_regclass('public.' || t) IS NOT NULL")"
  fi

  OSTATNI_ZNANY=0
  OSTATNI_PLIK=""
  PIERWSZY_BRAK=""
  for f in "$MIGRACJE"/*.sql; do
    nazwa="$(basename "$f")"
    numer="$(numer_z_nazwy "$nazwa")"
    tabele="$(tabele_pliku "$f" | bez_skasowanych)"
    # Plik bez tabel nie niesie informacji — przechodzimy dalej, nie zrywając
    # ciągu (inaczej pierwsza migracja „tylko polityki" ucinałaby wynik).
    [ -n "$tabele" ] || continue
    brakuje=""
    while IFS= read -r tab; do
      [ -n "$tab" ] || continue
      printf '%s\n' "$ISTNIEJACE" | grep -qxF "$tab" || brakuje="$tab"
    done <<< "$tabele"
    if [ -n "$brakuje" ]; then
      PIERWSZY_BRAK="$nazwa (brak tabeli $brakuje)"
      break
    fi
    OSTATNI_ZNANY="$numer"
    OSTATNI_PLIK="$nazwa"
  done

  if [ "$OSTATNI_ZNANY" -eq 0 ]; then
    echo "  Nie rozpoznałem ANI JEDNEJ migracji po tabelach."
    echo "  To nie wygląda na bazę Bojo — sprawdź, czy sekret wskazuje właściwy projekt."
  else
    echo "  Ostatnia rozpoznana: $OSTATNI_PLIK"
    [ -n "$PIERWSZY_BRAK" ] && echo "  Pierwsza brakująca:  $PIERWSZY_BRAK"
    echo ""
    echo "  → Uruchom raz:  Actions → Migracje → oznacz_do = $OSTATNI_ZNANY"
    echo ""
    echo "  To DOLNA GRANICA: migracja bez własnej tabeli (sama polityka,"
    echo "  funkcja albo kolumna) jest dla tej sondy niewidoczna. Jeśli wiesz,"
    echo "  że poszło więcej, podaj wyższy numer."
  fi
  echo ""
  echo "Podgląd nie zmienił niczego w bazie."
  exit 0
fi

# ── Lista do zrobienia ──────────────────────────────────────────────────────
DO_ZROBIENIA=()
for plik in "$MIGRACJE"/*.sql; do
  nazwa="$(basename "$plik")"
  if ! printf '%s\n' "$ZASTOSOWANE" | grep -qxF "$nazwa"; then
    DO_ZROBIENIA+=("$nazwa")
  fi
done


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
