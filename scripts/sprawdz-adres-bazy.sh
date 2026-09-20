#!/usr/bin/env bash
# Sprawdza, czy zmienna `DB_URL` wygląda na connection string, i MASKUJE hasło
# w logu GitHub Actions.
#
# PO CO OSOBNY PLIK: ta sama kontrola jest potrzebna w każdym workflowie, który
# dotyka bazy (`sql.yml`, `migracje.yml`). Skopiowana dwa razy rozjedzie się
# przy pierwszej poprawce — a akurat tutaj rozjazd znaczy „hasło w publicznym
# logu", bo dokładnie to się już raz zdarzyło (patrz niżej).
#
# Wypisuje oczyszczony adres na standardowe wyjście. Użycie:
#   ADRES="$(DB_URL="$SEKRET" ./scripts/sprawdz-adres-bazy.sh NAZWA_SEKRETU)"
set -euo pipefail

NAZWA="${1:-SUPABASE_DB_URL}"
# Odsyłacz zależy od tego, czyj to sekret: instrukcja dla roli tylko do odczytu
# leży gdzie indziej niż dla migracji, a wysyłanie człowieka pod zły plik jest
# gorsze niż brak odsyłacza.
case "$NAZWA" in
  *_RO) INSTRUKCJA="supabase/zapytania/README.md" ;;
  *)    INSTRUKCJA="supabase/migrations/README.md" ;;
esac

if [ -z "${DB_URL:-}" ]; then
  echo "::error::Brak sekretu $NAZWA. Instrukcja: $INSTRUKCJA" >&2
  exit 1
fi

# Obcinamy TYLKO początek i koniec. `tr -d` zjadłoby spacje rozdzielające pary
# w formacie klucz=wartość i rozwaliło adres.
CZYSTY=$(printf '%s' "$DB_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

case "$CZYSTY" in
  postgres://*|postgresql://*)
    HASLO=$(printf '%s' "$CZYSTY" | sed -E 's|^postgres(ql)?://[^:@/]+:([^@]*)@.*$|\2|')
    if [ "$HASLO" = "$CZYSTY" ] || [ -z "$HASLO" ]; then
      echo "::error::Nie umiem wyłuskać hasła z $NAZWA — spodziewany kształt to postgresql://uzytkownik:haslo@host:port/baza" >&2
      exit 1
    fi
    # Powód, dla którego hasło musi być URI-bezpieczne, nie jest kosmetyczny:
    # przy `+`, `/` albo `=` psql nie rozpoznaje adresu jako URI, przechodzi na
    # parsowanie „klucz=wartość" i WYPISUJE FRAGMENT HASŁA w komunikacie błędu.
    # Maskowanie sekretów tego nie łapie, bo to część sekretu, nie całość —
    # hasło ląduje w publicznym logu. Zdarzyło się raz.
    if ! printf '%s' "$HASLO" | grep -qE '^[A-Za-z0-9._~-]+$'; then
      echo "::error::Hasło w $NAZWA ma znaki wymagające kodowania URL (+ / = : @ itp). Wygeneruj je przez 'openssl rand -hex 32' i zaktualizuj sekret — patrz $INSTRUKCJA" >&2
      exit 1
    fi
    ;;
  *host=*)
    # Format klucz=wartość — psql bierze go dosłownie, bez parsowania URI,
    # więc problem znaków specjalnych w haśle go nie dotyczy.
    HASLO=$(printf '%s' "$CZYSTY" | sed -nE 's|.*password=([^ ]*).*|\1|p')
    ;;
  *)
    # Opis KSZTAŁTU sekretu, nigdy jego treści. Bez tego jedyną informacją jest
    # „nie pasuje", co nie mówi, czy w sekrecie jest samo hasło, adres
    # z prefiksem `psql `, czy coś zupełnie innego.
    {
      echo "Sekret $NAZWA nie pasuje do żadnego znanego formatu. Jego kształt:"
      echo "  długość znaków:          $(printf '%s' "$CZYSTY" | wc -c)"
      echo "  zaczyna się od postgres: $(case "$CZYSTY" in postgres*) echo tak;; *) echo NIE;; esac)"
      echo "  zawiera '://':           $(case "$CZYSTY" in *://*) echo tak;; *) echo NIE;; esac)"
      echo "  zawiera '@':             $(case "$CZYSTY" in *@*) echo tak;; *) echo NIE;; esac)"
      echo "  zawiera 'host=':         $(case "$CZYSTY" in *host=*) echo tak;; *) echo NIE;; esac)"
      echo "  zawiera spację:          $(case "$CZYSTY" in *\ *) echo tak;; *) echo NIE;; esac)"
      echo "  zawiera 'supabase':      $(case "$CZYSTY" in *supabase*) echo tak;; *) echo NIE;; esac)"
      echo "::error::$NAZWA nie jest rozpoznanym connection stringiem — patrz kształt wyżej. W Supabase: Connect → Session pooler → skopiuj CAŁY adres (od postgresql:// do /postgres) i podmień użytkownika oraz hasło."
    } >&2
    exit 1
    ;;
esac

# Maskowanie samego hasła, niezależnie od maskowania całego sekretu. Gdyby
# jakiekolwiek narzędzie wypisało je w błędzie, GitHub zamieni je na ***.
if [ -n "${HASLO:-}" ]; then echo "::add-mask::$HASLO" >&2; fi

printf '%s' "$CZYSTY"
