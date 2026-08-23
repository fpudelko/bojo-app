/**
 * Plakietka z liczbą na IKONIE APLIKACJI (Badging API).
 *
 * PO CO. Chmurka i dzwonek w nagłówku mówią o nieprzeczytanych dopiero wtedy,
 * gdy ktoś już otworzył Bojo — a najczęstszy przypadek jest odwrotny: telefon
 * leży na stole, wiadomość w rozmowie meczu przyszła godzinę temu i nic o niej
 * nie mówi. Push to sygnał jednorazowy: znika z ekranu blokady i po nim nie
 * zostaje ślad. Liczba na ikonie zostaje, dopóki jest co przeczytać.
 *
 * GDZIE TO DZIAŁA. Wyłącznie w ZAINSTALOWANEJ aplikacji (ekran początkowy /
 * dok), nie w karcie przeglądarki:
 *   - Android/Chromium: po instalacji PWA,
 *   - iOS 16.4+: po dodaniu do ekranu początkowego I zgodzie na powiadomienia
 *     — bez zgody `setAppBadge()` odrzuca obietnicę,
 *   - reszta: metody po prostu nie ma.
 * Dlatego KAŻDE wywołanie jest wykrywane i łykane po cichu. Brak plakietki
 * jest brakiem wygody, nie błędem — a wyjątek w tym miejscu leciałby z efektu
 * Reacta przy każdym powiadomieniu.
 *
 * TA SAMA LICZBA JEST USTAWIANA W DWÓCH MIEJSCACH i to jest zamierzone:
 *   - `NotificationBell.tsx` — gdy aplikacja jest otwarta (zna stan wprost),
 *   - `public/sw.js` — gdy jest zamknięta, z liczby doklejonej do pusha przez
 *     funkcję brzegową `send-push`.
 * Service worker nie ma dostępu do sesji Supabase, więc sam liczby nie policzy;
 * strona nie działa, gdy jest zamknięta. Ani jedno, ani drugie miejsce nie
 * wystarcza samo.
 */

/** Czy przeglądarka w ogóle zna Badging API. Nie mówi, czy plakietka będzie
 *  widoczna — to zależy od instalacji i (na iOS) zgody na powiadomienia. */
export function plakietkaObslugiwana(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/**
 * Liczba na ikonie aplikacji. `0` (albo cokolwiek bez sensu) ją zdejmuje.
 *
 * Zdejmowanie jest tu równie ważne jak stawianie: plakietka, która nie gaśnie
 * po przeczytaniu, w tydzień uczy człowieka, żeby jej nie ufać — a wtedy
 * przestaje działać także wtedy, gdy naprawdę coś jest.
 */
export async function ustawPlakietke(liczba: number): Promise<void> {
  if (!plakietkaObslugiwana()) return;

  // Liczba idzie z sumy dwóch list, więc `NaN`/`-1`/`Infinity` są tu wyłącznie
  // skutkiem błędu wyżej — na ikonie mają dać czysto, nie wyjątek.
  const ile = Number.isFinite(liczba) ? Math.max(0, Math.floor(liczba)) : 0;

  try {
    if (ile === 0) await navigator.clearAppBadge();
    else await navigator.setAppBadge(ile);
  } catch {
    // Najczęstszy powód: aplikacja otwarta w karcie przeglądarki albo (iOS)
    // bez zgody na powiadomienia. Jedno i drugie jest normalnym stanem.
  }
}
