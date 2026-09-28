import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

// Z-2 (docs/faza1-runda10-plan.md, migracja 169): `zaproponujPowiadomienia()`
// wołał dotąd wyłącznie zapis gracza, więc organizator nigdy nie widział tej
// zachęty — mimo że to on traci najwięcej, nie dostając pusha o prośbach
// o dołączenie i rozliczeniu po meczu. Ten test pilnuje, że prop `organizator`
// zamienia treść paska, a bez zdarzenia `zaproponujPowiadomienia()` pasek
// w ogóle się nie pokazuje (nie jest to przypomnienie, tylko propozycja
// w konkretnym momencie).

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/ZachetaInstalacji', () => ({ zaproponujInstalacje: vi.fn() }));

const stanPush = vi.fn();
vi.mock('@/lib/push', () => ({
  czyZachetaOdlozona: () => false,
  odlozZachetePush: vi.fn(),
  wlaczPush: vi.fn(),
  stanPush: (...a: unknown[]) => stanPush(...a),
}));

import ZachetaPush, { zaproponujPowiadomienia } from '@/components/events/ZachetaPush';

describe('ZachetaPush — propozycja dla organizatora (Z-2)', () => {
  beforeEach(() => { stanPush.mockReset(); stanPush.mockResolvedValue('wylaczone'); });
  afterEach(cleanup);

  it('bez zdarzenia zaproponujPowiadomienia() pasek się nie pokazuje', () => {
    render(<ZachetaPush widoczna organizator />);
    expect(screen.queryByRole('dialog', { name: 'Włącz powiadomienia' })).toBeNull();
  });

  it('zdarzenie + organizator: treść mówi o prośbach o dołączenie i rozliczeniu', async () => {
    render(<ZachetaPush widoczna organizator />);
    await act(async () => { zaproponujPowiadomienia(); });
    await screen.findByText('Damy znać, gdy ktoś poprosi o miejsce');
    expect(screen.getByText(/Prośba o dołączenie, komplet w składzie i przypomnienie o rozliczeniu/))
      .toBeTruthy();
  });

  it('zdarzenie bez organizator: treść gracza, nie organizatora', async () => {
    render(<ZachetaPush widoczna />);
    await act(async () => { zaproponujPowiadomienia(); });
    await screen.findByText('Damy znać, gdy coś się zmieni');
    expect(screen.queryByText(/Prośba o dołączenie/)).toBeNull();
  });
});
