import { describe, it, expect } from 'vitest';
import { mozeEdytowacSklad, brakiWSkladzie } from '@/lib/turniejDruzyny';

describe('mozeEdytowacSklad', () => {
  it('wolno edytować, gdy turniej trwa zapisy i drużyna jest zgłoszona', () => {
    expect(mozeEdytowacSklad({ status: 'zapisy' }, { status: 'zgloszona' })).toBe(true);
  });

  it('wolno edytować, gdy turniej trwa (skład dogrywa się w trakcie)', () => {
    expect(mozeEdytowacSklad({ status: 'trwa' }, { status: 'przyjeta' })).toBe(true);
  });

  it('nie wolno, gdy turniej się zakończył', () => {
    expect(mozeEdytowacSklad({ status: 'zakonczony' }, { status: 'przyjeta' })).toBe(false);
  });

  it('nie wolno, gdy turniej odwołany', () => {
    expect(mozeEdytowacSklad({ status: 'odwolany' }, { status: 'przyjeta' })).toBe(false);
  });

  it('nie wolno, gdy drużyna odrzucona — nawet jeśli turniej wciąż trwa zapisy', () => {
    expect(mozeEdytowacSklad({ status: 'zapisy' }, { status: 'odrzucona' })).toBe(false);
  });

  it('nie wolno, gdy drużyna wycofana', () => {
    expect(mozeEdytowacSklad({ status: 'zapisy' }, { status: 'wycofana' })).toBe(false);
  });
});

describe('brakiWSkladzie', () => {
  it('liczy różnicę do minZawodnikow, nie do maxZawodnikow', () => {
    expect(brakiWSkladzie({ minZawodnikow: 7 }, 5)).toBe(2);
  });

  it('zero, gdy skład już spełnia minimum', () => {
    expect(brakiWSkladzie({ minZawodnikow: 7 }, 7)).toBe(0);
  });

  it('nigdy nie schodzi poniżej zera, gdy składu jest więcej niż minimum', () => {
    expect(brakiWSkladzie({ minZawodnikow: 7 }, 12)).toBe(0);
  });
});
