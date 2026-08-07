import { describe, it, expect } from 'vitest';
import { plural, withCount } from '@/lib/plural';

const mecz = (n: number) => plural(n, 'mecz', 'mecze', 'meczy');
const czlonek = (n: number) => plural(n, 'członek', 'członkowie', 'członków');

describe('plural — forma pojedyncza', () => {
  it('1 bierze formę pojedynczą', () => {
    expect(mecz(1)).toBe('mecz');
  });

  it('0 bierze formę dopełniaczową, nie pojedynczą', () => {
    expect(mecz(0)).toBe('meczy');
  });
});

describe('plural — 2-4 biorą formę "few"', () => {
  it.each([2, 3, 4])('%i', (n) => {
    expect(mecz(n)).toBe('mecze');
  });
});

describe('plural — 5-9 i 10-11 biorą formę "many"', () => {
  it.each([5, 6, 9, 10, 11])('%i', (n) => {
    expect(mecz(n)).toBe('meczy');
  });
});

describe('plural — nastolatki 12-14 to wyjątek', () => {
  // To jest cała racja bytu tego modułu: stara reguła `n < 5` dawała tu
  // "mecze", bo patrzyła na całą liczbę zamiast na dwie ostatnie cyfry.
  it.each([12, 13, 14])('%i bierze formę "many", mimo końcówki 2/3/4', (n) => {
    expect(mecz(n)).toBe('meczy');
  });
});

describe('plural — dziesiątki wyżej wracają do normalnej reguły', () => {
  it.each([22, 23, 24, 32, 104])('%i bierze formę "few"', (n) => {
    expect(mecz(n)).toBe('mecze');
  });

  it.each([25, 30, 101, 111, 112])('%i bierze formę "many"', (n) => {
    expect(mecz(n)).toBe('meczy');
  });
});

describe('plural — odporność na wejście', () => {
  it('liczby ujemne traktuje jak dodatnie', () => {
    expect(mecz(-3)).toBe('mecze');
    expect(mecz(-1)).toBe('mecz');
  });

  it('ucina część ułamkową', () => {
    expect(mecz(2.7)).toBe('mecze');
  });

  it('101 to nie to samo co 1', () => {
    expect(mecz(101)).toBe('meczy');
  });
});

describe('plural — druga odmiana używana w grupach', () => {
  it('poprawnie odmienia członków', () => {
    expect(czlonek(1)).toBe('członek');
    expect(czlonek(3)).toBe('członkowie');
    expect(czlonek(5)).toBe('członków');
    expect(czlonek(13)).toBe('członków');
    expect(czlonek(22)).toBe('członkowie');
  });
});

describe('withCount', () => {
  it('skleja liczbę z odmienioną formą', () => {
    expect(withCount(1, 'mecz', 'mecze', 'meczy')).toBe('1 mecz');
    expect(withCount(3, 'mecz', 'mecze', 'meczy')).toBe('3 mecze');
    expect(withCount(13, 'mecz', 'mecze', 'meczy')).toBe('13 meczy');
  });
});
