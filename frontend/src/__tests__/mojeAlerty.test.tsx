import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { GameAlert } from '@/types';

// Lekkie atrapy zamiast prawdziwej sesji i Supabase: sprawdzana rzecz to
// TREŚĆ WIERSZA i to, że wyłączony alert zostaje na liście — a nie zapytania.
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/features', () => ({ SHOW_GAME_ALERTS: true, SHOW_SMS_FEATURES: false }));
vi.mock('@/components/home/AlertSetupDialog', () => ({ default: () => null }));

const alerty = vi.fn();
vi.mock('@/lib/alerts', async (oryginal) => ({
  ...(await oryginal<typeof import('@/lib/alerts')>()),
  getMojeAlerty: () => alerty(),
  ustawAktywnoscAlertu: vi.fn(),
  deleteMyAlert: vi.fn(),
}));

import MojeAlerty from '@/components/profil/MojeAlerty';

const alert = (n: Partial<GameAlert> = {}): GameAlert => ({
  id: 'a1', userId: 'u1', daysOfWeek: [], lat: 51.1, lng: 17.03, radiusKm: 25,
  isActive: true, createdAt: '2026-09-15T10:00:00Z', kanalEmail: true, ...n,
});

beforeEach(() => alerty.mockReset());
afterEach(cleanup);

describe('MojeAlerty — dom alertów w profilu', () => {
  it('pusta lista zaprasza, zamiast pokazywać gołą kartę', async () => {
    alerty.mockResolvedValue([]);
    render(<MojeAlerty />);
    expect(await screen.findByRole('button', { name: 'Ustaw pierwszy alert' })).toBeTruthy();
  });

  it('wiersz mówi, czego alert pilnuje — sport, miejsce, promień', async () => {
    alerty.mockResolvedValue([alert({ sport: 'piłka nożna', cityLabel: 'Wrocław' })]);
    render(<MojeAlerty />);
    expect(await screen.findByText('Piłka nożna · Wrocław 25 km')).toBeTruthy();
    expect(screen.getByText('bezterminowo · dzwonek i mail')).toBeTruthy();
  });

  it('WYŁĄCZONY alert zostaje na liście, a nie znika', async () => {
    // To jest cały sens przełącznika zamiast kasowania: kto wyłączył alert na
    // zimę, wraca do niego wiosną jednym dotknięciem. Gdyby wyłączone wiersze
    // znikały, jedyną drogą powrotu byłoby założenie alertu od nowa.
    alerty.mockResolvedValue([alert({ sport: 'siatkówka', cityLabel: 'Poznań', isActive: false })]);
    render(<MojeAlerty />);
    expect(await screen.findByText('Siatkówka · Poznań 25 km')).toBeTruthy();
    expect(screen.getByText('wyłączony')).toBeTruthy();
  });

  it('każdy alert ma własny przełącznik i własne kasowanie', async () => {
    alerty.mockResolvedValue([
      alert({ id: 'a1', sport: 'piłka nożna', cityLabel: 'Wrocław' }),
      alert({ id: 'a2', sport: 'siatkówka', cityLabel: 'Poznań' }),
    ]);
    render(<MojeAlerty />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: /^Usuń alert:/ })).toHaveLength(2);
    // Nazwa w etykiecie dostępnej, nie samo „Usuń" — przy kilku wierszach
    // czytnik ekranu inaczej nie powie, który alert kasuje.
    expect(screen.getByRole('button', { name: 'Usuń alert: Piłka nożna · Wrocław 25 km' })).toBeTruthy();
  });
});
