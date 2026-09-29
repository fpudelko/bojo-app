import { describe, it, expect } from 'vitest';
import { datyHero } from '@/lib/datyHero';

describe('datyHero: daty w animacji na pierwszym ekranie', () => {
  it('wtorek 29.09.2026: jutro to środa, mecz w czwartek za 2 dni', () => {
    const d = datyHero('2026-09-29');
    expect(d.start).toBe('30.09.2026');
    expect(d.startOpis).toBe('środa, 30 września · jutro');
    expect(d.cel).toBe('01.10.2026');
    expect(d.celOpis).toBe('czwartek, 1 października · za 2 dni');
    expect(d.celDluga).toBe('czwartek, 1 października');
    expect(d.celDlugaWielka).toBe('Czwartek, 1 października');
  });

  it('poniedziałek: mecz w czwartek za 3 dni', () => {
    expect(datyHero('2026-09-28').celOpis).toBe('czwartek, 1 października · za 3 dni');
  });

  it('środa: jutro jest czwartkiem, ale mecz idzie na następny (najwcześniej za 2 dni)', () => {
    const d = datyHero('2026-09-30');
    expect(d.start).toBe('01.10.2026');
    expect(d.cel).toBe('08.10.2026');
    expect(d.celOpis).toBe('czwartek, 8 października · za 8 dni');
  });

  it('czwartek: następny czwartek za 7 dni', () => {
    expect(datyHero('2026-10-01').celOpis).toBe('czwartek, 8 października · za 7 dni');
  });

  it('piątek i sobota', () => {
    expect(datyHero('2026-10-02').celOpis).toBe('czwartek, 8 października · za 6 dni');
    expect(datyHero('2026-10-03').celOpis).toBe('czwartek, 8 października · za 5 dni');
  });

  it('przełom roku: 30.12.2026', () => {
    const d = datyHero('2026-12-30');
    expect(d.start).toBe('31.12.2026');
    expect(d.cel).toBe('07.01.2027');
    expect(d.celDluga).toBe('czwartek, 7 stycznia');
  });

  it('zawsze czwartek, zawsze co najmniej 2 dni i nigdy więcej niż 8', () => {
    for (let dzien = 0; dzien < 400; dzien++) {
      const iso = new Date(Date.UTC(2026, 0, 1 + dzien)).toISOString().slice(0, 10);
      const d = datyHero(iso);
      expect(d.celDluga.startsWith('czwartek')).toBe(true);
      const za = Number(/za (\d+) dni/.exec(d.celOpis)![1]);
      expect(za).toBeGreaterThanOrEqual(2);
      expect(za).toBeLessThanOrEqual(8);
    }
  });
});
