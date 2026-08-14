#!/usr/bin/env bash
# Odsyła wzorce zrzutów na gałąź PR-a. Uruchamiany z katalogu `frontend`.
#
# DWA TRYBY, bo to dwie zupełnie różne sytuacje:
#
# 1. Wzorzec NOWY (widok, którego wcześniej nie było). Nie ma go z czym
#    porównać, więc nie ma czego przeglądać — dopisujemy go bez pytania.
#    Bez tego każdy nowy zrzut wymagał osobnej rundy: przebieg zapisuje plik
#    do artefaktu, człowiek nakłada etykietę, przebieg leci drugi raz.
#
# 2. Wzorzec ZMIENIONY (widok wyglądał inaczej). To jest właśnie ta zmiana,
#    którą trzeba obejrzeć — nadpisujemy ją WYŁĄCZNIE po nadaniu etykiety
#    `zrzuty:zaakceptuj`, i tylko wtedy.
#
# Argument: dopełniacz do wiadomości commita („zrzutów", „scenariuszy").
set -euo pipefail

CO="${1:-zrzutów}"
AKCEPTUJ="${AKCEPTUJ:-0}"
GALAZ="${GALAZ:?brak nazwy gałęzi w GALAZ}"

NOWE="$(git ls-files --others --exclude-standard e2e/wzorce)"
ZMIENIONE="$(git diff --name-only -- e2e/wzorce)"

if [[ "$AKCEPTUJ" == "1" ]]; then
  if [[ -z "$NOWE$ZMIENIONE" ]]; then
    echo "Wzorce bez zmian — nie ma czego dopisywać."
    exit 0
  fi
  WIADOMOSC="test: zaakceptowane wzorce $CO"
else
  if [[ -z "$NOWE" ]]; then
    echo "Brak nowych wzorców. Zmienione zostawiam do przejrzenia."
    exit 0
  fi
  # Zmienione wzorce mają zostać nietknięte — inaczej ciche nadpisanie
  # zjadłoby dokładnie tę informację, po którą jest cały ten workflow.
  if [[ -n "$ZMIENIONE" ]]; then
    git checkout -- e2e/wzorce
  fi
  WIADOMOSC="test: wzorce dla nowych widoków ($CO)"
fi

git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add e2e/wzorce
git commit -m "$WIADOMOSC"

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
