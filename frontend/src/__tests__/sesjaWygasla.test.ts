import { describe, it, expect, vi, beforeEach } from 'vitest';

// Zachowanie, o które chodzi: zapis, który padł na WYGASŁEJ SESJI, ma się
// wykonać drugi raz po odświeżeniu tokenu — a nie wyrzucić użytkownikowi
// surowy komunikat Postgresa o „row-level security policy", z którym nie ma
// on nic wspólnego.
const refreshSession = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { get refreshSession() { return refreshSession; } } },
}));

import { zPonowieniemPoOdswiezeniu } from '@/lib/zapytania';

beforeEach(() => refreshSession.mockReset());

describe('ponowienie po odświeżeniu sesji', () => {
  it('udany zapis idzie bez odświeżania', async () => {
    const zapis = vi.fn().mockResolvedValue('ok');
    await expect(zPonowieniemPoOdswiezeniu(zapis)).resolves.toBe('ok');
    expect(refreshSession).not.toHaveBeenCalled();
    expect(zapis).toHaveBeenCalledTimes(1);
  });

  it('błąd RLS: odświeża i próbuje jeszcze raz', async () => {
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const zapis = vi.fn()
      .mockRejectedValueOnce(new Error('new row violates row-level security policy for table "event_comments"'))
      .mockResolvedValueOnce('ok');

    await expect(zPonowieniemPoOdswiezeniu(zapis)).resolves.toBe('ok');
    expect(zapis).toHaveBeenCalledTimes(2);
  });

  it('wygasły token odświeża tak samo', async () => {
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const zapis = vi.fn()
      .mockRejectedValueOnce(new Error('JWT expired'))
      .mockResolvedValueOnce('ok');
    await expect(zPonowieniemPoOdswiezeniu(zapis)).resolves.toBe('ok');
  });

  it('gdy odświeżenie padnie — mówi po ludzku, nie po postgresowemu', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh_token_not_found') });
    const zapis = vi.fn().mockRejectedValue(new Error('violates row-level security policy'));

    await expect(zPonowieniemPoOdswiezeniu(zapis)).rejects.toThrow(/Sesja wygasła/);
    expect(zapis).toHaveBeenCalledTimes(1);
  });

  it('błąd NIEZWIĄZANY z sesją leci dalej bez zmian', async () => {
    // Prawdziwy brak uprawnień albo literówka w kolumnie ma dotrzeć nietknięty
    // — odświeżanie sesji niczego tam nie naprawi, a ukrycie treści utrudnia
    // diagnozę.
    const zapis = vi.fn().mockRejectedValue(new Error('column "cos" does not exist'));
    await expect(zPonowieniemPoOdswiezeniu(zapis)).rejects.toThrow(/column "cos"/);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(zapis).toHaveBeenCalledTimes(1);
  });

  it('druga próba jest ostatnia — nie zapętla się', async () => {
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const zapis = vi.fn().mockRejectedValue(new Error('violates row-level security policy'));

    await expect(zPonowieniemPoOdswiezeniu(zapis)).rejects.toThrow(/row-level security/);
    expect(zapis).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});
