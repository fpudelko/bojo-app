import { describe, expect, it } from 'vitest';
import {
  wynikZeZdarzen, mozeZapisywacZdarzenia, mozeZakonczycMecz, wymaganeKarne,
  zwyciezcaZKarnych, ustawPunktSetu, wygranSetow, setOsiagnalProg,
  jestSportemSetowym, jestKoszykowka,
} from '@/lib/turniejWynik';

describe('wynikZeZdarzen', () => {
  it('liczy gole każdej drużyny osobno', () => {
    const wynik = wynikZeZdarzen(
      [
        { typ: 'gol', druzynaId: 'a', wartosc: 1 },
        { typ: 'gol', druzynaId: 'a', wartosc: 1 },
        { typ: 'gol', druzynaId: 'b', wartosc: 1 },
      ],
      'a', 'b',
    );
    expect(wynik).toEqual({ wynikA: 2, wynikB: 1 });
  });

  it('SAMOBÓJCZY dolicza się przeciwnikowi, nie drużynie z druzynaId', () => {
    const wynik = wynikZeZdarzen(
      [{ typ: 'samobojczy', druzynaId: 'a', wartosc: 1 }],
      'a', 'b',
    );
    expect(wynik).toEqual({ wynikA: 0, wynikB: 1 });
  });

  it('koszykówka: punkty liczą się z wartością 1/2/3', () => {
    const wynik = wynikZeZdarzen(
      [
        { typ: 'punkty', druzynaId: 'a', wartosc: 3 },
        { typ: 'punkty', druzynaId: 'a', wartosc: 2 },
        { typ: 'punkty', druzynaId: 'b', wartosc: 1 },
      ],
      'a', 'b',
    );
    expect(wynik).toEqual({ wynikA: 5, wynikB: 1 });
  });

  it('kartki nie wpływają na wynik', () => {
    const wynik = wynikZeZdarzen(
      [{ typ: 'zolta', druzynaId: 'a', wartosc: 1 }, { typ: 'czerwona', druzynaId: 'b', wartosc: 1 }],
      'a', 'b',
    );
    expect(wynik).toEqual({ wynikA: 0, wynikB: 0 });
  });

  it('brak zdarzeń — 0:0', () => {
    expect(wynikZeZdarzen([], 'a', 'b')).toEqual({ wynikA: 0, wynikB: 0 });
  });
});

describe('mozeZapisywacZdarzenia / mozeZakonczycMecz', () => {
  it('tylko zaplanowany i trwa pozwalają dalej pracować z meczem', () => {
    expect(mozeZapisywacZdarzenia('zaplanowany')).toBe(true);
    expect(mozeZapisywacZdarzenia('trwa')).toBe(true);
    expect(mozeZapisywacZdarzenia('zakonczony')).toBe(false);
    expect(mozeZapisywacZdarzenia('walkower')).toBe(false);
    expect(mozeZapisywacZdarzenia('odwolany')).toBe(false);
    expect(mozeZakonczycMecz('trwa')).toBe(true);
    expect(mozeZakonczycMecz('zakonczony')).toBe(false);
  });
});

describe('wymaganeKarne', () => {
  it('remis w grupie/lidze NIE wymaga karnych', () => {
    expect(wymaganeKarne('grupa', 1, 1)).toBe(false);
    expect(wymaganeKarne('liga', 2, 2)).toBe(false);
  });

  it('remis w fazie pucharowej WYMAGA karnych', () => {
    expect(wymaganeKarne('final', 1, 1)).toBe(true);
    expect(wymaganeKarne('polfinal', 0, 0)).toBe(true);
    expect(wymaganeKarne('o_3_miejsce', 2, 2)).toBe(true);
  });

  it('brak remisu — karne niepotrzebne niezależnie od fazy', () => {
    expect(wymaganeKarne('final', 2, 1)).toBe(false);
  });
});

describe('zwyciezcaZKarnych', () => {
  it('wyższy wynik karnych wygrywa', () => {
    expect(zwyciezcaZKarnych(5, 4)).toBe('a');
    expect(zwyciezcaZKarnych(3, 5)).toBe('b');
  });

  it('brak rozstrzygnięcia: równe albo niepodane', () => {
    expect(zwyciezcaZKarnych(4, 4)).toBeNull();
    expect(zwyciezcaZKarnych(undefined, undefined)).toBeNull();
    expect(zwyciezcaZKarnych(5, undefined)).toBeNull();
  });
});

describe('ustawPunktSetu', () => {
  it('dopełnia tablicę zerami do wskazanego indeksu', () => {
    const wynik = ustawPunktSetu([], 0, 'a', 1);
    expect(wynik).toEqual([{ a: 1, b: 0 }]);
  });

  it('dodaje punkt do istniejącego seta bez ruszania innych', () => {
    const start = [{ a: 10, b: 8 }, { a: 5, b: 3 }];
    const wynik = ustawPunktSetu(start, 1, 'b', 1);
    expect(wynik).toEqual([{ a: 10, b: 8 }, { a: 5, b: 4 }]);
    expect(start[1].b).toBe(3); // oryginał nietknięty
  });

  it('cofnięcie (delta ujemne) nie schodzi poniżej zera', () => {
    const wynik = ustawPunktSetu([{ a: 0, b: 0 }], 0, 'a', -1);
    expect(wynik[0].a).toBe(0);
  });
});

describe('wygranSetow', () => {
  it('liczy sety wygrane przez każdą stronę', () => {
    const sety = [{ a: 25, b: 20 }, { a: 22, b: 25 }, { a: 25, b: 18 }];
    expect(wygranSetow(sety)).toEqual({ a: 2, b: 1 });
  });

  it('brak setów — 0:0', () => {
    expect(wygranSetow([])).toEqual({ a: 0, b: 0 });
  });
});

describe('setOsiagnalProg', () => {
  it('próg osiągnięty z przewagą co najmniej 2 punktów', () => {
    expect(setOsiagnalProg({ a: 25, b: 20 }, 25)).toBe(true);
  });

  it('próg osiągnięty, ale przewaga za mała — set trwa dalej (np. siatkówka)', () => {
    expect(setOsiagnalProg({ a: 25, b: 24 }, 25)).toBe(false);
  });

  it('próg nieosiągnięty', () => {
    expect(setOsiagnalProg({ a: 20, b: 18 }, 25)).toBe(false);
  });
});

describe('jestSportemSetowym / jestKoszykowka', () => {
  it('siatkówka i plażówka są setowe, reszta nie', () => {
    expect(jestSportemSetowym('siatkówka')).toBe(true);
    expect(jestSportemSetowym('siatkówka plażowa')).toBe(true);
    expect(jestSportemSetowym('piłka nożna')).toBe(false);
    expect(jestSportemSetowym('koszykówka')).toBe(false);
  });

  it('tylko koszykówka liczy punkty 1/2/3', () => {
    expect(jestKoszykowka('koszykówka')).toBe(true);
    expect(jestKoszykowka('piłka nożna')).toBe(false);
  });
});
