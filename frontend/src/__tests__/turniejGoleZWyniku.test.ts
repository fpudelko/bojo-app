import { describe, expect, it } from 'vitest';
import { goleZWyniku } from '@/lib/turniejMecze';

// Szybki wynik ze strzelcami (2026-11-08): wynik zawsze równa się sumie goli,
// wskazani strzelcy idą pierwsi, reszta bez strzelca.
describe('goleZWyniku', () => {
  it('uzupełnia brakujących strzelców golami bez nazwiska', () => {
    const gole = goleZWyniku('A', 'B', { wynikA: 3, wynikB: 1 }, { a: ['z1'], b: [] });
    expect(gole).toHaveLength(4);
    expect(gole.filter((g) => g.druzynaId === 'A').map((g) => g.zawodnikId)).toEqual(['z1', undefined, undefined]);
    expect(gole.filter((g) => g.druzynaId === 'B')).toHaveLength(1);
    expect(gole.every((g) => g.typ === 'gol' && g.wartosc === 1)).toBe(true);
  });

  it('strzelców ponad wynik obcina, a 0:0 nie daje żadnego gola', () => {
    expect(goleZWyniku('A', 'B', { wynikA: 1, wynikB: 0 }, { a: ['z1', 'z2'], b: ['z3'] }).map((g) => g.zawodnikId)).toEqual(['z1']);
    expect(goleZWyniku('A', 'B', { wynikA: 0, wynikB: 0 }, { a: [], b: [] })).toEqual([]);
  });
});
