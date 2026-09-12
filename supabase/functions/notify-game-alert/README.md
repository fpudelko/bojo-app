# Alert o grze w okolicy — jak to działa

Funkcja jest wołana z aplikacji (`lib/events.ts`, `fire-and-forget`) po
utworzeniu **publicznego** meczu i sprawdza, kto ma aktywny alert (`game_alerts`
— sport, promień, dni tygodnia) pasujący do tego meczu. Dopasowanym wpisuje
powiadomienie w aplikacji i, jeśli klucz Resend jest ustawiony, wysyła maila.

**Kanał jest dziś za flagą `SHOW_GAME_ALERTS = false`** — flaga chowa wejście
„Ustaw alert" w nawigacji (`frontend/src/lib/features.ts`), nie trasę ani ten
kanał. Alerty założone, zanim flagę wyłączono, dalej dostają maile.

## Z czego się składa

| Plik | Co w nim jest |
|---|---|
| `tresc.ts` | cała treść maila i oba renderery (HTML + tekst). Czysty TypeScript, bez `Deno` i bez sieci — testuje go Vitest (`frontend/src/__tests__/alertGry.test.ts`) |
| `index.ts` | zapytanie do bazy (dopasowanie alertów, dociągnięcie adresu z `fields`), wysyłka przez Resend |

Ten sam podział co w `powiadom-goscia` — z tego samego powodu: logikę bez
sieci da się przetestować bez uruchamiania Deno.

## Wymagane zmienne (Supabase → Edge Functions → Secrets)

Współdzielone z `powiadom-goscia` i `send-invites`:

- `RESEND_API_KEY` — bez niego funkcja wpisuje tylko powiadomienie w aplikacji, maila nie wysyła
- `BOJO_NADAWCA` — domyślnie `Bojo <noreply@bojo.pl>`
- `BOJO_ODPOWIEDZ_NA` — domyślnie `bojopolska@gmail.com`, adres w `reply_to`
- `SITE_URL` — domyślnie `https://bojo.pl`

## Wdrożenie

Zmiana w tym katalogu **nie wchodzi na produkcję przez merge**. Trzeba ją
wdrożyć osobno: Actions → „Wdróż funkcje brzegowe" → *Run workflow*, albo push
na gałąź `claude/funkcje/**` (ten drugi wyzwalacz istnieje dlatego, że token
agenta nie ma prawa odpalać `workflow_dispatch` przez API).
