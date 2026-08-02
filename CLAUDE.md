# Bojo — kontekst dla Claude Code

**Zasady pracy w tym repo: [AGENTS.md](./AGENTS.md).** Ten plik zawiera wyłącznie rzeczy
specyficzne dla Claude Code — reszta jest tam, żeby jedna treść nie żyła w dwóch miejscach
i się nie rozjechała.

## Gdzie szukać kontekstu

| Pytanie | Plik |
|---|---|
| Jak tu pracować: komendy, konwencje, pułapki | [AGENTS.md](./AGENTS.md) |
| Wiedza o projekcie: wizja, funkcje, domena, baza | [docs/README.md](./docs/README.md) |

Zanim uznasz, że funkcja nie istnieje — sprawdź
[tabelę flag](./docs/funkcje.md#flagi-funkcji). Pięć funkcji jest zbudowanych, ale ukrytych.

## Hook doc-guard

`.claude/hooks/doc-guard.sh`, konfiguracja w `.claude/settings.json`. Dwa zdarzenia:

- **`SessionStart`** — wstrzykuje przypomnienie, gdzie leży dokumentacja
- **`PostToolUse`** (`Edit|Write|NotebookEdit`) — po zmianie kodu bez tknięcia
  dokumentacji podpowiada **konkretny plik** do aktualizacji

**Hook nie blokuje.** To przypomnienie, nie bramka — odzywa się raz na sesję dla danej
kategorii zmian i milknie po edycji czegokolwiek w `docs/`. Odpowiedzialność za
aktualizację zostaje po stronie piszącego.

Stan trzymany w `${TMPDIR:-/tmp}/bojo-doc-guard/<session_id>` — poza repo.

Jeśli hook nie reaguje po świeżym sklonowaniu repo: `.claude/settings.json` ładuje się
przy starcie sesji, więc potrzebne jest otwarcie `/hooks` albo restart.

## Weryfikacja przed commitem

```bash
cd frontend
npx tsc --noEmit       # musi być czysto
npm test               # Vitest, 38 testów
```

`npm run lint` nie działa bez interaktywnej konfiguracji ESLint — pomijaj.
