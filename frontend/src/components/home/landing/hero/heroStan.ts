'use client';

/**
 * Stan animacji z pierwszego ekranu strony głównej, współdzielony między
 * plakietką nad nagłówkiem (`HeroChip`) a telefonem (`HeroTelefon`).
 *
 * Oba elementy stoją w różnych kolumnach układu, a `LandingHero` jest
 * komponentem serwerowym, więc nie ma wspólnego rodzica klienckiego, w którym
 * dałoby się trzymać stan Reacta. Mały zewnętrzny magazyn załatwia to bez
 * kontekstu i bez opakowywania całego hero w komponent kliencki (co
 * wyrzuciłoby z HTML-a serwera nagłówek, opis i przyciski, czyli to, co czyta
 * wyszukiwarka).
 */
import { useSyncExternalStore } from 'react';

export interface StanHero {
  /** Indeks rozdziału, który właśnie gra (0-4). */
  rozdzial: number;
  /** Plakietka pokazuje stały napis zamiast nazwy rozdziału: przy
   *  `prefers-reduced-motion` (nic się nie zmienia samo). Na telefonie stały
   *  napis jest zawsze, ale to załatwia CSS, nie ten stan. */
  staly: boolean;
}

const STAN_POCZATKOWY: StanHero = { rozdzial: 0, staly: false };
let stan: StanHero = STAN_POCZATKOWY;
const sluchacze = new Set<() => void>();

export function ustawStanHero(zmiana: Partial<StanHero>): void {
  const nowy = { ...stan, ...zmiana };
  if (nowy.rozdzial === stan.rozdzial && nowy.staly === stan.staly) return;
  stan = nowy;
  sluchacze.forEach((f) => f());
}

function subskrybuj(f: () => void): () => void {
  sluchacze.add(f);
  return () => { sluchacze.delete(f); };
}

/** Serwer i pierwszy render klienta zawsze widzą stan początkowy, więc HTML
 *  się zgadza (bez błędów hydracji). */
export function useStanHero(): StanHero {
  return useSyncExternalStore(subskrybuj, () => stan, () => STAN_POCZATKOWY);
}
