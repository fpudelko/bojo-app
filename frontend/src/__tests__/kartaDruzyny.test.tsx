import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import KartaDruzyny from '@/components/turnieje/KartaDruzyny';
import { meczeDruzyny } from '@/lib/turniejWynik';
import type { TurniejDruzyna, TurniejMecz } from '@/types';

// Karta drużyny na stronie turnieju (2026-11-22, decyzja właściciela): po
// rozwinięciu najbliższy mecz i wyniki tej drużyny, nie skład. Skład
// z odnośnikami do profili żyje na ekranie drużyny, do którego prowadzi
// „Zobacz mecze i skład”.

afterEach(cleanup);

const druzyna: TurniejDruzyna = {
  id: 'd1', turniejId: 't1', nazwa: 'Dragon Team', status: 'przyjeta',
  kodDolaczenia: 'ABC123', dodanaRecznie: true, liczbaZawodnikow: 7, createdAt: '2026-09-01T10:00:00Z',
};

const mecz = (n: Partial<TurniejMecz> & { numer: number }): TurniejMecz => ({
  id: `m${n.numer}`, turniejId: 't1', faza: 'grupa', status: 'zaplanowany',
  wynikA: 0, wynikB: 0, wynikRecznie: false, druzynaAId: 'd1', druzynaBId: 'd2',
  zaplanowanyAt: `2026-11-28T${String(8 + n.numer).padStart(2, '0')}:00:00Z`,
  createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z', ...n,
} as TurniejMecz);

const NAZWY: Record<string, string> = { d1: 'Dragon Team', d2: 'Wilki', d3: 'Orły' };
const nazwaSlotu = (m: TurniejMecz, s: 'a' | 'b') => NAZWY[(s === 'a' ? m.druzynaAId : m.druzynaBId) ?? ''] ?? '?';

const mecze = [
  mecz({ numer: 1, status: 'zakonczony', wynikA: 3, wynikB: 1, zwyciezcaId: 'd1' }),
  mecz({ numer: 2, status: 'zakonczony', druzynaAId: 'd3', druzynaBId: 'd1', wynikA: 2, wynikB: 0, zwyciezcaId: 'd3' }),
  mecz({ numer: 3, druzynaBId: 'd3' }),
  mecz({ numer: 4, druzynaAId: 'd2', druzynaBId: 'd3' }), // nie nasz
];

function rozwin(czyMoja = false) {
  render(<KartaDruzyny d={druzyna} zalogowany czyMoja={czyMoja} onZamienWEkipe={() => {}} mecze={mecze} nazwaSlotu={nazwaSlotu} />);
  fireEvent.click(screen.getByRole('button', { name: /Pokaż mecze/ }));
}

describe('KartaDruzyny', () => {
  it('po rozwinięciu pokazuje najbliższy mecz z przeciwnikiem i wyniki z perspektywy drużyny', () => {
    rozwin();
    // Najbliższy mecz (M3) z Orłami, pierwszy odnośnik do meczu w karcie.
    expect(screen.getAllByRole('link').find((l) => l.getAttribute('href') === '/turnieje/t1/mecz/m3')?.textContent).toContain('z Orły');
    // Wygrana 3:1 z Wilkami i porażka 0:2 z Orłami: własne gole pierwsze.
    expect(screen.getByText('3:1')).toBeDefined();
    expect(screen.getByText('0:2')).toBeDefined();
    expect(screen.getByLabelText('Zwycięstwo')).toBeDefined();
    expect(screen.getByLabelText('Porażka')).toBeDefined();
  });

  it('nie pokazuje składu, tylko wejście „Zobacz mecze i skład” na ekran drużyny', () => {
    rozwin();
    expect(screen.getByRole('link', { name: /Zobacz mecze i skład/ })).toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
    expect(screen.queryByText(/Skład drużyny/)).toBeNull();
  });

  it('kapitan widzi „Zarządzaj drużyną”', () => {
    rozwin(true);
    expect(screen.getByRole('link', { name: /Zarządzaj drużyną/ })).toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
  });

  it('wyniki i najbliższy mecz prowadzą na stronę meczu', () => {
    rozwin();
    expect(screen.getByRole('link', { name: /3:1/ })).toHaveAttribute('href', '/turnieje/t1/mecz/m1');
  });

  it('nazwa drużyny jest odnośnikiem, a karta jest zwinięta, dopóki ktoś jej nie otworzy', () => {
    render(<KartaDruzyny d={druzyna} zalogowany czyMoja={false} onZamienWEkipe={() => {}} mecze={mecze} nazwaSlotu={nazwaSlotu} />);
    expect(screen.getByRole('link', { name: /Dragon Team/ })).toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
    expect(screen.getByRole('button', { name: /Pokaż mecze/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('3:1')).toBeNull();
  });
});

describe('meczeDruzyny', () => {
  it('najbliższy to trwający, potem najwcześniejszy; wyniki od najświeższego', () => {
    const { najblizszy, wyniki } = meczeDruzyny(mecze, 'd1');
    expect(najblizszy?.numer).toBe(3);
    expect(wyniki.map((w) => [w.mecz.numer, w.bilans, w.zdobyte, w.stracone])).toEqual([[2, 'P', 0, 2], [1, 'Z', 3, 1]]);
    const zTrwajacym = meczeDruzyny([...mecze, mecz({ numer: 9, status: 'trwa' })], 'd1');
    expect(zTrwajacym.najblizszy?.numer).toBe(9);
  });

  it('remis bez zwycięzcy to R, wolny los się nie liczy', () => {
    const { wyniki } = meczeDruzyny([
      mecz({ numer: 1, status: 'zakonczony', wynikA: 1, wynikB: 1 }),
      mecz({ numer: 2, status: 'walkower', druzynaBId: undefined, zwyciezcaId: 'd1' }),
    ], 'd1');
    expect(wyniki.map((w) => w.bilans)).toEqual(['R']);
  });
});
