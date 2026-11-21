import { describe, expect, it } from 'vitest';
import { strzelcyMeczu, znacznikFazy } from '@/lib/turniejEtykiety';
import type { TurniejGrupa, TurniejZdarzenie } from '@/types';

const zd = (p: Partial<TurniejZdarzenie>): TurniejZdarzenie => ({
  id: Math.random().toString(), meczId: 'm1', turniejId: 't', druzynaId: 'A', typ: 'gol', wartosc: 1, createdAt: '', ...p,
});

describe('wiersz wyniku', () => {
  const grupy = new Map<string, TurniejGrupa>([['g1', { id: 'g1', turniejId: 't', nazwa: 'A' } as TurniejGrupa]]);

  it('znacznik: litera grupy albo skrót fazy', () => {
    expect(znacznikFazy({ faza: 'grupa', grupaId: 'g1' }, grupy)).toBe('A');
    expect(znacznikFazy({ faza: 'polfinal' }, grupy)).toBe('½');
    expect(znacznikFazy({ faza: 'final' }, grupy)).toBe('Finał');
  });

  it('strzelcy po stronach, samobój dla rywala, bez nazwiska „gol”', () => {
    const mecz = { id: 'm1', druzynaAId: 'A', druzynaBId: 'B' };
    const z = [
      zd({ zawodnikId: 'z1', minuta: 3 }),
      zd({ druzynaId: 'B', zawodnikId: 'z2', typ: 'samobojczy' }),
      zd({ druzynaId: 'B' }),
      zd({ druzynaId: 'B', typ: 'zolta', zawodnikId: 'z2' }),
      zd({ meczId: 'inny', zawodnikId: 'z1' }),
    ];
    const imiona = new Map([['z1', 'Kowalski'], ['z2', 'Nowak']]);
    expect(strzelcyMeczu(mecz, z, imiona)).toEqual({
      a: ["Kowalski 3'", 'Nowak (sam.)'],
      b: ['gol'],
    });
  });
});
