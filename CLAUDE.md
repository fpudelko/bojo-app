# Bojo — Claude Code

Zasady pracy, komendy, pułapki i mapa dokumentacji — wszystko w jednym, wspólnym pliku:

@AGENTS.md

## Specyfika Claude Code: hook doc-guard

`.claude/hooks/doc-guard.sh`, konfiguracja w `.claude/settings.json`. Dwa zdarzenia:

- **`SessionStart`** — wstrzykuje przypomnienie, gdzie leży dokumentacja
- **`PostToolUse`** (`Edit|Write|NotebookEdit`) — po zmianie kodu bez tknięcia
  dokumentacji podpowiada **konkretny plik** do aktualizacji

**Hook nie blokuje.** Odzywa się raz na sesję dla danej kategorii zmian i milknie po
edycji czegokolwiek w `docs/`. Stan w `${TMPDIR:-/tmp}/bojo-doc-guard/<session_id>` —
poza repo. Jeśli hook nie reaguje po świeżym sklonowaniu: `.claude/settings.json`
ładuje się przy starcie sesji — otwórz `/hooks` albo zrestartuj sesję.
