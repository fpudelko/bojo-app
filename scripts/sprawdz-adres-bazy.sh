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

# Koduje procentowo wszystko poza zbiorem „unreserved" z RFC 3986. Bajt po
# bajcie (LC_ALL=C), żeby hasło z ogonkiem nie rozsypało się na pół znaku.
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

case "$CZYSTY" in
  postgres://*|postgresql://*)
    # Rozcinamy po OSTATNIM '@', nie po pierwszym: hasło ze znakiem '@' jest
    # legalne, a wyrażenie regularne szukające pierwszego rozcięłoby adres
    # w środku hasła i zgłosiło nieprawdę o jego kształcie.
    BEZ_SCHEMATU="${CZYSTY#*://}"
    POSWIADCZENIA="${BEZ_SCHEMATU%@*}"
    RESZTA="${BEZ_SCHEMATU##*@}"
    HASLO="${POSWIADCZENIA#*:}"
    if [ "$POSWIADCZENIA" = "$BEZ_SCHEMATU" ] || [ "$HASLO" = "$POSWIADCZENIA" ] || [ -z "$HASLO" ]; then
      echo "::error::Nie umiem wyłuskać hasła z $NAZWA — spodziewany kształt to postgresql://uzytkownik:haslo@host:port/baza" >&2
      exit 1
    fi

    # Direct connection Supabase (`db.<ref>.supabase.co`) ma WYŁĄCZNIE rekord
    # AAAA, a runnery GitHuba nie mają IPv6 — psql mówi wtedy tylko „Network
    # is unreachable", co czyta się jak awaria Supabase albo zła zapora, i nie
    # naprowadza na nic. Rozpoznajemy to tutaj, zanim dojdzie do połączenia,
    # bo poprawka jest jednozdaniowa, a diagnoza z samego psql zajmuje wieczór.
    GOSPODARZ="${RESZTA%%[:/]*}"
    case "$GOSPODARZ" in
      db.*.supabase.co)
        REF="${GOSPODARZ#db.}"
        REF="${REF%%.*}"
        {
          echo "$NAZWA wskazuje na Direct connection ($GOSPODARZ), a ten adres ma w Supabase tylko IPv6."
          echo "Runnery GitHub Actions nie mają IPv6, więc połączenie nie ma jak dojść."
          echo "Weź adres Session pooler: Supabase → Connect → Session pooler. Różni się w DWÓCH miejscach:"
          echo "  host:        aws-0-<region>.pooler.supabase.com:5432"
          echo "  użytkownik:  postgres.$REF   (zamiast samego 'postgres')"
          echo "::error::$NAZWA to adres Direct connection (tylko IPv6). Podmień go na Session pooler — patrz $INSTRUKCJA"
        } >&2
        exit 1
        ;;
    esac

    # Powód, dla którego hasło musi być URI-bezpieczne, nie jest kosmetyczny:
    # przy `+`, `/` albo `=` psql nie rozpoznaje adresu jako URI, przechodzi na
    # parsowanie „klucz=wartość" i WYPISUJE FRAGMENT HASŁA w komunikacie błędu.
    # Maskowanie sekretów tego nie łapie, bo to część sekretu, nie całość —
    # hasło ląduje w publicznym logu. Zdarzyło się raz.
    #
    # ALE odpowiedzią na to nie jest odsyłanie człowieka po nowe hasło bazy.
    # Stało tu wcześniej „wygeneruj przez openssl rand -hex 32" i to był zły
    # ruch: hasło z wykrzyknikiem jest zupełnie poprawnym hasłem, wina leży
    # po stronie zapisu w adresie, nie po stronie hasła. Dlatego kodujemy je
    # procentowo sami i odtwarzamy adres — libpq rozkoduje to z powrotem,
    # a psql dostaje poprawne URI, czyli nigdy nie wchodzi w tryb, w którym
    # wypisuje fragment hasła.
    if ! printf '%s' "$HASLO" | grep -qE '^[A-Za-z0-9._~-]+$'; then
      # Placeholder nie jest hasłem i kodowanie go tylko zamieniłoby błąd
      # „nie mogę się zalogować" na coś jeszcze bardziej mylącego.
      case "$HASLO" in
        \[*\]|*YOUR-PASSWORD*|*your-password*|*TWOJE*|*HASLO*|*HASŁO*)
          echo "::error::W $NAZWA został placeholder hasła (coś w rodzaju [YOUR-PASSWORD]) zamiast prawdziwego hasła. Podmień sam ten fragment między ':' a '@' — reszta adresu jest poprawna. Instrukcja: $INSTRUKCJA" >&2
          exit 1
          ;;
      esac

      if printf '%s' "$HASLO" | grep -qE '^[A-Za-z0-9._~%-]+$' \
         && printf '%s' "$HASLO" | grep -qE '%[0-9A-Fa-f]{2}'; then
        # Hasło już zakodowane ręcznie. Zakodowanie go drugi raz zamieniłoby
        # '%21' na '%2521' i logowanie padłoby bez żadnej wskazówki dlaczego.
        echo "$NAZWA: hasło wygląda na już zakodowane procentowo, zostawiam jak jest." >&2
      else
        ZAKODOWANE="$(zakoduj "$HASLO")"
        echo "::add-mask::$ZAKODOWANE" >&2
        UZYTKOWNIK="${POSWIADCZENIA%%:*}"
        SCHEMAT="${CZYSTY%%://*}"
        CZYSTY="$SCHEMAT://$UZYTKOWNIK:$ZAKODOWANE@$RESZTA"
        echo "$NAZWA: hasło miało znaki spoza zbioru URI-bezpiecznego, zakodowałem je procentowo na potrzeby tego przebiegu (sekret zostaje bez zmian)." >&2
      fi
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
