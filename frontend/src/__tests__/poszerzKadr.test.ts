import { describe, it, expect } from 'vitest';
import { poszerzKadr } from '@/lib/api';

// A1 z raportu QA: przy dużym przybliżeniu (z16+) ciasny kadr potrafił być
// węższy niż niepewność położenia punktu z importu OSM, więc realnie widoczne
// boisko znikało z listy wyników. `poszerzKadr()` pyta o więcej, niż faktycznie
// widać, zachowując środek kadru.
describe('poszerzKadr', () => {
  it('zachowuje środek kadru', () => {
    const kadr = { latMin: 52.0, latMax: 52.1, lngMin: 16.9, lngMax: 17.0 };
    const wynik = poszerzKadr(kadr);
    expect((wynik.latMin + wynik.latMax) / 2).toBeCloseTo((kadr.latMin + kadr.latMax) / 2);
    expect((wynik.lngMin + wynik.lngMax) / 2).toBeCloseTo((kadr.lngMin + kadr.lngMax) / 2);
  });

  it('powiększa kadr o domyślny współczynnik 1,6×', () => {
    const kadr = { latMin: 52.0, latMax: 52.1, lngMin: 16.9, lngMax: 17.0 };
    const wynik = poszerzKadr(kadr);
    expect(wynik.latMax - wynik.latMin).toBeCloseTo((kadr.latMax - kadr.latMin) * 1.6);
    expect(wynik.lngMax - wynik.lngMin).toBeCloseTo((kadr.lngMax - kadr.lngMin) * 1.6);
  });

  it('respektuje przekazany współczynnik', () => {
    const kadr = { latMin: 0, latMax: 10, lngMin: 0, lngMax: 20 };
    const wynik = poszerzKadr(kadr, 2);
    expect(wynik.latMin).toBeCloseTo(-5);
    expect(wynik.latMax).toBeCloseTo(15);
    expect(wynik.lngMin).toBeCloseTo(-10);
    expect(wynik.lngMax).toBeCloseTo(30);
  });
});
