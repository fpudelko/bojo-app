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

/** Ile pikseli ubytku wysokości uznajemy za otwartą klawiaturę. Pasek adresu
 *  chowający się przy przewijaniu zabiera kilkadziesiąt pikseli i klawiaturą
 *  nie jest; najniższa klawiatura ekranowa ma ich grubo ponad 200. */
const PROG_KLAWIATURY = 160;

export type OknoCzatu = {
  /** Wysokość widocznego okna w px; `null`, dopóki nie zmierzona (SSR,
   *  przeglądarka bez `visualViewport`) — wtedy zostaje `h-[100dvh]`. */
  wysokosc: number | null;
  klawiatura: boolean;
};

export const OKNO_NIEZMIERZONE: OknoCzatu = { wysokosc: null, klawiatura: false };

/** Czysta część pomiaru — bez DOM-u, żeby dało się ją przetestować. */
export function zmierzOkno(wysokoscOkna: number, wysokoscStrony: number): OknoCzatu {
  if (!wysokoscOkna || wysokoscOkna <= 0) return OKNO_NIEZMIERZONE;
  return {
    wysokosc: Math.round(wysokoscOkna),
    klawiatura: wysokoscStrony - wysokoscOkna > PROG_KLAWIATURY,
  };
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
      const zmierzone = zmierzOkno(widoczne.height, window.innerHeight);
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
    przelicz();
    widoczne.addEventListener('resize', przelicz);
    widoczne.addEventListener('scroll', przelicz);
    return () => {
      widoczne.removeEventListener('resize', przelicz);
      widoczne.removeEventListener('scroll', przelicz);
    };
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
    const widoczne = window.visualViewport;
    const znacznik = document.documentElement.dataset;
    const przelicz = () => {
      if (zmierzOkno(widoczne.height, window.innerHeight).klawiatura) znacznik.klawiatura = '1';
      else delete znacznik.klawiatura;
    };
    przelicz();
    widoczne.addEventListener('resize', przelicz);
    widoczne.addEventListener('scroll', przelicz);
    return () => {
      widoczne.removeEventListener('resize', przelicz);
      widoczne.removeEventListener('scroll', przelicz);
      delete znacznik.klawiatura;
    };
  }, [aktywny]);
}
