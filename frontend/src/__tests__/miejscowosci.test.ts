import { describe, it, expect } from 'vitest';
import { odsiejDuplikatyMiejscowosci as odsiejDuplikaty } from '@/lib/miejscowosci';

describe('odsiejDuplikatyMiejscowosci', () => {
  // Nominatim potrafi zwrócić tę samą miejscowość dwukrotnie (dwa różne
  // obiekty OSM) — podpowiedzi filtra pokazywały dwa identyczne wiersze pod
  // sobą. Zgłoszone wprost z sesji QA.
  it('usuwa wpisy o tej samej nazwie i kontekście', () => {
    const wynik = odsiejDuplikaty([
      { nazwa: 'Poznań', kontekst: 'powiat poznański · wielkopolskie', lat: 52.4, lng: 16.9 },
      { nazwa: 'Poznań', kontekst: 'powiat poznański · wielkopolskie', lat: 52.40001, lng: 16.90001 },
      { nazwa: 'Poznań', kontekst: 'powiat poznański · wielkopolskie', lat: 52.5, lng: 17.0 },
    ]);
    expect(wynik).toHaveLength(1);
    expect(wynik[0].lat).toBe(52.4);
  });

  it('nie miesza dwóch różnych miejscowości o tej samej nazwie', () => {
    const wynik = odsiejDuplikaty([
      { nazwa: 'Nowa Wieś', kontekst: 'powiat poznański · wielkopolskie', lat: 1, lng: 1 },
      { nazwa: 'Nowa Wieś', kontekst: 'powiat lubelski · lubelskie', lat: 2, lng: 2 },
    ]);
    expect(wynik).toHaveLength(2);
  });

  it('porównuje bez rozróżniania wielkości liter', () => {
    const wynik = odsiejDuplikaty([
      { nazwa: 'Poznań', kontekst: 'Wielkopolskie', lat: 1, lng: 1 },
      { nazwa: 'poznań', kontekst: 'wielkopolskie', lat: 2, lng: 2 },
    ]);
    expect(wynik).toHaveLength(1);
  });

  it('pusta lista zostaje pusta', () => {
    expect(odsiejDuplikaty([])).toEqual([]);
  });
});
