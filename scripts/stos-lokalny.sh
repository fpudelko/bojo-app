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

# Migracje aplikuje SAMO `supabase start` — CLI czyta `supabase/migrations`
# i puszcza pliki w kolejności nazw, czyli dokładnie tak, jak my w SQL Editorze
# (numery porządkowe `001_…`, `078_…` sortują się poprawnie).
#
# Pierwsza wersja tego skryptu aplikowała je jeszcze raz przez psql i wywracała
# się na `007`, która tworzy politykę bez `DROP … IF EXISTS`. To nie był błąd
# migracji, tylko podwójne wykonanie — ale pokazał realną kruchość: te pliki
# nie są odporne na powtórzenie.
echo "→ Sprawdzam, czy migracje weszły…"
CZY_JEST="$(psql "$DB_URL" -tAc "SELECT to_regprocedure('public.czy_na_rezerwe(uuid,boolean)') IS NOT NULL")"
if [[ "$CZY_JEST" != "t" ]]; then
  echo "✗ Migracje nie zostały zastosowane przez supabase start." >&2
  echo "  Brakuje funkcji czy_na_rezerwe() z migracji 078." >&2
  exit 1
fi
echo "  OK — schemat aktualny"

# GRANT-y dla ról API. Bez tego PostgREST odpowiada 401 z kodem 42501
# („permission denied for table events") jeszcze ZANIM dojdzie do RLS — i to
# właśnie zatrzymywało wszystkie scenariusze za logowaniem: aplikacja widziała
# każdy mecz jako „Nie znaleziono wydarzenia".
#
# Skąd to się bierze: `ALTER DEFAULT PRIVILEGES` Supabase jest zapisane DLA
# konkretnej roli, a domyślne uprawnienia działają wyłącznie na obiekty
# stworzone przez tę rolę. Migracje CLI puszcza inną rolą, więc tabele
# powstają bez grantów. Na produkcji problemu nie ma — tam schemat rósł
# w SQL Editorze. RLS zostaje nietknięty, to jest warstwa niżej.
echo "→ Uprawnienia ról API do schematu public…"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES     IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS  IN SCHEMA public TO anon, authenticated, service_role;
SQL

echo "→ Konta testowe…"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed-test-users.sql

echo "→ Dane do zrzutów (daty na sztywno)…"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed_wizualne.sql

# Diagnostyka. Poprzedni przebieg padał na „nie ma przycisku Dołącz" i nie
# dawało się odróżnić dwóch zupełnie innych przyczyn: brak danych w bazie
# kontra aplikacja, która ich nie widzi. Te trzy liczby rozstrzygają to
# w logu, bez zgadywania.
echo "→ Co jest w bazie:"
psql "$DB_URL" -c "SELECT
  (SELECT count(*) FROM auth.users)                        AS konta,
  (SELECT count(*) FROM events WHERE description LIKE '[WIZ]%') AS mecze_wiz,
  (SELECT count(*) FROM event_participants)                AS uczestnicy;"

# Czy PostgREST oddaje mecz anonimowi (czyli czy RLS przepuszcza odczyt).
# To jest BRAMKA, nie wydruk: dopóki było tu samo `curl | head`, stos wstawał
# „poprawnie", a o tym, że API nie oddaje niczego, dowiadywaliśmy się dopiero
# z padających zrzutów — cztery minuty i jeden przebieg CI później.
echo "→ Czy API oddaje mecz publiczny:"
ODPOWIEDZ="$(curl -s "$API_URL/rest/v1/events?id=eq.11111111-1111-4111-8111-111111111111&select=id,title" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON")"
echo "$ODPOWIEDZ" | head -c 300
echo
if [[ "$ODPOWIEDZ" != \[\{* ]]; then
  echo "✗ API nie oddało meczu — scenariusze i tak by padły." >&2
  echo "  Pusta tablica: brak danych z seed_wizualne.sql." >&2
  echo "  Błąd 42501: brak GRANT-ów dla ról anon/authenticated." >&2
  exit 1
fi

# Zmienne dla builda i testów.
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON"
} >> "${GITHUB_ENV:-/dev/stdout}"

echo "✓ Stos gotowy: $API_URL"
