// Klasyfikacje indywidualne (strzelcy, asysty, MVP) — WYŁĄCZNIE czyste funkcje,
// liczone z już pobranych `turniej_zdarzenia`/meczów. Zero widoku SQL, tak samo
// jak `lib/turniejTabela.ts` — z tego samego powodu (nie omijać RLS drugą drogą).
import type { TurniejZdarzenie, WpisKlasyfikacji } from '@/types';

export interface ZawodnikDoKlasyfikacji {
  id: string;
  imie: string;
  numer?: number;
  druzynaId: string;
}

/**
 * `mecze` w wyniku to PRZYBLIŻENIE: liczba różnych meczów, w których zawodnik
 * ma choć jedno zdarzenie (gol/asysta/kartka). Bojo nie śledzi pełnego składu
 * wyjściowego ani zmian — świadoma decyzja z Etapu 2 (konsola zapisuje
 * zdarzenia, nie listę jedenastki na boisku). Zawodnik bez ani jednego
 * zdarzenia w całym turnieju nie pojawi się w klasyfikacji wcale — to
 * zamierzone: tabela ma sens tylko dla tych, którzy w niej COŚ zrobili.
 *
 * SAMOBÓJCZY NIE LICZY SIĘ jako gol strzelca — zgodnie z konwencją piłkarską
 * własna bramka nigdy nie trafia na konto zawodnika w klasyfikacji strzelców.
 */
export function obliczKlasyfikacje(
  zdarzenia: readonly Pick<TurniejZdarzenie, 'meczId' | 'typ' | 'zawodnikId' | 'asystaZawodnikId' | 'wartosc'>[],
  mvpPoMeczach: readonly { mvpZawodnikId?: string }[],
  zawodnicy: readonly ZawodnikDoKlasyfikacji[],
  druzynyPoId: ReadonlyMap<string, string>,
): WpisKlasyfikacji[] {
  const wpisy = new Map<string, WpisKlasyfikacji>();
  const meczePoZawodniku = new Map<string, Set<string>>();

  const dostanWpis = (zawodnikId: string): WpisKlasyfikacji | undefined => {
    const istniejacy = wpisy.get(zawodnikId);
    if (istniejacy) return istniejacy;
    const z = zawodnicy.find((zz) => zz.id === zawodnikId);
    if (!z) return undefined;
    const nowy: WpisKlasyfikacji = {
      zawodnikId,
      imie: z.imie,
      numer: z.numer,
      druzynaId: z.druzynaId,
      druzynaNazwa: druzynyPoId.get(z.druzynaId) ?? '-',
      gole: 0, asysty: 0, zolte: 0, czerwone: 0, mvp: 0, mecze: 0,
    };
    wpisy.set(zawodnikId, nowy);
    return nowy;
  };

  const zanotujMecz = (zawodnikId: string, meczId: string) => {
    if (!meczePoZawodniku.has(zawodnikId)) meczePoZawodniku.set(zawodnikId, new Set());
    meczePoZawodniku.get(zawodnikId)!.add(meczId);
  };

  for (const z of zdarzenia) {
    if (z.zawodnikId) {
      const wpis = dostanWpis(z.zawodnikId);
      if (wpis) {
        if (z.typ === 'gol' || z.typ === 'punkty') wpis.gole += z.wartosc;
        else if (z.typ === 'zolta') wpis.zolte += 1;
        else if (z.typ === 'czerwona') wpis.czerwone += 1;
        zanotujMecz(z.zawodnikId, z.meczId);
      }
    }
    if (z.typ === 'gol' && z.asystaZawodnikId) {
      const wpis = dostanWpis(z.asystaZawodnikId);
      if (wpis) {
        wpis.asysty += 1;
        zanotujMecz(z.asystaZawodnikId, z.meczId);
      }
    }
  }

  for (const m of mvpPoMeczach) {
    if (m.mvpZawodnikId) {
      const wpis = dostanWpis(m.mvpZawodnikId);
      if (wpis) wpis.mvp += 1;
    }
  }

  for (const [zawodnikId, mecze] of Array.from(meczePoZawodniku)) {
    const wpis = wpisy.get(zawodnikId);
    if (wpis) wpis.mecze = mecze.size;
  }

  return Array.from(wpisy.values());
}

/** Sortuje malejąco po jednej kolumnie klasyfikacji; przy remisie wygrywa
 *  MNIEJ meczów (ta sama liczba w mniejszej liczbie występów czyta się jako
 *  lepsza forma), na końcu alfabetycznie — deterministyczne między odświeżeniami. */
export function posortujKlasyfikacje(
  wpisy: readonly WpisKlasyfikacji[],
  klucz: 'gole' | 'asysty' | 'mvp',
): WpisKlasyfikacji[] {
  return [...wpisy].sort((a, b) => {
    if (b[klucz] !== a[klucz]) return b[klucz] - a[klucz];
    if (a.mecze !== b.mecze) return a.mecze - b.mecze;
    return a.imie.localeCompare(b.imie, 'pl');
  });
}
