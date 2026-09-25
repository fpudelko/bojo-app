import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { liczZajeteMiejsca } from '@/lib/zajeteMiejsca';

// W-8 (docs/faza1-przejscie-e2e-plan.md, decyzja D-1): zaproszenie do ekipy
// daje drogę do najbliższego meczu BEZ konta, a licznik miejsc nie liczy
// obserwujących.

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({
  BLAD_ZLE_DANE: 'x',
  useAuth: () => ({
    user: null, loading: false, signInWithGoogle: vi.fn(), signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(), sendMagicLink: vi.fn(), sendPasswordReset: vi.fn(),
  }),
}));
vi.mock('@/components/layout/Header', () => ({ default: () => null }));

import ZaproszenieClient from '@/app/g/[code]/ZaproszenieClient';

const grupa = { id: 'g1', name: 'Czwartkowa ekipa', memberCount: 9, createdAt: '2026-06-01T00:00:00Z' };

describe('zaproszenie do ekipy /g/[kod]', () => {
  afterEach(cleanup);

  it('z najbliższym meczem: link „bez konta” prowadzi na stronę meczu', () => {
    render(<ZaproszenieClient code="ABC123" group={grupa} totalMatches={3}
      nextEvent={{ id: 'm1', date: '2026-10-01', time: '20:00', maxPlayers: 14, participantsCount: 9 }} />);
    const link = screen.getByRole('link', { name: /Zapisz się na ten mecz bez konta/ });
    expect(link.getAttribute('href')).toBe('/wydarzenia/m1');
    // Formularz konta zostaje głównym wezwaniem strony.
    expect(screen.getByRole('heading', { name: 'Załóż konto' })).toBeTruthy();
  });

  it('bez najbliższego meczu linku nie ma', () => {
    render(<ZaproszenieClient code="ABC123" group={grupa} totalMatches={0} />);
    expect(screen.queryByRole('link', { name: /bez konta/ })).toBeNull();
  });
});

describe('liczZajeteMiejsca', () => {
  it('pomija rezerwę, oczekujących i obserwujących', () => {
    expect(liczZajeteMiejsca([
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },
      { is_reserve: false, pending_approval: false, rsvp: null },
      { is_reserve: true, pending_approval: false, rsvp: 'yes' },
      { is_reserve: false, pending_approval: true, rsvp: 'yes' },
      { is_reserve: false, pending_approval: false, rsvp: 'maybe' },
    ])).toBe(2);
    expect(liczZajeteMiejsca(null)).toBe(0);
  });
});
