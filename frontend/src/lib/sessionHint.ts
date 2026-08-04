// A tiny presentational cookie, NOT a credential. Its only job is to tell
// the server "someone is probably signed in" so app/page.tsx can render the
// dashboard skeleton instead of the marketing landing on the first response —
// closing the flash a signed-in visitor otherwise sees while the browser
// client reads the real session out of localStorage.
//
// The value is the literal string "1". There is no token, no user id, no
// claim of any kind in it. Forging this cookie gets you an empty dashboard
// skeleton and nothing else — every real read still goes through RLS via the
// browser's Supabase client. Authorization lives there, not here.
//
// See BACKLOG.md §5 ("Sesja w cookie zamiast localStorage") for why a full
// @supabase/ssr migration is a separate, later step and not folded into this.

export const SESSION_HINT_COOKIE = 'bojo_sess';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Cookie string that marks "someone is signed in". Pass `secure=true` only
 *  on https — Secure cookies are silently refused on http (e.g. localhost). */
export function setHintCookie(secure: boolean): string {
  const parts = [
    `${SESSION_HINT_COOKIE}=1`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Clears the hint — used on sign-out and to self-heal a stale hint when the
 *  browser client discovers there is in fact no session. */
export function clearHintCookie(secure: boolean): string {
  const parts = [
    `${SESSION_HINT_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
