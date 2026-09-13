// ---------------------------------------------------------------------------
// Feature flags — single source of truth for functionality that is built but
// intentionally hidden from users for now. Flip to `true` to bring a feature
// back. See /BACKLOG.md for the why behind each one.
// ---------------------------------------------------------------------------

/** BOJO Cup / tournament promo (AnnouncementBar, TrustBar, Header link). */
export const SHOW_CUP = false;

/**
 * Game alerts — "Powiadom mnie, gdy się pojawi": a saved sport + place + radius
 * (`game_alerts`, migration `025`), matched on every new event by the
 * `notify-game-alert` edge function. Code: lib/alerts.ts + AlertSetupDialog.
 *
 * WŁĄCZONA 2026-09-12. Była wyłączona, bo „nie ma czym dostarczyć" — ten powód
 * zniknął: mail (Resend) i web-push działają na produkcji, a funkcja
 * `notify-game-alert` jest wołana przy każdym nowym meczu (`lib/events.ts`).
 * Zostawała wyłączona wyłącznie siłą rozpędu; BACKLOG §2 opisywał ją jako
 * „powód nieaktualny, do ponownej decyzji" — to jest ta decyzja.
 *
 * Wejście jest dziś jedno: pusta lista na `/wydarzenia`, czyli moment,
 * w którym człowiek właśnie powiedział filtrami, czego szuka, i usłyszał
 * „nie ma".
 */
export const SHOW_GAME_ALERTS = true;

/**
 * SMS-based features — "Potwierdzenie SMS" on events and scheduled SMS/email
 * reminders. Hidden until an SMS gateway is wired up. Code: RemindersSection,
 * lib/reminders.ts, sendConfirmationSms in lib/eventFeatures.ts.
 */
export const SHOW_SMS_FEATURES = false;

/**
 * Recurring games ("Stałe gierki") — fixed weekly pickup games with a saved
 * roster. Code lives in /app/cykliczne/* and lib/recurring.ts.
 *
 * Enabled with migration `073`: until then a "series" was a template nothing
 * ever spawned from, `events.recurring_event_id` did not exist, and a paid game
 * respawned as free — so hiding it was the honest call. Now the next date is
 * created automatically, inherits the previous one's settings, and edits can
 * span the series.
 *
 * Wyłączona ponownie 2026-08-16 — produktowa decyzja o rezygnacji z gier
 * cyklicznych/stałych gierek. Flaga chowa wejścia w nawigacji i przełącznik
 * „Wydarzenie cykliczne" w kreatorze (`/wydarzenia/nowe`); istniejące serie
 * i ich strony zarządzania zostają w kodzie nietknięte.
 */
export const SHOW_RECURRING = false;

/**
 * Próg „gra się odbędzie" (`events.min_players`, migracja `097`) — toggle
 * „+ Ustaw minimum, żeby gra się odbyła" w `EventCapacityFields.tsx` (kreator
 * + edycja) i werdykt „Gramy ✓ / Brakuje N do minimum" w `CzyGramyPanel.tsx`.
 *
 * Wyłączona 2026-08-21 — produktowa decyzja: nie chcemy tej funkcji w apce.
 * Flaga chowa wyłącznie kontrolkę progu i jego werdykt; „Otwórz dla okolicy"
 * i „Nie gram" w tym samym panelu nie zależą od progu i zostają widoczne.
 * `events.min_players`, RPC `zapytaj_milczacych()` i wyzwalacz
 * `powiadom_o_progu_gry()` zostają w bazie nietknięte.
 */
export const SHOW_MIN_PLAYERS_THRESHOLD = false;
