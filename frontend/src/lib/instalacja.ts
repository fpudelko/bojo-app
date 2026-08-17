/**
 * Kiedy i komu proponować dodanie Bojo do ekranu głównego.
 *
 * Cała decyzja siedzi tutaj, a nie w komponencie, bo to są reguły produktowe,
 * nie widok — i dają się przez to sprawdzić testem bez renderowania czegokolwiek.
 *
 * ZASADY, w kolejności ważności:
 *
 *  1. Nie na wejściu. Ktoś, kto pierwszy raz widzi stronę, nie wie jeszcze,
 *     czy chce ją mieć na telefonie — prośba na dzień dobry ląduje w koszu
 *     odruchowo. Pytamy dopiero PO tym, jak coś się udało (zapis na mecz,
 *     utworzenie meczu).
 *  2. Raz. Kto zamknął, ma spokój — nachalny pasek irytuje bardziej, niż pomaga.
 *  3. Nie temu, kto już zainstalował.
 *  4. Nie na komputerze — „dodaj do ekranu głównego" nic tam nie znaczy.
 *  5. Nie w przeglądarce wbudowanej w Facebooka czy Instagrama, bo tam
 *     instalacja i tak nie zadziała, a instrukcja tylko zmyli.
 */

/** Klucz w `localStorage` — konwencja `bojo:…` jak reszta znaczników. */
const KLUCZ_ZAMKNIETE = 'bojo:instalacja-odrzucona';

export type System = 'ios' | 'android' | 'inny';

export interface StanPrzegladarki {
  /** Bojo otwarte już „jako apka" (z ikony), a nie w karcie przeglądarki. */
  zainstalowane: boolean;
  system: System;
  /** Przeglądarka wbudowana w inną aplikację (Messenger, Instagram…). */
  wbudowana: boolean;
  /** Ekran na tyle wąski, że to telefon. */
  telefon: boolean;
}

/**
 * Rozpoznaje przeglądarkę wbudowaną w inną aplikację.
 *
 * Ta sama lista sygnatur co przy blokadzie logowania Google w `AuthForm` —
 * tam objawem jest martwy przycisk Google, tu bezsensowna instrukcja
 * instalacji. Jedno źródło prawdy, żeby przy dokładaniu kolejnej aplikacji
 * poprawiać w jednym miejscu.
 */
export const SYGNATURY_WBUDOWANEJ =
  /FBAN|FBAV|FB_IAB|MessengerLite|Instagram|musical_ly|BytedanceWebview|Snapchat|TwitterAndroid|Twitter for iPhone|LinkedInApp/i;

export function czytajStanPrzegladarki(): StanPrzegladarki {
  if (typeof window === 'undefined') {
    return { zainstalowane: false, system: 'inny', wbudowana: false, telefon: false };
  }

  const ua = navigator.userAgent || '';

  // Dwa sposoby, bo iOS nie wspiera `display-mode: standalone` w każdej wersji
  // i wystawia własną, niestandardową flagę na `navigator`.
  const zStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const zIosowe = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const system: System = /iPhone|iPad|iPod/i.test(ua)
    ? 'ios'
    : /Android/i.test(ua)
      ? 'android'
      : 'inny';

  return {
    zainstalowane: zStandalone || zIosowe,
    system,
    wbudowana: SYGNATURY_WBUDOWANEJ.test(ua),
    // Próg jak breakpoint `md` Tailwinda — poniżej niego i tak pokazujemy
    // widok telefonu.
    telefon: window.innerWidth < 768,
  };
}

export function czyJuzOdrzucil(): boolean {
  try {
    return localStorage.getItem(KLUCZ_ZAMKNIETE) === '1';
  } catch {
    // Tryb prywatny bez localStorage: wolimy nie prosić niż prosić w kółko.
    return true;
  }
}

export function zapamietajOdrzucenie(): void {
  try {
    localStorage.setItem(KLUCZ_ZAMKNIETE, '1');
  } catch { /* tryb prywatny — trudno, pokaże się jeszcze raz */ }
}

/**
 * Czy w ogóle ma sens pokazywać zachętę.
 *
 * `mozliweNatywnie` mówi, czy przeglądarka dała nam sygnał `beforeinstallprompt`
 * (Chrome na Androidzie). Bez niego na Androidzie nie mamy czym zainstalować,
 * a samo pokazanie instrukcji byłoby zgadywaniem. Na iOS ten sygnał nie istnieje
 * i nigdy nie zaistnieje — tam instrukcja jest JEDYNĄ drogą, więc pokazujemy ją
 * mimo braku sygnału.
 */
export function czyPokazacZachete(
  stan: StanPrzegladarki,
  odrzucil: boolean,
  mozliweNatywnie: boolean,
): boolean {
  if (stan.zainstalowane) return false;
  if (odrzucil) return false;
  if (stan.wbudowana) return false;
  if (!stan.telefon) return false;

  if (stan.system === 'ios') return true;
  if (stan.system === 'android') return mozliweNatywnie;
  return false;
}

/**
 * Powód, dla którego warto zainstalować — pokazywany zamiast samego
 * „zainstaluj aplikację".
 *
 * Na iOS to nie jest zachęta, tylko fakt: Safari wysyła powiadomienia
 * WYŁĄCZNIE do aplikacji dodanej do ekranu głównego. Mówimy o tym wprost,
 * zamiast obiecywać push wszystkim.
 */
export function powodInstalacji(system: System): string {
  return system === 'ios'
    ? 'Na iPhonie powiadomienia o meczach działają tylko z ekranu głównego.'
    : 'Będziesz dostawać przypomnienie o meczu i wiadomość, gdy zwolni się miejsce.';
}
