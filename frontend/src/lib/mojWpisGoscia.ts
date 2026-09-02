/**
 * Pamięć o własnym zapisie gościa — na urządzeniu, w `localStorage`.
 *
 * PO CO. Gość zapisuje się bez konta i dostaje okno „Utwórz profil". Kto je
 * zamknie („Pomijam, potwierdzę później"), traci `claim_token` BEZPOWROTNIE:
 * nic nie zostaje na urządzeniu, żaden e-mail nie wychodzi, a wracając na
 * stronę meczu widzi ją tak samo jak ktoś zupełnie obcy — z przyciskiem
 * „Dołącz bez konta", choć jest już w składzie.
 *
 * Ten moduł jest całą naprawą po stronie przeglądarki: zapamiętany token
 * pozwala pokazać mu „to Ty" i dać wejście do zarządzania swoim zapisem
 * (`/gracz/przejmij/[token]`).
 *
 * DLACZEGO `localStorage`, A NIE CIASTKO. Token nie jedzie do serwera przy
 * żadnym żądaniu — czyta go wyłącznie kod strony, żeby zbudować odnośnik.
 * Ciastko dokładałoby ten sekret do każdego zapytania bez powodu.
 *
 * KAŻDY ODCZYT I ZAPIS W `try/catch`. `localStorage` rzuca wyjątkiem w trybie
 * prywatnym i przy zablokowanych danych witryn — a to jest funkcja pomocnicza,
 * która nie ma prawa wywrócić strony meczu. Ta sama zasada co w `lib/push.ts`
 * i `lib/instalacja.ts`.
 */

const PRZEDROSTEK = 'bojo:moj-wpis:';

function klucz(eventId: string): string {
  return `${PRZEDROSTEK}${eventId}`;
}

/** Zapamiętuje token wpisu gościa po udanym zapisie bez konta. */
export function zapamietajWpisGoscia(eventId: string, token: string): void {
  if (!eventId || !token) return;
  try {
    window.localStorage.setItem(klucz(eventId), token);
  } catch { /* tryb prywatny — trudno, po prostu nie zapamiętamy */ }
}

/** Token mojego wpisu na tym meczu albo `null`, gdy nic tu nie zapisano. */
export function mojWpisGoscia(eventId: string): string | null {
  if (!eventId) return null;
  try {
    return window.localStorage.getItem(klucz(eventId));
  } catch {
    return null;
  }
}

/** Kasuje pamięć o wpisie — po wypisaniu się i po przejęciu wpisu na konto.
 *  Bez tego strona meczu twierdziłaby „to Ty" przy wpisie, którego już nie ma
 *  albo który należy teraz do zalogowanego konta. */
export function zapomnijWpisGoscia(eventId: string): void {
  if (!eventId) return;
  try {
    window.localStorage.removeItem(klucz(eventId));
  } catch { /* jak wyżej */ }
}
