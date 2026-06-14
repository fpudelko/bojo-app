// ---------------------------------------------------------------------------
// Feature flags — single source of truth for functionality that is built but
// intentionally hidden from users for now. Flip to `true` to bring a feature
// back. See /BACKLOG.md for the why behind each one.
// ---------------------------------------------------------------------------

/** BOJO Cup / tournament promo (AnnouncementBar, TrustBar, Header link). */
export const SHOW_CUP = false;

/**
 * Game alerts — "Ustaw alert" so users get pinged when a matching game is
 * created nearby. Hidden until we have a real delivery channel (SMS/email/push);
 * showing it now would over-promise. Code lives in lib/alerts.ts + AlertSetupDialog.
 */
export const SHOW_GAME_ALERTS = false;

/**
 * SMS-based features — "Potwierdzenie SMS" on events and scheduled SMS/email
 * reminders. Hidden until an SMS gateway is wired up. Code: RemindersSection,
 * lib/reminders.ts, sendConfirmationSms in lib/eventFeatures.ts.
 */
export const SHOW_SMS_FEATURES = false;

/**
 * Recurring games ("Stałe gierki") — fixed weekly pickup games with a saved
 * roster. Hidden from nav for now while we focus on one-off matches.
 * Code lives in /app/cykliczne/* and lib/recurring.ts.
 */
export const SHOW_RECURRING = false;
