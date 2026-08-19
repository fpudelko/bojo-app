import { describe, it, expect } from 'vitest';
import { momentZapisu } from '@/lib/events';

describe('momentZapisu', () => {
  it('zwraca zapisanoAt, gdy jest ustawione', () => {
    expect(momentZapisu({ zapisanoAt: '2026-08-19T06:35:00Z', createdAt: '2026-08-18T00:06:00Z' }))
      .toBe('2026-08-19T06:35:00Z');
  });

  it('spada na createdAt, gdy zapisanoAt jest puste — baza bez migracji 110', () => {
    expect(momentZapisu({ createdAt: '2026-08-18T00:06:00Z' })).toBe('2026-08-18T00:06:00Z');
  });

  it('zwraca pusty string, gdy nie ma żadnego z pól', () => {
    expect(momentZapisu({})).toBe('');
  });

  it('sortowanie kolejki: kto potwierdził później, staje ZA kimś, kto zapisał się w międzyczasie', () => {
    // Obserwujący od wczoraj 00:06, ale dołączył dopiero dziś 6:35.
    const obserwujacyPotemDolaczyl = {
      id: 'a', zapisanoAt: '2026-08-19T06:35:00Z', createdAt: '2026-08-18T00:06:00Z',
    };
    // Ktoś, kto zapisał się wprost dziś o 3:00 — w kolejce ma być PRZED powyższym.
    const zapisanyWMiedzyczasie = {
      id: 'b', zapisanoAt: '2026-08-19T03:00:00Z', createdAt: '2026-08-19T03:00:00Z',
    };
    const posortowane = [obserwujacyPotemDolaczyl, zapisanyWMiedzyczasie]
      .sort((x, y) => momentZapisu(x).localeCompare(momentZapisu(y)));
    expect(posortowane.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
