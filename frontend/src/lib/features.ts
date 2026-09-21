// ---------------------------------------------------------------------------
// Feature flags — single source of truth for functionality that is built but
// intentionally hidden from users for now. Flip to `true` to bring a feature
// back. See /BACKLOG.md for the why behind each one.
// ---------------------------------------------------------------------------

/**
 * Moduł turniejowy (`/turnieje/*`) — turniej z zapisami drużyn, terminarzem
 * generowanym automatycznie i wynikami wpisywanymi na żywo przez prowadzącego.
 * Kod: `lib/turnieje.ts`, `lib/turniejDruzyny.ts`, migracje `145`–`150`.
 *
 * Nie mylić ze starym „BOJO Cup" (`SHOW_CUP`, usunięty 2026-09-13 razem z
 * `lib/tournaments.ts`; tabele `tournament_*` skasowane migracją `151` razem
 * z odmrożeniem tej flagi): tamten turniej zakładał wyłącznie admin, był
 * jeden, a drużyny umawiały mecze same przez tygodnie. Ten zakłada każdy
 * organizator, wielu naraz, z terminarzem z góry na jeden dzień/weekend.
 * Plan → `docs/turnieje-plan-duze-klocki.md` i
 * `docs/turnieje-plan-srednie-klocki.md`.
 *
 * WYŁĄCZONA PONOWNIE od 2026-09-17, tymczasowo — decyzja właściciela po
 * przeglądzie modułu na żywo. Powód nie jest techniczny: moduł działa, ale
 * pierwsze wrażenie jeszcze nie jest gotowe dla kogoś z ulicy (m.in. dane
 * testowe wgrane na produkcję, brak „obserwuj turniej", status turnieju liczony
 * z kolumny, a nie z terminarza). Wejścia z `/moje-gry` i `/profil` znikają;
 * TRASA ZOSTAJE DOSTĘPNA — kto wejdzie na `/turnieje` świadomie albo z linku
 * udostępnionego, zobaczy wszystko. Tak samo działa każda flaga w tym pliku:
 * chowa wejścia w nawigacji, nie trasy.
 *
 * Wcześniej włączona od zakończenia Etapu 4 (150: ogłoszenia, BLIK, „zamień
 * drużynę w ekipę").
 */
export const SHOW_TURNIEJE = false;

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
 * Wejść jest dziś CZTERY (komentarz mówił do 2026-09-21 „jedno" i był nieaktualny
 * od dołożenia mapy i profilu): pusta lista na `/wydarzenia`, `/mapa`, `/profil`
 * oraz — od 2026-09-21 — pusty stan „Nadchodzące mecze" na `/boisko/[id]`.
 * To ostatnie jest jedynym stojącym tam, gdzie ląduje ruch z wyszukiwarki:
 * 980 z 1000 stron zbierających wyświetlenia w Search Console to `/boisko/*`.
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
