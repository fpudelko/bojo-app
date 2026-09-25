#!/usr/bin/env bash
# Lokalny stos Supabase BEZ DOCKERA: Postgres + GoTrue + PostgREST + brama.
#
# PO CO. `scripts/stos-lokalny.sh` stawia pełny stos przez `supabase start`,
# czyli wymaga Dockera — a w środowiskach agenta i na części laptopów go nie
# ma. Bez stosu zostają `tsc`, Vitest i zrzuty na atrapach, które sprawdzają
# KOD, a nie ZACHOWANIE: nie zalogujesz się, nie zapiszesz na mecz, nie
# zobaczysz, co widzi gość z linku. Przejście całej ścieżki na takim stosie
# znalazło 2026-09-25 cztery rzeczy, których nie widział żaden test (W-1…W-4,
# docs/faza1-przejscie-e2e-plan.md).
#
# CZEGO TU NIE MA: Realtime, Storage (zdjęcia, awatary), funkcji brzegowych
# (mail, push) i logowania przez Google. Strony, które z nich korzystają,
# działają, ale bez tej jednej rzeczy. Do CI to NIE wchodzi — tam jest
# prawdziwy stos z `stos-lokalny.sh`.
#
#   ./scripts/stos-bez-dockera.sh            # postaw (pierwszy raz) albo podnieś
#   ./scripts/stos-bez-dockera.sh start --wszystkie-seedy
#                                            # dane do klikania ręką (patrz niżej)
#   ./scripts/stos-bez-dockera.sh stop       # zatrzymaj procesy, dane zostają
#   ./scripts/stos-bez-dockera.sh status     # co działa
#   ./scripts/stos-bez-dockera.sh od-nowa    # skasuj bazę i postaw od zera
#
# Potem, z katalogu `frontend`:
#   set -a; . <katalog stosu>/env; set +a
#   npm run build && npm run scenariusze     # albo: npm run start
#
# DANE. Domyślnie DOKŁADNIE te co w CI (`stos-lokalny.sh`): konta testowe
# i `seed_wizualne.sql`. Scenariusze liczą na tę bazę co do wiersza („bez grup
# — zachęta zamiast pustki", liczba próśb u organizatora, zawartość dzwonka),
# więc każdy dodatkowy seed wywraca kilkanaście z nich bez żadnej regresji
# w kodzie. `--wszystkie-seedy` dokłada seedy scenariuszowe z `baza-testowa.sh`
# (`[TEST]`, `[REG]`, `[DWA]`, `[PRZED]`, `[TUR]`…) do przejścia ręką; na takiej
# bazie `npm run scenariusze` NIE będzie zielone. Zmiana trybu = `od-nowa`.
#
# CZEGO SIĘ SPODZIEWAĆ PO `npm run scenariusze`. Sprawdzone 2026-09-25:
# wszystkie asercje ZACHOWANIA przechodzą, a `.github/bramka-scenariuszy.mjs`
# na raporcie JSON mówi „zachowanie bez regresji". Kilka zrzutów różni się od
# wzorców, bo przeglądarka bez internetu nie wczyta awatarów z randomuser.me,
# a maszyna bez fontów emoji rysuje ikony sportów inaczej. To wygląd, nie
# regresja — dokładnie tak, jak rozdziela to bramka. Wzorców z tego stosu
# NIE przyjmuj (`scenariusze:akceptuj`): wzorcem jest render z CI.
#
# Wymaga: Linux x86-64 (binarki GoTrue i PostgREST), PostgreSQL 14+ (initdb,
# pg_ctl, psql), Node, Python 3, curl, tar, xz, setsid.
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STOS="${BOJO_STOS:-${TMPDIR:-/tmp}/bojo-stos}"
DANE="$STOS/pgdata"
BINARKI="$STOS/bin"

# Porty jak w `supabase start`, więc adres i klucze z tego stosu pasują do tego
# samego builda co w CI (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).
PORT_PG=54322
PORT_GOTRUE=9999
PORT_POSTGREST=3001
PORT_BRAMY=54321
export PORT_GOTRUE PORT_POSTGREST PORT_BRAMY

# Ten sam sekret co domyślnie w `supabase start`. Stos jest wyłącznie lokalny
# (wszystko słucha na 127.0.0.1), a jawny sekret pozwala wygenerować klucze
# bez dodatkowych narzędzi.
JWT_SECRET='super-secret-jwt-token-with-at-least-32-characters-long'
HASLO_ROL='haslo-lokalne'

# Wersje PRZYPIĘTE razem z sumą kontrolną. Nowsza binarka to nowe migracje
# schematu `auth` i nowe zachowanie API — ma wchodzić świadomie, zmianą tutaj.
GOTRUE_WERSJA=v2.180.0
GOTRUE_URL="https://github.com/supabase/auth/releases/download/$GOTRUE_WERSJA/auth-$GOTRUE_WERSJA-x86.tar.gz"
GOTRUE_SHA256=3fe064281f5cf7bda94251a3bd9e87a690d081381d9ea93b1491163735209e2e
POSTGREST_WERSJA=v12.2.3
POSTGREST_URL="https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_WERSJA/postgrest-$POSTGREST_WERSJA-linux-static-x64.tar.xz"
POSTGREST_SHA256=9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c

BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
if [[ -z "$BIN" ]] && command -v pg_ctl >/dev/null 2>&1; then
  BIN="$(dirname "$(command -v pg_ctl)")"
fi

# Postgres odmawia startu jako root — wtedy przez systemowego `postgres`,
# tak jak w `baza-testowa.sh`.
JAKO=""
if [[ "$(id -u)" -eq 0 ]] && id postgres >/dev/null 2>&1; then
  JAKO="postgres"
fi
jako() { if [[ -n "$JAKO" ]]; then setpriv --reuid="$JAKO" --regid="$JAKO" --clear-groups "$@"; else "$@"; fi; }

export PGHOST=127.0.0.1 PGPORT=$PORT_PG PGUSER=postgres PGOPTIONS="-c client_min_messages=warning"

dziala() { [[ -f "$STOS/$1.pid" ]] && kill -0 "$(cat "$STOS/$1.pid")" 2>/dev/null; }

czekaj() { # czekaj <opis> <polecenie…>
  local opis="$1"; shift
  for _ in $(seq 60); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "✗ $opis nie wstał w 60 s. Log: $STOS/$opis.log" >&2
  tail -20 "$STOS/$opis.log" >&2 2>/dev/null || true
  exit 1
}

uruchom() { # uruchom <nazwa> <polecenie…> — w tle, odpięte od terminala
  local nazwa="$1"; shift
  dziala "$nazwa" && return 0
  setsid nohup "$@" >"$STOS/$nazwa.log" 2>&1 < /dev/null &
  echo $! > "$STOS/$nazwa.pid"
}

zatrzymaj() {
  for p in brama postgrest gotrue; do
    if dziala "$p"; then kill "$(cat "$STOS/$p.pid")" 2>/dev/null || true; fi
    rm -f "$STOS/$p.pid"
  done
  if [[ -f "$DANE/postmaster.pid" ]]; then
    jako "$BIN/pg_ctl" -D "$DANE" -m fast stop >/dev/null 2>&1 || true
  fi
}

pobierz() { # pobierz <url> <sha256> <plik>
  local url="$1" suma="$2" plik="$BINARKI/$(basename "$1")"
  [[ -f "$plik" ]] || curl -fsSL -o "$plik" "$url"
  if ! echo "$suma  $plik" | sha256sum -c --quiet - 2>/dev/null; then
    rm -f "$plik"
    echo "✗ Suma kontrolna się nie zgadza: $(basename "$url"). Plik usunięty." >&2
    exit 1
  fi
  echo "$plik"
}

binarki() {
  mkdir -p "$BINARKI"
  if [[ ! -x "$BINARKI/auth" ]]; then
    echo "→ Pobieram GoTrue $GOTRUE_WERSJA…"
    tar xzf "$(pobierz "$GOTRUE_URL" "$GOTRUE_SHA256")" -C "$BINARKI"
  fi
  if [[ ! -x "$BINARKI/postgrest" ]]; then
    echo "→ Pobieram PostgREST $POSTGREST_WERSJA…"
    tar xJf "$(pobierz "$POSTGREST_URL" "$POSTGREST_SHA256")" -C "$BINARKI"
  fi
}

# Klucze anon/service_role jako JWT podpisane tym samym sekretem, który znają
# GoTrue i PostgREST. Node jest i tak potrzebny do frontu.
klucz() {
  node -e '
    const c = require("crypto");
    const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const n = `${b({ alg: "HS256", typ: "JWT" })}.${b({ role: process.argv[2], iss: "supabase", iat: 1700000000, exp: 2100000000 })}`;
    console.log(`${n}.${c.createHmac("sha256", process.argv[1]).update(n).digest("base64url")}`);
  ' "$JWT_SECRET" "$1"
}

postgres_start() {
  if [[ ! -d "$DANE" ]]; then
    echo "→ Nowa baza w $DANE…"
    mkdir -p "$DANE"
    [[ -n "$JAKO" ]] && chown "$JAKO" "$DANE"
    # UTF-8 wprost, z tego samego powodu co w `baza-testowa.sh`.
    local lokalizacja=C.UTF-8
    locale -a 2>/dev/null | grep -qix "c.utf8\|c.utf-8" || lokalizacja=C
    jako "$BIN/initdb" -D "$DANE" -U postgres --auth=trust --encoding=UTF8 --locale="$lokalizacja" >/dev/null
  fi
  if ! jako "$BIN/pg_ctl" -D "$DANE" status >/dev/null 2>&1; then
    # Strefa bazy UTC jak na Supabase — funkcje liczące „dziś w Polsce” robią
    # to jawnie przez `AT TIME ZONE 'Europe/Warsaw'`.
    jako "$BIN/pg_ctl" -D "$DANE" -l "$DANE/log" -w start \
      -o "-p $PORT_PG -k $DANE -c listen_addresses=127.0.0.1 -c timezone=UTC" >/dev/null
  fi
}

gotrue_start() {
  uruchom gotrue env \
    GOTRUE_API_HOST=127.0.0.1 PORT=$PORT_GOTRUE \
    API_EXTERNAL_URL="http://127.0.0.1:$PORT_BRAMY/auth/v1" \
    GOTRUE_DB_DRIVER=postgres \
    DATABASE_URL="postgres://supabase_auth_admin:$HASLO_ROL@127.0.0.1:$PORT_PG/bojo?sslmode=disable&search_path=auth" \
    GOTRUE_DB_NAMESPACE=auth \
    GOTRUE_DB_MIGRATIONS_PATH="$BINARKI/migrations" \
    GOTRUE_SITE_URL=http://127.0.0.1:3100 \
    GOTRUE_URI_ALLOW_LIST='http://127.0.0.1:3100/**,http://localhost:3000/**,http://127.0.0.1:3000/**' \
    GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
    GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
    GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
    GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false \
    GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn \
    "$BINARKI/auth"
  czekaj gotrue curl -fs "http://127.0.0.1:$PORT_GOTRUE/health"
}

postgrest_start() {
  cat > "$STOS/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:$HASLO_ROL@127.0.0.1:$PORT_PG/bojo"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $PORT_POSTGREST
db-max-rows = 1000
CONF
  uruchom postgrest "$BINARKI/postgrest" "$STOS/postgrest.conf"
  czekaj postgrest curl -fs "http://127.0.0.1:$PORT_POSTGREST/"
}

sql() { psql -q -v ON_ERROR_STOP=1 -d bojo "$@"; }

sql_plik() { # sql_plik <plik> <opis> — przy błędzie wypisuje, KTÓRY plik
  if ! sql -f "$1" >/dev/null 2>"$STOS/blad"; then
    echo "✗ PADŁO: $2 ($(basename "$1"))" >&2
    sed 's/^/    /' "$STOS/blad" >&2
    exit 1
  fi
}

# Role, które w Supabase istnieją od początku. `supabase_auth_admin` zakłada
# schemat `auth` migracjami GoTrue, `authenticator` to login PostgREST-a, który
# przełącza się na `anon`/`authenticated` według tokenu.
role() {
  psql -q -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='bojo'" | grep -q 1 || createdb bojo
  sql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN SUPERUSER PASSWORD '$HASLO_ROL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '$HASLO_ROL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END \$\$;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
SQL
}

# Atrapy z `supabase/test/shim.sql` (pgcrypto, storage, domyślne uprawnienia)
# BEZ `auth.uid()`/`auth.role()`. Tu stoi prawdziwe GoTrue, a jego wersje
# czytają też `request.jwt.claims` — czyli to, co ustawia PostgREST 12.
# Wersja z atrapy czyta wyłącznie `request.jwt.claim.sub`, więc z nią każde
# zapytanie zalogowanego widziałoby `auth.uid() = NULL`, a RLS po cichu
# zwracałby puste listy.
atrapy() {
  python3 - "$KATALOG/supabase/test/shim.sql" > "$STOS/shim-stos.sql" <<'PY'
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
for f in ('uid', 'role'):
    t, n = re.subn(r"CREATE OR REPLACE FUNCTION auth\.%s\(\).*?\$\$;\n" % f, '', t, flags=re.S)
    if n != 1:
        sys.exit(f'shim.sql: nie znalazłem definicji auth.{f}() do pominięcia')
sys.stdout.write(t)
PY
  sql_plik "$STOS/shim-stos.sql" "atrapy Supabase"
}

# Migracje, których ta baza jeszcze nie widziała. Lista zastosowanych leży
# obok bazy, więc po `git pull` z nową migracją wystarczy puścić skrypt
# jeszcze raz — nie trzeba stawiać wszystkiego od zera.
migracje() {
  touch "$STOS/migracje.txt"
  local nowe=0
  for plik in "$KATALOG"/supabase/migrations/*.sql; do
    local nazwa; nazwa="$(basename "$plik")"
    grep -qxF "$nazwa" "$STOS/migracje.txt" && continue
    sql_plik "$plik" "migracja"
    echo "$nazwa" >> "$STOS/migracje.txt"
    nowe=$((nowe + 1))
  done
  echo "  migracji zastosowanych teraz: $nowe (razem $(wc -l < "$STOS/migracje.txt"))"
}

# Tryb `ci`: to samo co `stos-lokalny.sh`. Tryb `wszystkie`: do tego seedy
# scenariuszowe z `baza-testowa.sh`, a konta osobowe, których oczekują,
# dostają hasło `test1234` (tam wystarczał sam wiersz, tu trzeba się na nie
# zalogować).
dane() {
  echo "→ Konta testowe (hasło wszędzie: test1234)…"
  sql_plik "$KATALOG/supabase/seed-test-users.sql" "konta testowe"
  echo "→ Seed: seed_wizualne.sql"
  sql_plik "$KATALOG/supabase/seed_wizualne.sql" "seed"
  [[ "$TRYB" == wszystkie ]] || return 0
  sql <<'SQL'
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', extensions.gen_random_uuid(), 'authenticated', 'authenticated',
       k.email, extensions.crypt('test1234', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', k.imie),
       now(), now(), '', '', '', ''
  FROM (VALUES ('franekks@gmail.com', 'Franek P.'),
               ('franciszekpudelko@gmail.com', 'Franciszek P.'),
               ('j4n.brz0@gmail.com', 'Jan Brzos')) AS k(email, imie)
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = k.email);
SQL
  for seed in seed-orliki.sql seed-beach-volleyball.sql seed-rental-venues.sql \
              seed_test_data.sql seed_test_groups.sql seed_test_jan.sql \
              seed_regresja.sql seed_taktyka.sql seed_dwa_konta.sql \
              seed_przedpremiera.sql seed_turnieje.sql; do
    echo "→ Seed: $seed"
    sql_plik "$KATALOG/supabase/$seed" "seed"
  done
}

# BRAMKA, nie wydruk (ta sama lekcja co w `stos-lokalny.sh`): stos, który
# „wstał", ale nie oddaje danych albo nie loguje, wychodzi dopiero w padających
# scenariuszach kilka minut później, w miejscu, które o przyczynie nie mówi nic.
sprawdz() {
  local anon="$1" api="http://127.0.0.1:$PORT_BRAMY"
  local mecz token
  mecz="$(curl -s "$api/rest/v1/events?select=id&limit=1" -H "apikey: $anon")"
  if [[ "$mecz" != \[\{* ]]; then
    echo "✗ API nie oddało żadnego meczu anonimowi: $mecz" >&2; exit 1
  fi
  token="$(curl -s "$api/auth/v1/token?grant_type=password" -H "apikey: $anon" \
    -H 'content-type: application/json' -d '{"email":"test1@example.com","password":"test1234"}')"
  if [[ "$token" != *access_token* ]]; then
    echo "✗ Logowanie test1@example.com nie działa: ${token:0:200}" >&2; exit 1
  fi
}

POLECENIE="${1:-start}"
TRYB=ci
[[ "${2:-}" == --wszystkie-seedy ]] && TRYB=wszystkie
[[ "${2:-}" == "" || "$TRYB" == wszystkie ]] || { echo "Nieznana opcja: $2" >&2; exit 2; }

case "$POLECENIE" in
  stop)
    zatrzymaj; echo "Zatrzymane. Dane zostają w $DANE."; exit 0 ;;
  status)
    for p in gotrue postgrest brama; do
      if dziala "$p"; then echo "  $p: działa"; else echo "  $p: stoi"; fi
    done
    if [[ -n "$BIN" ]] && jako "$BIN/pg_ctl" -D "$DANE" status >/dev/null 2>&1; then
      echo "  postgres: działa"; else echo "  postgres: stoi"; fi
    exit 0 ;;
  od-nowa)
    zatrzymaj; rm -rf "$DANE" "$STOS/migracje.txt" "$STOS/.zasiane" ;;
  start) ;;
  *) echo "Użycie: $0 [start|od-nowa] [--wszystkie-seedy] | stop | status" >&2; exit 2 ;;
esac

if [[ -z "$BIN" ]]; then
  echo "✗ Brak serwera PostgreSQL (initdb/pg_ctl). Zainstaluj postgresql." >&2; exit 1
fi
for narzedzie in node curl python3 sha256sum; do
  command -v "$narzedzie" >/dev/null || { echo "✗ Brak: $narzedzie" >&2; exit 1; }
done

echo "Stos bez Dockera w $STOS"
echo "  Bez Realtime, Storage, funkcji brzegowych i logowania Google. Dane: $TRYB."
mkdir -p "$STOS"
chmod 755 "$STOS"

binarki
postgres_start
role
gotrue_start   # zakłada schemat `auth` własnymi migracjami, stąd przed resztą

if [[ ! -f "$STOS/.zasiane" ]]; then
  echo "→ Atrapy Supabase i migracje…"
  atrapy
  migracje
  dane
  echo "$TRYB" > "$STOS/.zasiane"
else
  if [[ "$(cat "$STOS/.zasiane")" != "$TRYB" ]]; then
    echo "✗ Baza jest zasiana w trybie „$(cat "$STOS/.zasiane")”, a prosisz o „$TRYB”." >&2
    echo "  Zmiana danych wymaga: $0 od-nowa${2:+ $2}" >&2
    exit 1
  fi
  echo "→ Baza już postawiona (dane: $TRYB), dokładam tylko nowe migracje…"
  migracje
fi

postgrest_start
uruchom brama node "$KATALOG/scripts/stos-bez-dockera-proxy.mjs"
czekaj brama curl -fs "http://127.0.0.1:$PORT_BRAMY/auth/v1/health"

ANON="$(klucz anon)"
SERVICE="$(klucz service_role)"
sprawdz "$ANON"

cat > "$STOS/env" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$PORT_BRAMY
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT_PG/bojo
ENV

cat <<KONIEC
✓ Stos gotowy: API http://127.0.0.1:$PORT_BRAMY, baza postgresql://postgres@127.0.0.1:$PORT_PG/bojo
  Konta: test1…test10@example.com, hasło test1234.

  cd frontend
  set -a; . $STOS/env; set +a
  npm run build && npm run scenariusze
KONIEC
