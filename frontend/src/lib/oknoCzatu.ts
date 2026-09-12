'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Wysokość ekranu czatu liczona z WIDOCZNEGO okna (`visualViewport`), a nie
 * z `100dvh`.
 *
 * DLACZEGO. Zakładka Rozmowa (mecz) i Tablica (ekipa) mają stałą wysokość
 * ekranu i composer przyklejony do dołu — na `h-[100dvh]`. Na iOS klawiatura
 * NIE kurczy layoutu: `dvh` zostaje takie samo, a przeglądarka po prostu
 * przesuwa widoczne okno w górę, żeby odsłonić pole tekstowe. Przesuwa je
 * z zapasem, więc dół strony (czyli composer) zatrzymywał się kilkadziesiąt
 * pikseli NAD klawiaturą, a pod nim świeciło tło strony.
 *
 * TEN POMIAR OBSŁUGUJE OBA SYSTEMY. Android chodził dawniej osobną drogą —
 * `interactiveWidget: 'resizes-content'` w `layout.tsx` kazał przeglądarce
 * skurczyć layout — i to właśnie ona zabierała możliwość pisania: klawiatura
 * mrugała i zamykała się natychmiast (powód w `layout.tsx`). Przy
 * `resizes-visual` Android zachowuje się jak iOS, więc wystarczy jedna ścieżka.
 *
 * `visualViewport.height` to dokładnie ten widoczny kawałek: kurczy się razem
 * z klawiaturą na obu systemach. Ekran przyciętym do tej wysokości mieści się
 * w całości nad klawiaturą, więc przeglądarka nie ma czego przewijać i
 * composer siada tam, gdzie ma siedzieć — tuż nad klawiaturą.
 *
 * DOLNA NAWIGACJA ZOSTAJE NA EKRANIE CZATU i chowa się WYŁĄCZNIE za
 * klawiaturą — jest `fixed bottom-0`, więc przy `resizes-visual` siedzi pod
 * nią sama z siebie. Wysokość czatu odejmuje `--bottom-nav-h`, żeby composer
 * usiadł NAD paskiem, a `data-klawiatura` na `<html>` zeruje tę zmienną na
 * czas otwartej klawiatury: pasek jest wtedy niewidoczny, więc rezerwowanie
 * mu miejsca zrobiłoby pustkę między composerem a klawiaturą.
 */

export type OknoCzatu = {
  /** Wysokość widocznego okna w px; `null`, dopóki nie zmierzona (SSR,
   *  przeglądarka bez `visualViewport`) — wtedy zostaje wysokość z klasy. */
  wysokosc: number | null;
  klawiatura: boolean;
};

export const OKNO_NIEZMIERZONE: OknoCzatu = { wysokosc: null, klawiatura: false };

/**
 * Czysta część pomiaru — bez DOM-u, żeby dało się ją przetestować.
 *
 * KLAWIATURĘ POZNAJEMY PO SKUPIENIU W POLU TEKSTOWYM, nie po ubytku wysokości.
 * Stało tu porównanie `window.innerHeight - visualViewport.height > 160` i na
 * iOS NIGDY nie wychodziło prawdą: tam przy otwartej klawiaturze kurczą się
 * OBIE wartości, więc różnica zostaje bliska zeru. Skutek było widać na
 * zrzucie — pasek nawigacji nie chował się i nie zwalniał swojego miejsca,
 * więc composer siadał o jego wysokość za wysoko, a w luce pływał pasek
 * adresu Safari („trochę za wysoko ucieka").
 *
 * Skupienie w polu tekstowym jest sygnałem WPROST tego, o co chodzi: pytamy,
 * czy człowiek pisze. Nie zależy od systemu ani od tego, czy przeglądarka
 * kurczy layout, widoczne okno, czy jedno i drugie.
 */
export function zmierzOkno(wysokoscOkna: number, piszemy: boolean): OknoCzatu {
  if (!wysokoscOkna || wysokoscOkna <= 0) return OKNO_NIEZMIERZONE;
  return { wysokosc: Math.round(wysokoscOkna), klawiatura: piszemy };
}

/** Czy skupienie siedzi w polu, które otwiera klawiaturę ekranową. */
export function wPoluTekstowym(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(el.type);
  // `isContentEditable` bywa `undefined` (jsdom) — stąd rzutowanie na bool.
  return el instanceof HTMLElement && !!el.isContentEditable;
}

/** Styl dla korzenia strony czatu. Bez pomiaru zwraca `undefined`, czyli
 *  zostawia klasę `WYSOKOSC_CZATU_BEZ_POMIARU` — na desktopie i w SSR to
 *  właściwa wartość. */
export function styleOknaCzatu(okno: OknoCzatu): CSSProperties | undefined {
  return okno.wysokosc === null
    ? undefined
    : { height: `calc(${okno.wysokosc}px - var(--bottom-nav-h))` };
}

/** Wysokość ekranu czatu, dopóki nie ma pomiaru z `visualViewport`. Ta sama
 *  arytmetyka co w `styleOknaCzatu`, tylko na `dvh` — jedno miejsce, żeby obie
 *  drogi nie rozjechały się o wysokość paska. */
export const WYSOKOSC_CZATU_BEZ_POMIARU = 'h-[calc(100dvh_-_var(--bottom-nav-h))]';

/**
 * Odstęp pod composerem: tyle, ile guzik „Nowy" WYSTAJE ponad pasek nawigacji.
 *
 * `--bottom-nav-h` opisuje sam pasek (`h-14` + wcięcie na kreskę gestów), ale
 * FAB pośrodku wychodzi ponad jego górną krawędź o `-mt-4` plus `ring-4`
 * (`BottomNav.tsx`), czyli ~20 px. Bez tego odstępu pole do pisania wchodziło
 * pod guzik i wyglądało na wciśnięte za nisko (zgłoszone ze zrzutem).
 *
 * Przy otwartej klawiaturze odstępu nie ma: paska wtedy nie widać, więc nie ma
 * czego omijać, a pusty pas nad klawiaturą to dokładnie ten błąd, który ta
 * mechanika naprawiała rundę wcześniej.
 */
export function odstepNadPaskiem(okno: OknoCzatu): string {
  return okno.klawiatura ? '' : 'pb-5';
}

/**
 * Podpina `przelicz` pod każdą zmianę widocznego okna i oddaje sprzątanie.
 *
 * DLACZEGO NIE SAM `resize`. iOS potrafi zmienić wysokość widocznego okna JUŻ
 * PO ostatnim zdarzeniu, które o tym zawiadamia: pływający pasek adresu Safari
 * zwija się chwilę po tym, jak wjedzie klawiatura, i odsłania kilkadziesiąt
 * punktów, o których strona się nie dowiaduje. Pomiar zostawał wtedy za mały
 * na zawsze — composer siadał kilkadziesiąt punktów NAD klawiaturą, a w luce
 * pływał pasek adresu (zgłoszone ze zrzutem: „trochę za wysoko ucieka").
 * Dlatego po każdym zdarzeniu leci jeszcze jeden, opóźniony pomiar.
 *
 * `focusin`/`focusout` są tu, bo to one otwierają i zamykają klawiaturę —
 * a bywa, że przeglądarka nie zgłosi przy tym żadnego `resize`.
 */
function nasluchujWidocznegoOkna(przelicz: () => void): () => void {
  const widoczne = window.visualViewport;
  if (!widoczne) return () => {};
  let spozniony: ReturnType<typeof setTimeout> | undefined;
  const teraz = () => {
    przelicz();
    clearTimeout(spozniony);
    spozniony = setTimeout(przelicz, MS_NA_USTABILIZOWANIE);
  };
  widoczne.addEventListener('resize', teraz);
  widoczne.addEventListener('scroll', teraz);
  window.addEventListener('focusin', teraz);
  window.addEventListener('focusout', teraz);
  teraz();
  return () => {
    clearTimeout(spozniony);
    widoczne.removeEventListener('resize', teraz);
    widoczne.removeEventListener('scroll', teraz);
    window.removeEventListener('focusin', teraz);
    window.removeEventListener('focusout', teraz);
  };
}

/** Ile czekamy na dojście do siebie pasków przeglądarki po ruchu klawiatury.
 *  Animacja klawiatury na iOS trwa ~250 ms, zwinięcie paska adresu bywa tuż
 *  po niej. */
const MS_NA_USTABILIZOWANIE = 400;

export function useOknoCzatu(aktywne: boolean): OknoCzatu {
  const [okno, setOkno] = useState<OknoCzatu>(OKNO_NIEZMIERZONE);
  const ostatnie = useRef<OknoCzatu>(OKNO_NIEZMIERZONE);

  useEffect(() => {
    if (!aktywne || typeof window === 'undefined' || !window.visualViewport) {
      ostatnie.current = OKNO_NIEZMIERZONE;
      setOkno(OKNO_NIEZMIERZONE);
      return;
    }
    const widoczne = window.visualViewport;
    const przelicz = () => {
      const zmierzone = zmierzOkno(widoczne.height, wPoluTekstowym(document.activeElement));
      // Zdarzenie `scroll` widocznego okna leci przy każdym ruchu palcem,
      // a stan po tej samej wartości przerysowałby całą stronę meczu.
      if (zmierzone.wysokosc !== ostatnie.current.wysokosc
          || zmierzone.klawiatura !== ostatnie.current.klawiatura) {
        ostatnie.current = zmierzone;
        setOkno(zmierzone);
      }
      // Strona ma teraz dokładnie wysokość widocznego okna, więc nie ma czego
      // przewijać — a przeglądarka zdążyła już przewinąć ją przy otwieraniu
      // klawiatury. Bez tego zostaje przesunięta i nagłówek wyjeżdża za ekran.
      //
      // RESET LECI TAKŻE W TRAKCIE PISANIA. Przez jedną wersję był tu pominięty,
      // gdy skupienie siedziało w polu — hipoteza, że to programowe przewinięcie
      // każe Androidowi schować klawiaturę. Winne było `resizes-content`
      // w `layout.tsx`, a pominięcie kosztowało iOS: strona zostawała
      // przesunięta, więc nad klawiaturą świecił pusty kawał tła, a nagłówek
      // rozmowy i composer wyjeżdżały za ekran (zgłoszone ze zrzutem).
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    return nasluchujWidocznegoOkna(przelicz);
  }, [aktywne]);

  return okno;
}

/**
 * Znacznik `data-klawiatura` na `<html>` — jedno miejsce w aplikacji, z którego
 * CSS wie, że klawiatura ekranowa jest otwarta (`globals.css`: zeruje
 * `--bottom-nav-h` i chowa dolny pasek).
 *
 * GLOBALNY, nie tylko na ekranach czatu. Pisze się nie tylko w rozmowie:
 * szukajka na liście rozmów też otwiera klawiaturę, a wtedy iOS podnosi pasek
 * `fixed` nad nią dokładnie tak samo. Montuje go `BottomNavGate`, czyli to
 * samo miejsce, które decyduje o istnieniu paska — bez paska znacznik nie ma
 * czego opisywać.
 */
export function useZnacznikKlawiatury(aktywny: boolean): void {
  useEffect(() => {
    if (!aktywny || typeof window === 'undefined' || !window.visualViewport) return;
    const znacznik = document.documentElement.dataset;
    const odepnij = nasluchujWidocznegoOkna(() => {
      if (wPoluTekstowym(document.activeElement)) znacznik.klawiatura = '1';
      else delete znacznik.klawiatura;
    });
    return () => {
      odepnij();
      delete znacznik.klawiatura;
    };
  }, [aktywny]);
}
