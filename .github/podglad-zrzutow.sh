#!/usr/bin/env bash
# Wystawia zrzuty tak, żeby dało się je obejrzeć NA TELEFONIE, w wątku PR-a.
#
# PROBLEM, KTÓRY TO ROZWIĄZUJE: raport Playwrighta jest artefaktem, czyli
# zipem. Na telefonie to znaczy: pobierz, rozpakuj, otwórz plik HTML z dysku —
# w praktyce nie do zrobienia. A to właśnie oglądanie obrazków jest całym
# sensem tego workflow.
#
# JAK: obrazki lecą na osobną gałąź `podglad-zrzutow` (nigdzie nie mergowaną,
# poza historią kodu), a komentarz w PR-ze pokazuje je przez `raw.githubusercontent`.
# GitHub renderuje je wprost w wątku — także w aplikacji mobilnej.
#
# Uruchamiany z katalogu `frontend`. Wynik: `podglad-zrzutow.md` obok, gotowy
# do wklejenia w komentarz.
#
# Argument: nazwa zestawu do nagłówka („widoki publiczne", „scenariusze…").
set -euo pipefail

ZESTAW="${1:-zrzuty}"
PR="${PR:?brak numeru PR w zmiennej PR}"
GALAZ_PODGLADU="podglad-zrzutow"
KATALOG_W_REPO="pr-${PR}/${GITHUB_RUN_ID:-lokalnie}"
WYNIK="podglad-zrzutow.md"

: > "$WYNIK"

TMP="$(mktemp -d)"
ZBIOR="$TMP/pliki"
mkdir -p "$ZBIOR"

# Nowe wzorce — pliki, których nie ma jeszcze w repo. Nie mają „przed",
# więc pokazujemy sam obrazek.
NOWE="$(git ls-files --others --exclude-standard e2e/wzorce || true)"
# Zmienione — tu Playwright zostawia w `test-results` trójkę
# `-expected` / `-actual` / `-diff`.
ROZNICE="$(find test-results -name '*-diff.png' 2>/dev/null | sort || true)"

if [[ -z "$NOWE" && -z "$ROZNICE" ]]; then
  echo "Brak obrazków do pokazania."
  exit 0
fi

# --- Zebranie plików pod jednoznacznymi nazwami ---------------------------
while IFS= read -r plik; do
  [[ -z "$plik" ]] && continue
  # e2e/wzorce/zrzuty-telefon/logowanie.png → nowy__zrzuty-telefon__logowanie.png
  NAZWA="nowy__$(echo "${plik#e2e/wzorce/}" | tr '/' '__')"
  cp "$plik" "$ZBIOR/$NAZWA"
done <<< "$NOWE"

while IFS= read -r plik; do
  [[ -z "$plik" ]] && continue
  BAZA="${plik%-diff.png}"
  KLUCZ="$(basename "$BAZA")"
  for RODZAJ in expected actual diff; do
    ZRODLO="${BAZA}-${RODZAJ}.png"
    [[ -f "$ZRODLO" ]] || continue
    cp "$ZRODLO" "$ZBIOR/roznica__${KLUCZ}__${RODZAJ}.png"
  done
done <<< "$ROZNICE"

if [[ -z "$(ls -A "$ZBIOR")" ]]; then
  echo "Nic nie zebrano."
  exit 0
fi

# --- Wypchnięcie na gałąź podglądu ----------------------------------------
# Osobny katalog roboczy: bieżący ma wypożyczony kod PR-a i nie chcemy go tknąć.
ADRES="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
KOPIA="$TMP/repo"

if git clone --depth 1 --branch "$GALAZ_PODGLADU" "$ADRES" "$KOPIA" 2>/dev/null; then
  echo "Gałąź podglądu istnieje."
else
  mkdir -p "$KOPIA"
  git -C "$KOPIA" init -q
  git -C "$KOPIA" remote add origin "$ADRES"
  git -C "$KOPIA" checkout -q --orphan "$GALAZ_PODGLADU"
  echo "Podgląd zrzutów z PR-ów. Gałąź techniczna — nie mergować." \
    > "$KOPIA/README.md"
fi

mkdir -p "$KOPIA/$KATALOG_W_REPO"
cp "$ZBIOR"/* "$KOPIA/$KATALOG_W_REPO/"

git -C "$KOPIA" config user.name  "github-actions[bot]"
git -C "$KOPIA" config user.email "github-actions[bot]@users.noreply.github.com"
git -C "$KOPIA" add -A
git -C "$KOPIA" commit -q -m "podgląd zrzutów: PR #${PR} (${ZESTAW})"

# Wyścig z drugim zadaniem tego samego przebiegu — ta sama historia, dwa pushe.
for PROBA in 1 2 3; do
  if git -C "$KOPIA" push -q origin "HEAD:$GALAZ_PODGLADU" 2>/dev/null; then
    break
  fi
  echo "Push podglądu odrzucony (próba $PROBA) — pobieram i próbuję ponownie."
  git -C "$KOPIA" pull -q --rebase origin "$GALAZ_PODGLADU" || true
  [[ "$PROBA" == "3" ]] && { echo "Nie udało się wypchnąć podglądu." >&2; exit 0; }
done

# --- Markdown do komentarza ------------------------------------------------
BAZOWY="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GALAZ_PODGLADU}/${KATALOG_W_REPO}"

{
  LICZBA_NOWYCH="$(ls "$ZBIOR" | grep -c '^nowy__' || true)"
  LICZBA_ROZNIC="$(ls "$ZBIOR" | grep '^roznica__' | sed 's/__[a-z]*\.png$//' | sort -u | wc -l)"

  if [[ "$LICZBA_ROZNIC" -gt 0 ]]; then
    echo ""
    echo "<details open><summary><b>Zmienione widoki (${LICZBA_ROZNIC})</b> — wzorzec / teraz / różnica</summary>"
    echo ""
    ls "$ZBIOR" | grep '^roznica__' | sed 's/^roznica__//; s/__[a-z]*\.png$//' | sort -u \
    | while IFS= read -r KLUCZ; do
        echo "**${KLUCZ}**"
        echo ""
        for RODZAJ in expected actual diff; do
          [[ -f "$ZBIOR/roznica__${KLUCZ}__${RODZAJ}.png" ]] || continue
          case "$RODZAJ" in
            expected) OPIS="wzorzec" ;;
            actual)   OPIS="teraz" ;;
            diff)     OPIS="co się zmieniło" ;;
          esac
          echo "<img src=\"${BAZOWY}/roznica__${KLUCZ}__${RODZAJ}.png\" width=\"260\" alt=\"${OPIS}\"> "
        done
        echo ""
        echo "_wzorzec · teraz · co się zmieniło_"
        echo ""
      done
    echo "</details>"
  fi

  if [[ "$LICZBA_NOWYCH" -gt 0 ]]; then
    echo ""
    echo "<details open><summary><b>Nowe widoki (${LICZBA_NOWYCH})</b> — nie było ich wcześniej</summary>"
    echo ""
    ls "$ZBIOR" | grep '^nowy__' | sort | while IFS= read -r PLIK; do
      PODPIS="$(echo "${PLIK#nowy__}" | sed 's/\.png$//; s/__/ · /g')"
      echo "**${PODPIS}**"
      echo ""
      echo "<img src=\"${BAZOWY}/${PLIK}\" width=\"260\" alt=\"${PODPIS}\">"
      echo ""
    done
    echo "</details>"
  fi
} >> "$WYNIK"

echo "✓ Podgląd gotowy: $(wc -l < "$WYNIK") linii markdownu, $(ls "$ZBIOR" | wc -l) obrazków."
