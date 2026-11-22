import { describe, it, expect } from 'vitest';
import { turniejeNaMojeMecze, MARKER_PROBY, type MojTurniej, type RolaWTurnieju } from '@/lib/turnieje';
import type { Turniej } from '@/types';

// „Twoje turnieje” na /moje-gry (2026-11-22): co trafia na konto, a co nie.

const t = (id: string, n: Partial<Turniej>, rola: RolaWTurnieju = 'grasz'): MojTurniej => ({
  turniej: { id, nazwa: id, status: 'zapisy', dataStartu: '2026-11-28', opis: '', ...n } as Turniej,
  rola,
});

describe('turniejeNaMojeMecze', () => {
  const dzis = '2026-11-22';

  it('zostawia nadchodzące i trwające, w których grasz albo które obserwujesz', () => {
    const wynik = turniejeNaMojeMecze([
      t('a', {}),
      t('b', { status: 'trwa', dataStartu: '2026-11-22' }, 'obserwujesz'),
    ], dzis);
    expect(wynik.map((m) => m.turniej.id)).toEqual(['a', 'b']);
  });

  it('chowa próbę i odwołany', () => {
    const wynik = turniejeNaMojeMecze([
      t('proba', { opis: `${MARKER_PROBY} kopia` }, 'organizujesz'),
      t('odw', { status: 'odwolany' }),
    ], dzis);
    expect(wynik).toEqual([]);
  });

  it('zakończony zostaje 3 dni, potem znika', () => {
    const wynik = turniejeNaMojeMecze([
      t('swiezy', { status: 'zakonczony', dataStartu: '2026-11-19' }),
      t('stary', { status: 'zakonczony', dataStartu: '2026-11-18' }),
    ], dzis);
    expect(wynik.map((m) => m.turniej.id)).toEqual(['swiezy']);
  });

  it('szkic widzi tylko ten, kto go przygotowuje', () => {
    const wynik = turniejeNaMojeMecze([
      t('moj', { status: 'szkic' }, 'organizujesz'),
      t('wspol', { status: 'szkic' }, 'wspolorganizujesz'),
      t('cudzy', { status: 'szkic' }, 'obserwujesz'),
    ], dzis);
    expect(wynik.map((m) => m.turniej.id)).toEqual(['moj', 'wspol']);
  });
});
