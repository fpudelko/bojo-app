import { describe, it, expect, vi } from 'vitest';

// `lib/recurring` importuje klienta Supabase na poziomie modułu; testujemy
// czyste funkcje daty, więc klient wystarczy zaślepić.
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@/lib/events', () => ({ createEvent: () => Promise.resolve() }));

import { nastepnyTermin, dniDo, domyslnyTerminPowtorki } from '@/lib/recurring';

// Poniedziałek 2026-08-10, 09:00. ISO: pon=1 … niedz=7.
const PONIEDZIALEK = new Date(2026, 7, 10, 9, 0, 0);

describe('nastepnyTermin', () => {
  it('wskazuje najbliższy dzień tygodnia w przód', () => {
    expect(nastepnyTermin(3, '18:00', PONIEDZIALEK)).toBe('2026-08-12'); // środa
    expect(nastepnyTermin(7, '22:00', PONIEDZIALEK)).toBe('2026-08-16'); // niedziela
  });

  it('dziś przed godziną meczu → dziś', () => {
    expect(nastepnyTermin(1, '18:00', PONIEDZIALEK)).toBe('2026-08-10');
  });

  // Ten sam warunek co w SQL: bez niego „następny termin" pokazywałby mecz,
  // który już się skończył kilka godzin temu.
  it('dziś po godzinie meczu → za tydzień', () => {
    expect(nastepnyTermin(1, '08:00', PONIEDZIALEK)).toBe('2026-08-17');
  });

  it('godzina równa bieżącej liczy się jako miniona', () => {
    expect(nastepnyTermin(1, '09:00', PONIEDZIALEK)).toBe('2026-08-17');
  });

  // Data ma być lokalna. `toISOString()` przeliczyłby ją na UTC i tuż po
  // północy w naszej strefie cofnąłby wynik o dzień.
  it('nie gubi dnia tuż po północy', () => {
    const tuzPoPolnocy = new Date(2026, 7, 12, 0, 30, 0); // środa 00:30
    expect(nastepnyTermin(3, '20:00', tuzPoPolnocy)).toBe('2026-08-12');
  });

  it('przechodzi przez granicę miesiąca', () => {
    const koniecMiesiaca = new Date(2026, 7, 30, 9, 0, 0); // niedziela 30.08
    expect(nastepnyTermin(2, '19:00', koniecMiesiaca)).toBe('2026-09-01');
  });
});

describe('dniDo', () => {
  it('liczy dni kalendarzowe, nie różnicę godzin', () => {
    expect(dniDo('2026-08-10', PONIEDZIALEK)).toBe(0);
    expect(dniDo('2026-08-11', PONIEDZIALEK)).toBe(1);
    expect(dniDo('2026-08-16', PONIEDZIALEK)).toBe(6);
    expect(dniDo('2026-08-09', PONIEDZIALEK)).toBe(-1);
  });
});

// "Powtórz mecz" — okno otwierało się z pustym polem daty; te testy pilnują,
// że domyślny termin trafia na ten sam dzień tygodnia co pierwowzór, zawsze
// w przyszłości.
describe('domyslnyTerminPowtorki', () => {
  it('mecz sprzed miesiąca → najbliższa przyszła sobota, nie sobota sprzed trzech tygodni', () => {
    // 2026-07-11 to sobota; PONIEDZIALEK to 2026-08-10.
    expect(domyslnyTerminPowtorki('2026-07-11', '18:00', PONIEDZIALEK)).toBe('2026-08-15');
  });

  it('mecz dzisiejszy o godzinie już minionej → za tydzień, ten sam dzień', () => {
    expect(domyslnyTerminPowtorki('2026-08-10', '08:00', PONIEDZIALEK)).toBe('2026-08-17');
  });

  it('mecz dzisiejszy o godzinie jeszcze przyszłej → dziś', () => {
    expect(domyslnyTerminPowtorki('2026-08-10', '18:00', PONIEDZIALEK)).toBe('2026-08-10');
  });

  it('zachowuje dzień tygodnia niedzielnego pierwowzoru', () => {
    // 2026-08-02 to niedziela.
    expect(domyslnyTerminPowtorki('2026-08-02', '20:00', PONIEDZIALEK)).toBe('2026-08-16');
  });
});
