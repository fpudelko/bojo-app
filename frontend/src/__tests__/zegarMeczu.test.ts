import { describe, it, expect } from 'vitest';
import {
  fazaZegara, sekundyPolowy, formatZegara, minutaMeczu, poCzasiePolowy, opisZegara,
  startZegara, pauzaZegara, koniecPolowy,
} from '@/lib/zegarMeczu';

// Zegar meczu (182): nie rusza sam, tylko po „Start” (zgłoszenie 2026-11-22).
const t = (s: string) => new Date(`2026-11-28T10:${s}Z`);

describe('zegar meczu', () => {
  it('po wejściu w tryb na żywo stoi na 0:00 i czeka na start', () => {
    const m = { zegarSekundy: 0, polowa: 1 as const };
    expect(fazaZegara(m)).toBe('czeka');
    expect(sekundyPolowy(m, t('05:00'))).toBe(0);
    expect(opisZegara(m, t('05:00'))).toBe('Za chwilę start');
  });

  it('start, pauza i wznowienie liczą tylko czas gry', () => {
    let m: { zegarOd?: string | null; zegarSekundy: number; polowa: 1 | 2 } = { zegarSekundy: 0, polowa: 1 };
    m = { ...m, ...startZegara(m, t('00:00')) };
    expect(fazaZegara(m)).toBe('gra');
    expect(formatZegara(sekundyPolowy(m, t('02:30')))).toBe('02:30');
    m = { ...m, ...pauzaZegara(m, t('02:30')) };
    expect(fazaZegara(m)).toBe('pauza');
    expect(sekundyPolowy(m, t('09:00'))).toBe(150); // pauza nie liczy
    m = { ...m, ...startZegara(m, t('09:00')) };
    expect(sekundyPolowy(m, t('10:00'))).toBe(210);
    expect(opisZegara(m, t('10:00'))).toBe('1. poł. 03:30');
  });

  it('koniec połowy: przerwa, a 2. połowa liczy od zera, minuta zdarzenia dolicza 1. połowę', () => {
    const przerwa = koniecPolowy();
    expect(fazaZegara(przerwa)).toBe('przerwa');
    const druga = { ...przerwa, ...startZegara(przerwa, t('00:00')) };
    expect(opisZegara(druga, t('01:05'))).toBe('2. poł. 01:05');
    expect(minutaMeczu(druga, t('03:10'), 12)).toBe(9); // 6 min 1. połowy + 3
  });

  it('po czasie połowy (połowa czasu meczu)', () => {
    const m = { zegarSekundy: 360, polowa: 1 as const };
    expect(poCzasiePolowy(m, t('00:00'), 12)).toBe(true);
    expect(poCzasiePolowy({ ...m, zegarSekundy: 359 }, t('00:00'), 12)).toBe(false);
  });
});
