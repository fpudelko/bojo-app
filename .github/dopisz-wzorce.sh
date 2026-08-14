#!/usr/bin/env bash
# Odsyła wzorce zrzutów na gałąź PR-a. Uruchamiany z katalogu `frontend`.
#
# JEDNA ZASADA: nic nie trafia do repo bez świadomego zatwierdzenia —
# komentarza `/zrzuty ok` w PR-ze albo etykiety `zrzuty:zaakceptuj`.
#
# Dotyczy to tak samo widoków ZMIENIONYCH, jak i CAŁKIEM NOWYCH. Przez chwilę
# nowe wzorce dopisywały się same — z rozumowaniem „nowy zrzut nie ma z czym
# się różnić, więc nie ma czego przeglądać". To rozumowanie jest błędne:
# pierwszy zrzut widoku jest właśnie tym, który warto obejrzeć, bo to on
# staje się wzorcem na zawsze. Jeśli nowy ekran wyszedł krzywo, ciche
# dopisanie utrwala krzywy stan i nikt się o tym nie dowie.
#
# Zrzuty nowych widoków oglądasz w artefakcie (`zrzuty-raport` /
# `scenariusze-raport`), zanim nadasz etykietę.
#
# Argument: dopełniacz do wiadomości commita („zrzutów", „scenariuszy").
set -euo pipefail

CO="${1:-zrzutów}"
AKCEPTUJ="${AKCEPTUJ:-0}"
GALAZ="${GALAZ:?brak nazwy gałęzi w GALAZ}"

NOWE="$(git ls-files --others --exclude-standard e2e/wzorce)"
ZMIENIONE="$(git diff --name-only -- e2e/wzorce)"

if [[ "$AKCEPTUJ" != "1" ]]; then
  if [[ -n "$NOWE$ZMIENIONE" ]]; then
    echo "Są wzorce do zatwierdzenia, ale nikt ich jeszcze nie zatwierdził."
    echo "Nowe:      $(echo "$NOWE" | grep -c . || true)"
    echo "Zmienione: $(echo "$ZMIENIONE" | grep -c . || true)"
    echo "Obejrzyj obrazki w komentarzu do PR-a i odpisz /zrzuty ok, jeśli są w porządku."
  else
    echo "Wzorce bez zmian."
  fi
  exit 0
fi

if [[ -z "$NOWE$ZMIENIONE" ]]; then
  echo "Wzorce bez zmian — nie ma czego dopisywać."
  exit 0
fi

git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add e2e/wzorce
git commit -m "test: zaakceptowane wzorce $CO"

# Oba zadania tego workflow potrafią dopisywać wzorce równocześnie, więc
# odrzucony push nie jest błędem, tylko wyścigiem — po prostu próbujemy jeszcze
# raz na świeżej gałęzi.
for PROBA in 1 2 3; do
  if git push origin "HEAD:$GALAZ"; then
    echo "✓ Wzorce dopisane do $GALAZ"
    exit 0
  fi
  echo "Push odrzucony (próba $PROBA) — pobieram gałąź i próbuję ponownie."
  git pull --rebase origin "$GALAZ"
done

echo "✗ Nie udało się dopisać wzorców po trzech próbach." >&2
exit 1
