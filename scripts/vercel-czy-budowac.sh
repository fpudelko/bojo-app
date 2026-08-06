#!/usr/bin/env bash
# Vercel: „Ignored Build Step". Kod wyjścia 0 = POMIŃ build, 1 = buduj.
#
# Po co: gałęzie `claude/sql/**` niosą wyłącznie zapytanie diagnostyczne do bazy
# (`supabase/zapytania/biezace.sql`). Kod aplikacji jest na nich identyczny jak
# na masterze, więc preview build to kilka minut liczenia za jednego SELECT-a —
# a przy okazji zasypuje właściciela powiadomieniami o wyniku builda.
#
# Wpis `git.deploymentEnabled` w vercel.json miał to załatwić, ale dopasowanie
# wzorca ze slashami bywa zawodne. Ten skrypt sprawdza nazwę gałęzi wprost.

set -u

GALAZ="${VERCEL_GIT_COMMIT_REF:-}"

case "$GALAZ" in
  claude/sql/*)
    echo "Gałąź $GALAZ to zapytanie do bazy, nie zmiana w aplikacji — pomijam build."
    exit 0
    ;;
esac

echo "Gałąź ${GALAZ:-(nieznana)} — buduję."
exit 1
