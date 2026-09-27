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

## Skille Search Console (`.claude/skills/gsc*`)

Cztery skille do pracy z Google Search Console bojo.pl. Wejście zawsze przez `gsc`:
rozpoznaje mail, zrzut albo eksport i kieruje dalej do `gsc-dane-strukturalne`
(Ulepszenia, JSON-LD), `gsc-indeksowanie` (Strony, sitemapy, inspekcja) albo
`gsc-skutecznosc` (kliknięcia, CTR, AI Overviews, eksperymenty na szablonach).

- **Pamięć między sesjami:** [docs/gsc-dziennik.md](./docs/gsc-dziennik.md): linie
  bazowe, zmiany pod Google, terminy odczytów. Skill czyta go na starcie i dopisuje wynik.
- **Skrypty** bez zależności (Node ≥ 18), np.
  `node .claude/skills/gsc/scripts/gsc-eksport.mjs <eksport.zip>`. Testy:
  `node --test $(find .claude/skills -name '*.test.mjs')`, uruchamiane też w CI.
- **Dane z API GSC** wymagają klucza konta serwisowego w zmiennej środowiskowej
  `GSC_KLUCZ_JSON`. Konfiguracja: `.claude/skills/gsc/references/dane-i-dostep.md`.
  Nigdy w repo ani w czacie.
- **Ścieżki cytowane w skillach sprawdza `npm run check:docs`** (sekcja 12). Przenosisz
  plik opisany w skillu → popraw skill w tym samym PR.
