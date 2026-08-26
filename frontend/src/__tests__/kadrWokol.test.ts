import { describe, it, expect } from 'vitest';

import { kadrWokol } from '@/lib/api';

/** Matematyka kadru „co jest blisko" — dotąd wpisana w jedno zapytanie
 *  i nigdy nie sprawdzona. */
describe('kadrWokol', () => {
  it('szerokość rośnie o ~1 stopień na 111 km', () => {
    const k = kadrWokol(52, 17, 111);
    expect(k.latMax - 52).toBeCloseTo(1, 2);
    expect(52 - k.latMin).toBeCloseTo(1, 2);
  });

  it('kadr jest wyśrodkowany na punkcie', () => {
    const k = kadrWokol(52.4, 16.9, 15);
    expect((k.latMin + k.latMax) / 2).toBeCloseTo(52.4, 6);
    expect((k.lngMin + k.lngMax) / 2).toBeCloseTo(16.9, 6);
  });

  it('nad Polską kadr jest SZERSZY w stopniach długości niż szerokości', () => {
    // Bez poprawki na cosinus szerokości kwadrat 15 km × 15 km wyszedłby
    // o jakąś trzecią za wąski w poziomie.
    const k = kadrWokol(52, 17, 15);
    const wysokosc = k.latMax - k.latMin;
    const szerokosc = k.lngMax - k.lngMin;
    expect(szerokosc).toBeGreaterThan(wysokosc * 1.5);
  });

  it('im dalej na północ, tym szerszy kadr w stopniach długości', () => {
    const polska = kadrWokol(52, 17, 15);
    const polnoc = kadrWokol(69, 17, 15);
    expect(polnoc.lngMax - polnoc.lngMin).toBeGreaterThan(polska.lngMax - polska.lngMin);
  });
});
