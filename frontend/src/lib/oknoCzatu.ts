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
 * pikseli NAD klawiaturą, a pod nim świeciło tło strony. `interactiveWidget:
 * 'resizes-content'` w `layout.tsx` naprawia to na Androidzie i nic nie robi
 * na iOS-ie — tam trzeba zmierzyć okno samemu.
 *
 * `visualViewport.height` to dokładnie ten widoczny kawałek: kurczy się razem
 * z klawiaturą na obu systemach. Ekran przyciętym do tej wysokości mieści się
 * w całości nad klawiaturą, więc przeglądarka nie ma czego przewijać i
 * composer siada tam, gdzie ma siedzieć — tuż nad klawiaturą.
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
 *  zostawia `h-[100dvh]` z klasy — na desktopie i w SSR to właściwa wartość. */
export function styleOknaCzatu(okno: OknoCzatu): CSSProperties | undefined {
  return okno.wysokosc === null ? undefined : { height: `${okno.wysokosc}px` };
}

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
