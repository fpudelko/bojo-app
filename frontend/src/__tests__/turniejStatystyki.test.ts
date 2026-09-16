import { describe, expect, it } from 'vitest';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import type { TurniejZdarzenie } from '@/types';

const ZAWODNICY = [
  { id: 'z1', imie: 'Jan Kowalski', numer: 9, druzynaId: 'a' },
  { id: 'z2', imie: 'Piotr Nowak', numer: 7, druzynaId: 'a' },
  { id: 'z3', imie: 'Adam Wiśniewski', numer: 10, druzynaId: 'b' },
];
const DRUZYNY_PO_ID = new Map([['a', 'Drużyna A'], ['b', 'Drużyna B']]);

function zdarzenie(dane: Partial<TurniejZdarzenie> & Pick<TurniejZdarzenie, 'meczId' | 'typ'>): Pick<TurniejZdarzenie, 'meczId' | 'typ' | 'zawodnikId' | 'asystaZawodnikId' | 'wartosc'> {
  return { wartosc: 1, zawodnikId: undefined, asystaZawodnikId: undefined, ...dane };
}

describe('obliczKlasyfikacje', () => {
  it('liczy gole zawodnika', () => {
    const wpisy = obliczKlasyfikacje(
      [zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' })],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.find((w) => w.zawodnikId === 'z1')).toMatchObject({ gole: 1, mecze: 1, druzynaNazwa: 'Drużyna A' });
  });

  it('samobójczy NIE liczy się jako gol strzelca', () => {
    const wpisy = obliczKlasyfikacje(
      [zdarzenie({ meczId: 'm1', typ: 'samobojczy', zawodnikId: 'z1' })],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    // zawodnik ma zdarzenie (żółta/czerwona liczą się osobno), ale gole=0
    const wpis = wpisy.find((w) => w.zawodnikId === 'z1');
    expect(wpis?.gole).toBe(0);
  });

  it('koszykówka: punkty liczą się jak gole, z wartością 1/2/3', () => {
    const wpisy = obliczKlasyfikacje(
      [
        zdarzenie({ meczId: 'm1', typ: 'punkty', zawodnikId: 'z1', wartosc: 3 }),
        zdarzenie({ meczId: 'm1', typ: 'punkty', zawodnikId: 'z1', wartosc: 2 }),
      ],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.find((w) => w.zawodnikId === 'z1')?.gole).toBe(5);
  });

  it('asysta liczy się osobno od gola, dla INNEGO zawodnika', () => {
    const wpisy = obliczKlasyfikacje(
      [zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1', asystaZawodnikId: 'z2' })],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.find((w) => w.zawodnikId === 'z1')).toMatchObject({ gole: 1, asysty: 0 });
    expect(wpisy.find((w) => w.zawodnikId === 'z2')).toMatchObject({ gole: 0, asysty: 1 });
  });

  it('kartki liczą się, ale nie wliczają się do goli', () => {
    const wpisy = obliczKlasyfikacje(
      [
        zdarzenie({ meczId: 'm1', typ: 'zolta', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm1', typ: 'czerwona', zawodnikId: 'z1' }),
      ],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.find((w) => w.zawodnikId === 'z1')).toMatchObject({ zolte: 1, czerwone: 1, gole: 0 });
  });

  it('mecze liczy DYSTYNKTYWNIE — dwa gole w tym samym meczu to jeden mecz', () => {
    const wpisy = obliczKlasyfikacje(
      [
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm2', typ: 'gol', zawodnikId: 'z1' }),
      ],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    const wpis = wpisy.find((w) => w.zawodnikId === 'z1')!;
    expect(wpis.gole).toBe(3);
    expect(wpis.mecze).toBe(2);
  });

  it('MVP liczy się z listy zakończonych meczów, nie ze zdarzeń', () => {
    const wpisy = obliczKlasyfikacje(
      [],
      [{ mvpZawodnikId: 'z1' }, { mvpZawodnikId: 'z1' }, { mvpZawodnikId: 'z3' }, { mvpZawodnikId: undefined }],
      ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.find((w) => w.zawodnikId === 'z1')?.mvp).toBe(2);
    expect(wpisy.find((w) => w.zawodnikId === 'z3')?.mvp).toBe(1);
  });

  it('zawodnik bez żadnego zdarzenia/MVP nie pojawia się w klasyfikacji', () => {
    const wpisy = obliczKlasyfikacje(
      [zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' })],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(wpisy.some((w) => w.zawodnikId === 'z2')).toBe(false);
  });

  it('brak zdarzeń i MVP — pusta klasyfikacja', () => {
    expect(obliczKlasyfikacje([], [], ZAWODNICY, DRUZYNY_PO_ID)).toEqual([]);
  });
});

describe('posortujKlasyfikacje', () => {
  it('sortuje malejąco po wskazanej kolumnie', () => {
    const wpisy = obliczKlasyfikacje(
      [
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z2' }),
      ],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    expect(posortujKlasyfikacje(wpisy, 'gole').map((w) => w.zawodnikId)).toEqual(['z1', 'z2']);
  });

  it('przy remisie na golach wygrywa mniejsza liczba meczów (lepsza forma)', () => {
    const wpisy = obliczKlasyfikacje(
      [
        // z1: 2 gole w JEDNYM meczu
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        zdarzenie({ meczId: 'm1', typ: 'gol', zawodnikId: 'z1' }),
        // z2: 2 gole rozłożone na DWA mecze
        zdarzenie({ meczId: 'm2', typ: 'gol', zawodnikId: 'z2' }),
        zdarzenie({ meczId: 'm3', typ: 'gol', zawodnikId: 'z2' }),
      ],
      [], ZAWODNICY, DRUZYNY_PO_ID,
    );
    const posortowane = posortujKlasyfikacje(wpisy, 'gole');
    expect(posortowane[0].gole).toBe(posortowane[1].gole); // remis na golach (2:2)
    expect(posortowane[0].zawodnikId).toBe('z1'); // mniej meczów (1 < 2) wygrywa tie-break
  });
});
