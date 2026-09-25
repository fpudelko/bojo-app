import { describe, it, expect } from 'vitest';
import { terazWPolsce, czyPrzedStartemWPolsce } from '@/lib/czasPolski';

// W-3 (docs/faza1-przejscie-e2e-plan.md): serwer stoi na UTC, gracz jest
// w Warszawie. Wynik NIE może zależeć od strefy procesu, w którym leci test.

describe('terazWPolsce', () => {
  it('latem (UTC+2) po 22:00 UTC w Polsce jest już następny dzień', () => {
    expect(terazWPolsce(new Date('2026-07-01T22:30:00Z'))).toEqual({ data: '2026-07-02', godzina: '00:30' });
  });

  it('zimą (UTC+1) po 23:00 UTC w Polsce jest już następny dzień', () => {
    expect(terazWPolsce(new Date('2026-12-01T23:30:00Z'))).toEqual({ data: '2026-12-02', godzina: '00:30' });
  });

  it('środek dnia: tylko przesunięcie godziny', () => {
    expect(terazWPolsce(new Date('2026-09-25T16:04:59Z'))).toEqual({ data: '2026-09-25', godzina: '18:04' });
  });
});

describe('czyPrzedStartemWPolsce', () => {
  const teraz = { data: '2026-09-25', godzina: '18:04' };

  it('mecz o 18:00 tego samego dnia już się zaczął (serwer w UTC twierdził, że nie)', () => {
    expect(czyPrzedStartemWPolsce('2026-09-25', '18:00:00', teraz)).toBe(false);
  });

  it('mecz o 20:00 tego dnia jeszcze przed startem', () => {
    expect(czyPrzedStartemWPolsce('2026-09-25', '20:00:00', teraz)).toBe(true);
  });

  it('dzień wcześniej — po, dzień później — przed', () => {
    expect(czyPrzedStartemWPolsce('2026-09-24', '23:00', teraz)).toBe(false);
    expect(czyPrzedStartemWPolsce('2026-09-26', '06:00', teraz)).toBe(true);
  });

  it('brak godziny liczy się jak koniec dnia', () => {
    expect(czyPrzedStartemWPolsce('2026-09-25', undefined, teraz)).toBe(true);
    expect(czyPrzedStartemWPolsce('2026-09-25', null, { data: '2026-09-25', godzina: '23:59' })).toBe(false);
  });

  it('dokładnie godzina startu to już start', () => {
    expect(czyPrzedStartemWPolsce('2026-09-25', '18:04', teraz)).toBe(false);
  });
});
