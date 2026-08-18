import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-klucz'; });
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/lib/instalacja', () => ({
  czytajStanPrzegladarki: () => ({
    zainstalowane: false, system: 'inny' as const, wbudowana: false, telefon: true,
  }),
}));

import { czyZachetaOdlozona, odlozZachetePush } from '@/lib/push';

const DZIEN = 24 * 60 * 60 * 1000;

beforeEach(() => { window.localStorage.clear(); });

describe('odkładanie zachęty do włączenia powiadomień', () => {
  it('bez odłożenia pytamy', () => {
    expect(czyZachetaOdlozona()).toBe(false);
  });

  it('„Nie teraz" chowa zachętę od razu', () => {
    const teraz = new Date(2026, 0, 10);
    odlozZachetePush(teraz);
    expect(czyZachetaOdlozona(teraz)).toBe(true);
  });

  it('po 29 dniach jeszcze nie pytamy', () => {
    const teraz = new Date(2026, 0, 10);
    odlozZachetePush(teraz);
    expect(czyZachetaOdlozona(new Date(teraz.getTime() + 29 * DZIEN))).toBe(true);
  });

  it('po 31 dniach pytamy ponownie — „nie teraz" to nie „nigdy"', () => {
    // Trwałe schowanie po jednym kliknięciu kasowałoby jedyny kanał, który
    // dowozi informację o meczu poza aplikacją. Za miesiąc ta sama osoba może
    // chcieć inaczej.
    const teraz = new Date(2026, 0, 10);
    odlozZachetePush(teraz);
    expect(czyZachetaOdlozona(new Date(teraz.getTime() + 31 * DZIEN))).toBe(false);
  });

  it('śmieć w localStorage nie blokuje zachęty na zawsze', () => {
    window.localStorage.setItem('bojo:push-odlozone', 'kiedyś');
    expect(czyZachetaOdlozona()).toBe(false);
  });
});
