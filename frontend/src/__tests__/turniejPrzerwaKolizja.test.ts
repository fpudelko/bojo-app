import { describe, expect, it } from 'vitest';
import { meczeNachodzaceNaPrzerwe, przesuniecieZaPrzerwe } from '@/lib/turniejEtykiety';

// Przerwa 12:40–13:00 (UTC 11:40–12:00), mecze po 12 min co 14 min.
const mecz = (id: string, hhmm: string, status: 'zaplanowany' | 'zakonczony' = 'zaplanowany') =>
  ({ id, status, zaplanowanyAt: `2026-11-28T${hhmm}:00.000Z` });
const mecze = [mecz('a', '11:16'), mecz('b', '11:30'), mecz('c', '11:44'), mecz('d', '11:58'), mecz('e', '12:12')];
const OD = '2026-11-28T11:40:00.000Z';
const DO = '2026-11-28T12:00:00.000Z';

describe('przerwa nachodząca na mecze', () => {
  it('wskazuje mecze, których czas gry przecina przerwę', () => {
    expect(meczeNachodzaceNaPrzerwe(mecze, OD, DO, 12).map((m) => m.id)).toEqual(['b', 'c', 'd']);
  });

  it('pomija mecze rozegrane', () => {
    expect(meczeNachodzaceNaPrzerwe([mecz('b', '11:30', 'zakonczony')], OD, DO, 12)).toEqual([]);
  });

  it('przesuwa od pierwszego kolidującego meczu o tyle samo, zachowując odstępy', () => {
    const p = przesuniecieZaPrzerwe(mecze, OD, DO, 12);
    expect(p.map((x) => [x.id, x.zaplanowanyAt.slice(11, 16)])).toEqual([
      ['b', '12:00'], ['c', '12:14'], ['d', '12:28'], ['e', '12:42'],
    ]);
  });

  it('bez kolizji nic nie przesuwa', () => {
    expect(przesuniecieZaPrzerwe([mecz('a', '11:16')], OD, DO, 12)).toEqual([]);
  });
});
