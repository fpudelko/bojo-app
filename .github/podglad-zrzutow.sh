#!/usr/bin/env bash
# Wystawia raport ze zrzutami DO OBEJRZENIA — jedna strona na PR, na telefonie.
#
# PROBLEM, KTÓRY TO ROZWIĄZUJE: raport Playwrighta jest artefaktem, czyli
# zipem. Na telefonie to znaczy: pobierz, rozpakuj, otwórz plik HTML z dysku —
# w praktyce nie do zrobienia. A oglądanie obrazków jest całym sensem tego
# workflow.
#
# JAK: obrazki i `README.md` lecą na osobną gałąź `podglad-zrzutow` (techniczną,
# nigdzie nie mergowaną). GitHub renderuje README katalogu jako stronę — więc
# wchodzisz w jeden odnośnik i przewijasz obrazki. Bez pobierania, bez
# rozpakowywania, bez logowania się na komputer. Artefakt z raportem HTML
# zostaje jako droga zapasowa.
#
# SPRZĄTANIE: raporty starsze niż 7 dni znikają przy najbliższym przebiegu.
# Gałąź nie ma rosnąć w nieskończoność, a po tygodniu PR jest dawno zmergowany.
#
# Uruchamiany z katalogu `frontend`. Zapisuje `podglad-zrzutow.md` — krótki
# markdown z odnośnikiem do raportu, gotowy do wklejenia w komentarz PR-a.
#
# Argument: nazwa zestawu, używana jako nazwa katalogu i nagłówek.
set -euo pipefail

ZESTAW="${1:-zrzuty}"
PR="${PR:?brak numeru PR w zmiennej PR}"
GALAZ_PODGLADU="podglad-zrzutow"
DNI_WAZNOSCI=7
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

while IFS= read -r plik; do
  [[ -z "$plik" ]] && continue
  # e2e/wzorce/zrzuty-telefon/logowanie.png → nowy__zrzuty-telefon__logowanie.png
  # `sed`, nie `tr`: `tr` podmienia znak na znak, więc ukośnik zamieniłby się
  # w POJEDYNCZY podkreślnik — a podpis pod obrazkiem rozcina nazwę właśnie
  # po podwójnym.
  cp "$plik" "$ZBIOR/nowy__$(echo "${plik#e2e/wzorce/}" | sed 's#/#__#g')"
done <<< "$NOWE"

while IFS= read -r plik; do
  [[ -z "$plik" ]] && continue
  BAZA="${plik%-diff.png}"
  KLUCZ="$(basename "$BAZA")"
  for RODZAJ in expected actual diff; do
    [[ -f "${BAZA}-${RODZAJ}.png" ]] || continue
    cp "${BAZA}-${RODZAJ}.png" "$ZBIOR/roznica__${KLUCZ}__${RODZAJ}.png"
  done
done <<< "$ROZNICE"

# --- Osobny katalog roboczy -----------------------------------------------
# Bieżący ma wypożyczony kod PR-a i nie chcemy go tknąć.
ADRES="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
KOPIA="$TMP/repo"

if git clone --depth 1 --branch "$GALAZ_PODGLADU" "$ADRES" "$KOPIA" 2>/dev/null; then
  echo "Gałąź podglądu istnieje."
else
  mkdir -p "$KOPIA"
  git -C "$KOPIA" init -q
  git -C "$KOPIA" remote add origin "$ADRES"
  git -C "$KOPIA" checkout -q --orphan "$GALAZ_PODGLADU"
  cat > "$KOPIA/README.md" <<'EOF'
# Podgląd zrzutów

Gałąź techniczna — **nie mergować**. Leżą tu raporty z regresji wizualnej,
po jednym katalogu na pull request. Raporty starsze niż 7 dni kasuje sam
workflow przy najbliższym przebiegu.
EOF
fi

# --- Sprzątanie starych raportów ------------------------------------------
DZIS="$(date -u +%s)"
for STEMPEL in "$KOPIA"/pr-*/*/stempel.txt; do
  [[ -f "$STEMPEL" ]] || continue
  KIEDY="$(cat "$STEMPEL" 2>/dev/null || echo 0)"
  WIEK=$(( (DZIS - KIEDY) / 86400 ))
  if [[ "$WIEK" -gt "$DNI_WAZNOSCI" ]]; then
    echo "Kasuję raport starszy niż ${DNI_WAZNOSCI} dni: $(dirname "$STEMPEL")"
    rm -rf "$(dirname "$STEMPEL")"
  fi
done
# Katalogi PR-ów, z których nic nie zostało.
find "$KOPIA" -mindepth 1 -maxdepth 1 -type d -name 'pr-*' -empty -delete

KATALOG="pr-${PR}/${ZESTAW}"
rm -rf "${KOPIA:?}/$KATALOG"

if [[ -z "$(ls -A "$ZBIOR")" ]]; then
  # Nic się nie zmieniło — kasujemy poprzedni raport tego zestawu, żeby nie
  # wisiał nieaktualny, i kończymy.
  echo "Brak obrazków do pokazania."
else
  mkdir -p "$KOPIA/$KATALOG"
  cp "$ZBIOR"/* "$KOPIA/$KATALOG/"
  echo "$DZIS" > "$KOPIA/$KATALOG/stempel.txt"

  # --- Strona raportu ------------------------------------------------------
  LICZBA_NOWYCH="$(ls "$ZBIOR" | grep -c '^nowy__' || true)"
  LICZBA_ROZNIC="$(ls "$ZBIOR" | grep '^roznica__' | sed 's/__[a-z]*\.png$//' | sort -u | wc -l)"

  {
    echo "# Zrzuty — PR #${PR} · ${ZESTAW}"
    echo ""
    echo "Przebieg [\`${GITHUB_RUN_ID:-?}\`](https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID:-0})"
    echo " · [wróć do PR-a](https://github.com/${GITHUB_REPOSITORY}/pull/${PR})"
    echo ""
    echo "Zmienione widoki: **${LICZBA_ROZNIC}** · nowe widoki: **${LICZBA_NOWYCH}**"
    echo ""
    echo "Raport kasuje się sam po ${DNI_WAZNOSCI} dniach."
    echo ""

    if [[ "$LICZBA_ROZNIC" -gt 0 ]]; then
      echo "## Zmienione widoki"
      echo ""
      echo "Kolejno: **wzorzec** (jak było), **teraz** (jak jest), **różnica**"
      echo "(podświetlone piksele, które się ruszyły)."
      echo ""
      ls "$ZBIOR" | grep '^roznica__' | sed 's/^roznica__//; s/__[a-z]*\.png$//' | sort -u \
      | while IFS= read -r KLUCZ; do
          echo "### ${KLUCZ}"
          echo ""
          for RODZAJ in expected actual diff; do
            [[ -f "$ZBIOR/roznica__${KLUCZ}__${RODZAJ}.png" ]] || continue
            case "$RODZAJ" in
              expected) OPIS="wzorzec" ;;
              actual)   OPIS="teraz" ;;
              diff)     OPIS="różnica" ;;
            esac
            echo "**${OPIS}**"
            echo ""
            echo "![${OPIS}](roznica__${KLUCZ}__${RODZAJ}.png)"
            echo ""
          done
        done
    fi

    if [[ "$LICZBA_NOWYCH" -gt 0 ]]; then
      echo "## Nowe widoki"
      echo ""
      echo "Nie było ich wcześniej, więc nie ma z czym porównywać —"
      echo "to jest po prostu to, co widzi użytkownik."
      echo ""
      ls "$ZBIOR" | grep '^nowy__' | sort | while IFS= read -r PLIK; do
        PODPIS="$(echo "${PLIK#nowy__}" | sed 's/\.png$//; s/__/ · /g')"
        echo "### ${PODPIS}"
        echo ""
        echo "![${PODPIS}](${PLIK})"
        echo ""
      done
    fi
  } > "$KOPIA/$KATALOG/README.md"

  ADRES_RAPORTU="https://github.com/${GITHUB_REPOSITORY}/tree/${GALAZ_PODGLADU}/${KATALOG}"
  {
    echo ""
    echo "**[📖 Otwórz raport](${ADRES_RAPORTU})** — zmienione: ${LICZBA_ROZNIC}, nowe: ${LICZBA_NOWYCH}."
    echo ""
    echo "Jedna strona z obrazkami, otwiera się na telefonie."
  } > "$WYNIK"
fi

# --- Wypchnięcie ----------------------------------------------------------
git -C "$KOPIA" config user.name  "github-actions[bot]"
git -C "$KOPIA" config user.email "github-actions[bot]@users.noreply.github.com"
git -C "$KOPIA" add -A

if git -C "$KOPIA" diff --cached --quiet; then
  echo "Gałąź podglądu bez zmian."
  exit 0
fi

git -C "$KOPIA" commit -q -m "podgląd zrzutów: PR #${PR} (${ZESTAW})"

# Wyścig z drugim zadaniem tego samego przebiegu — ta sama historia, dwa pushe.
for PROBA in 1 2 3; do
  if git -C "$KOPIA" push -q origin "HEAD:$GALAZ_PODGLADU" 2>/dev/null; then
    echo "✓ Raport wystawiony."
    exit 0
  fi
  echo "Push podglądu odrzucony (próba $PROBA) — pobieram i próbuję ponownie."
  git -C "$KOPIA" pull -q --rebase origin "$GALAZ_PODGLADU" || true
done

echo "Nie udało się wypchnąć podglądu — raport został w artefakcie." >&2
exit 0
