import { describe, it, expect } from 'vitest';
import { nastepnaZakladka } from '@/lib/useSwipeZakladek';

// `wStrefieBezSwipe` (strażnik przewijania poziomego) zostaje bez testu —
// `scrollWidth`/`getComputedStyle` w jsdom zwracają zera i wartości domyślne
// niezależnie od realnego layoutu, więc test dawałby fałszywą pewność.

const ZAKLADKI = ['a', 'b', 'c'] as const;

describe('nastepnaZakladka', () => {
  it('gest krótszy niż próg — nic nie robi', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'b', 30, 0, 100)).toBeNull();
  });

  it('gest bardziej pionowy niż poziomy — to przewijanie strony, nie swipe', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'b', 70, 90, 100)).toBeNull();
  });

  it('gest wolniejszy niż limit czasu — nie liczy się jako swipe', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'b', 100, 0, 900)).toBeNull();
  });

  it('w lewo przechodzi na następną zakładkę', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'a', -100, 0, 100)).toBe('b');
  });

  it('w prawo przechodzi na poprzednią zakładkę', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'c', 100, 0, 100)).toBe('b');
  });

  it('bez zawijania: na pierwszej w prawo nic nie robi', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'a', 100, 0, 100)).toBeNull();
  });

  it('bez zawijania: na ostatniej w lewo nic nie robi', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'c', -100, 0, 100)).toBeNull();
  });

  it('zakładka spoza listy (np. zniknęła po zmianie stanu) — nic nie robi', () => {
    expect(nastepnaZakladka(ZAKLADKI, 'nieznana' as typeof ZAKLADKI[number], -100, 0, 100)).toBeNull();
  });
});
