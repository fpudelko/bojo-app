// Liczenie wyniku meczu — czyste funkcje, bez bazy. Lustro logiki z
// `przelicz_wynik_meczu()` (migracja 147) do OPTYMISTYCZNEGO odświeżenia
// konsoli prowadzącego (kliknięcie ma pokazać nowy wynik natychmiast, nie po
// odpowiedzi serwera) — baza i tak liczy jeszcze raz i to jej wynik wygrywa.
import type { MeczFaza, MeczStatus, TurniejZdarzenie } from '@/types';

/**
 * Suma zdarzeń piłkarskich/koszykarskich na wynik meczu. SAMOBÓJCZY dolicza
 * się PRZECIWNIKOWI drużyny z `druzynaId` — ta sama reguła co w bazie (147).
 * Siatkówka/plażówka NIE korzysta z tej funkcji — tam liczą się wygrane sety,
 * patrz `wygranSetow()` niżej.
 */
export function wynikZeZdarzen(
  zdarzenia: readonly Pick<TurniejZdarzenie, 'typ' | 'druzynaId' | 'wartosc'>[],
  druzynaAId: string,
  druzynaBId: string,
): { wynikA: number; wynikB: number } {
  let wynikA = 0;
  let wynikB = 0;
  for (const z of zdarzenia) {
    if (z.typ === 'gol' || z.typ === 'punkty') {
      if (z.druzynaId === druzynaAId) wynikA += z.wartosc;
      else if (z.druzynaId === druzynaBId) wynikB += z.wartosc;
    } else if (z.typ === 'samobojczy') {
      if (z.druzynaId === druzynaAId) wynikB += z.wartosc;
      else if (z.druzynaId === druzynaBId) wynikA += z.wartosc;
    }
  }
  return { wynikA, wynikB };
}

/** Mecz da się prowadzić (rozpocząć/zapisywać zdarzenia), dopóki nie jest rozstrzygnięty. */
export function mozeZapisywacZdarzenia(status: MeczStatus): boolean {
  return status === 'zaplanowany' || status === 'trwa';
}

export function mozeZakonczycMecz(status: MeczStatus): boolean {
  return status === 'zaplanowany' || status === 'trwa';
}

/**
 * Remis w fazie innej niż grupa/liga wymaga karnych, żeby drabinka miała kogo
 * przenieść do kolejnej rundy (`zakoncz_mecz()`, 147, ta sama reguła).
 */
export function wymaganeKarne(faza: MeczFaza, wynikA: number, wynikB: number): boolean {
  return wynikA === wynikB && faza !== 'grupa' && faza !== 'liga';
}

/** `null`, dopóki karne nie rozstrzygają (równe albo niepodane). */
export function zwyciezcaZKarnych(karneA?: number, karneB?: number): 'a' | 'b' | null {
  if (karneA === undefined || karneB === undefined || karneA === karneB) return null;
  return karneA > karneB ? 'a' : 'b';
}

/**
 * Dopisuje punkt do WSKAZANEGO seta siatkówki/plażówki (dopełnia tablicę
 * zerami, jeśli set jeszcze nie istnieje) — `delta` ujemne cofa pomyłkę,
 * z dolnym ograniczeniem na zero (wynik seta nie bywa ujemny).
 */
export function ustawPunktSetu(
  sety: readonly { a: number; b: number }[],
  indeksSetu: number,
  strona: 'a' | 'b',
  delta: number,
): { a: number; b: number }[] {
  const nowe = sety.map((s) => ({ ...s }));
  while (nowe.length <= indeksSetu) nowe.push({ a: 0, b: 0 });
  nowe[indeksSetu][strona] = Math.max(0, nowe[indeksSetu][strona] + delta);
  return nowe;
}

/** Ile setów wygrała każda strona — wyższy wynik w secie = wygrany set. Remisu
 *  w secie nie liczymy jako niczyjego, wynik seta wskazuje zwycięzcę wprost. */
export function wygranSetow(sety: readonly { a: number; b: number }[]): { a: number; b: number } {
  return sety.reduce(
    (acc, s) => {
      if (s.a > s.b) acc.a += 1;
      else if (s.b > s.a) acc.b += 1;
      return acc;
    },
    { a: 0, b: 0 },
  );
}

/** Set skończony, gdy jedna strona osiągnęła próg z co najmniej 2-punktową
 *  przewagą — sam próg (`doPunktow`), nie egzekwuje niczego: prowadzący może
 *  kliknąć „Zakończ set" wcześniej albo później, to tylko podpowiedź w UI. */
export function setOsiagnalProg(set: { a: number; b: number }, doPunktow: number): boolean {
  return (set.a >= doPunktow || set.b >= doPunktow) && Math.abs(set.a - set.b) >= 2;
}

const SPORTY_SETOWE = new Set(['siatkówka', 'siatkówka plażowa']);

/** Siatkówka/plażówka liczą się w setach (`turniej_mecze.sety`), nie zdarzeniami
 *  — jedyny rozgałęzienie sportu, jakiego potrzebuje konsola prowadzącego. */
export function jestSportemSetowym(sport: string): boolean {
  return SPORTY_SETOWE.has(sport);
}

/** Koszykówka liczy punkty 1/2/3 (`typ: 'punkty'`), nie gole — reszta sportów
 *  zdarzeniowych (piłka nożna, futsal, …) używa `typ: 'gol'`/`'samobojczy'`. */
export function jestKoszykowka(sport: string): boolean {
  return sport === 'koszykówka';
}
