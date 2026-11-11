import { describe, expect, it } from 'vitest';
import { chwilaWPolsce, instantZCzasuPolskiego } from '@/lib/czasPolski';
import { etykietaTerminuMeczu } from '@/lib/turniejEtykiety';

// Turniej w Luboniu (audyt 6 i 7, 2026-11-11): start 10:00, a karty meczów
// pokazywały 09:00, bo godzina była wycinana wprost z `…T09:00:00+00:00`.
describe('godzina meczu w czasie polskim', () => {
  it('chwila z bazy w UTC wraca jako godzina w Warszawie (zima, UTC+1)', () => {
    expect(chwilaWPolsce('2026-11-28T09:00:00+00:00')).toEqual({ data: '2026-11-28', godzina: '10:00' });
  });

  it('latem przesunięcie to dwie godziny (UTC+2)', () => {
    expect(chwilaWPolsce('2026-06-20T08:30:00Z').godzina).toBe('10:30');
  });

  it('start turnieju w czasie polskim zamienia się na poprawną chwilę UTC', () => {
    expect(instantZCzasuPolskiego('2026-11-28', '10:00')).toBe('2026-11-28T09:00:00.000Z');
    expect(instantZCzasuPolskiego('2026-06-20', '10:30:00')).toBe('2026-06-20T08:30:00.000Z');
  });

  it('dzień zmiany czasu (29 marca 2026) liczy się bez przesunięcia o godzinę', () => {
    expect(instantZCzasuPolskiego('2026-03-29', '10:00')).toBe('2026-03-29T08:00:00.000Z');
  });

  it('w obie strony: z polskiej godziny i z powrotem', () => {
    const iso = instantZCzasuPolskiego('2026-11-28', '09:20');
    expect(chwilaWPolsce(iso).godzina).toBe('09:20');
  });

  it('etykieta karty meczu mówi godzinę polską', () => {
    const dzisiaj = new Date('2026-11-11T12:00:00Z');
    expect(etykietaTerminuMeczu('2026-11-28T09:00:00+00:00', dzisiaj)).toContain('10:00');
  });
});
