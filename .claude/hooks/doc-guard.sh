#!/usr/bin/env bash
# doc-guard — pilnuje, żeby dokumentacja w docs/ nie rozjechała się z kodem.
#
#   start  (SessionStart) — mówi, gdzie leży dokumentacja
#   record (PostToolUse)  — po zmianie kodu wskazuje KONKRETNY plik do aktualizacji
#
# To jest PRZYPOMNIENIE, nie bramka. Hook nigdy nie blokuje — kończy się exit 0
# w każdej ścieżce, a jego wyjście to tylko kontekst dla modelu. Odpowiedzialność
# za aktualizację zostaje po stronie piszącego.
#
# Żeby nie hałasować: dla danej kategorii zmian odzywa się raz na sesję, a edycja
# czegokolwiek w docs/ wycisza wszystkie kategorie do końca sesji.
set -uo pipefail

MODE="${1:-record}"
payload="$(cat 2>/dev/null || true)"

sid="$(printf '%s' "$payload" | jq -r '.session_id // "nosession"' 2>/dev/null || echo nosession)"
state="${TMPDIR:-/tmp}/bojo-doc-guard/${sid}"
mkdir -p "$state" 2>/dev/null || exit 0

case "$MODE" in
  start)
    jq -nc '{hookSpecificOutput:{hookEventName:"SessionStart",
      additionalContext:"Dokumentacja projektu leży w docs/ (indeks: docs/README.md), zasady pracy w AGENTS.md. Zmiana kodu pociąga za sobą aktualizację odpowiedniego pliku w docs/ — mapowanie w AGENTS.md, sekcja \"Aktualizacja dokumentacji\". Walidator spójności: npm run check:docs. docs/wizja.md jest dokumentem nadrzędnym: jego sekcji 1 nie parafrazować."}}' 2>/dev/null
    ;;

  record)
    f="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // ""' 2>/dev/null)"
    [ -n "$f" ] || exit 0

    # Edycja dokumentacji wycisza hook do końca sesji.
    case "$f" in
      */docs/*|*/frontend/public/llms.txt|*/AGENTS.md)
        : > "$state/docs"
        exit 0 ;;
    esac
    [ -e "$state/docs" ] && exit 0

    # Klasyfikacja zmienionego pliku → kategoria + sugerowany plik dokumentacji.
    # Flagi sprawdzane przed ogólnym lib/, bo mają węższe i ważniejsze mapowanie.
    case "$f" in
      */frontend/src/lib/features.ts|*/frontend/src/config/features.ts)
        kat="flagi"
        cel="docs/funkcje.md (sekcja \"Flagi funkcji\") — tabela flag jest jedynym miejscem poza kodem, gdzie widać, co jest ukryte" ;;
      */supabase/migrations/*)
        kat="migracje"
        cel="docs/baza-danych.md — mapa tabela → migracja" ;;
      */frontend/src/lib/*)
        kat="lib"
        cel="docs/domena.md (jeśli zmieniły się reguły domenowe) lub docs/funkcje.md (jeśli doszła/zniknęła funkcja)" ;;
      */frontend/src/app/*)
        kat="trasy"
        cel="docs/funkcje.md — a jeśli doszła lub zniknęła trasa użytkownika, także frontend/public/llms.txt" ;;
      *)
        exit 0 ;;
    esac

    # Raz na sesję dla danej kategorii.
    [ -e "$state/seen-$kat" ] && exit 0
    : > "$state/seen-$kat"

    jq -nc --arg plik "${f##*/bojo-app/}" --arg cel "$cel" \
      '{hookSpecificOutput:{hookEventName:"PostToolUse",
        additionalContext:("Zmieniłeś " + $plik + ". Przed końcem zadania sprawdź: " + $cel + ". Po zmianach uruchom: npm run check:docs. (Przypomnienie doc-guard — nie blokuje.)")}}' 2>/dev/null
    ;;
esac

exit 0
