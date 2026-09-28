import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Z-5 (docs/faza1-runda10-plan.md, migracja 168): gość dopisany ręcznie przez
// organizatora nie ma jak sam zostawić e-maila — pole istniało wyłącznie
// w oknie organizatora. Ten test pilnuje formularza na stronie „Twój zapis"
// (`/gracz/przejmij/[token]`), jedynego miejsca, gdzie sam gość może to
// naprawić bez zakładania konta.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null, loading: false }),
  displayName: () => 'Gość',
}));
vi.mock('@/components/layout/Header', () => ({ default: () => null }));
vi.mock('@/lib/mojWpisGoscia', () => ({ zapomnijWpisGoscia: vi.fn() }));
vi.mock('@/lib/usePotwierdzenie', () => ({
  usePotwierdzenie: () => ({ potwierdz: vi.fn().mockResolvedValue('nie'), oknoPotwierdzenia: null }),
}));

const podejrzyjWpisGoscia = vi.fn();
const ustawEmailGoscia = vi.fn();
vi.mock('@/lib/guestClaim', () => ({
  podejrzyjWpisGoscia: (...a: unknown[]) => podejrzyjWpisGoscia(...a),
  ustawEmailGoscia: (...a: unknown[]) => ustawEmailGoscia(...a),
  przejmijWpisGoscia: vi.fn(),
  wypiszWpisGoscia: vi.fn(),
  przyjmijOferteGoscia: vi.fn(),
  odpuscOferteGoscia: vi.fn(),
}));

import PrzejmijClient from '@/app/gracz/przejmij/[token]/PrzejmijClient';

const bazowy = {
  imie: 'Kuba', eventId: 'e1', tytul: 'Mecz', data: '2026-10-01', godzina: '18:00:00',
  miejsce: 'Orlik', juzPrzejety: false, statusMeczu: 'active' as const, naRezerwie: false,
  czekaNaAkceptacje: false, kosztGrosze: 0, wSkladzie: 4, maxGraczy: 14,
  moznaZmieniac: true, ofertaDo: null,
  metodyPlatnosci: [], metodaPlatnosci: null, kartaSportowa: false, znizkaKartyGrosze: null,
  pokazStatusPlatnosci: false, oplacone: false, blikTelefon: null, blikPozniej: false,
};

async function wyrenderuj(podglad: typeof bazowy) {
  podejrzyjWpisGoscia.mockResolvedValue(podglad);
  render(<PrzejmijClient token="tok" />);
  await screen.findByText(bazowy.tytul);
}

describe('PrzejmijClient — gość zostawia e-mail (Z-5)', () => {
  beforeEach(() => { podejrzyjWpisGoscia.mockReset(); ustawEmailGoscia.mockReset(); });
  afterEach(cleanup);

  it('pole jest widoczne, gdy wpis nie ma adresu', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false } as never);
    expect(screen.getByPlaceholderText('Twój adres e-mail')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zapisz adres' })).toBeTruthy();
  });

  it('pola nie ma, gdy wpis już ma adres', async () => {
    await wyrenderuj({ ...bazowy, maEmail: true } as never);
    expect(screen.queryByPlaceholderText('Twój adres e-mail')).toBeNull();
    expect(screen.getByText(/Przypomnienie i wiadomości o zmianach przyjdą na e-mail/)).toBeTruthy();
  });

  it('pola nie ma przy meczu odwołanym, nawet bez adresu', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false, statusMeczu: 'cancelled' } as never);
    expect(screen.queryByPlaceholderText('Twój adres e-mail')).toBeNull();
  });

  it('pola nie ma po starcie meczu (moznaZmieniac: false), nawet bez adresu', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false, moznaZmieniac: false } as never);
    expect(screen.queryByPlaceholderText('Twój adres e-mail')).toBeNull();
  });

  it('zły adres: komunikat z RPC, bez zmiany stanu na „zapisany”', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false } as never);
    ustawEmailGoscia.mockRejectedValue(new Error('Podaj poprawny adres e-mail.'));
    fireEvent.change(screen.getByPlaceholderText('Twój adres e-mail'), { target: { value: 'zle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz adres' }));
    await screen.findByText('Podaj poprawny adres e-mail.');
    expect(screen.queryByText(/Gotowe\. Potwierdzenie wysłaliśmy/)).toBeNull();
  });

  it('poprawny adres: RPC dostaje token i adres, formularz zamienia się na potwierdzenie', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false } as never);
    ustawEmailGoscia.mockResolvedValue(true);
    fireEvent.change(screen.getByPlaceholderText('Twój adres e-mail'), { target: { value: 'jan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz adres' }));
    await screen.findByText(/Gotowe\. Potwierdzenie wysłaliśmy na podany adres\./);
    expect(ustawEmailGoscia).toHaveBeenCalledWith('tok', 'jan@example.com');
    expect(screen.queryByPlaceholderText('Twój adres e-mail')).toBeNull();
  });

  it('RPC zwraca false (adres ustawiony w międzyczasie): komunikat i odświeżenie podglądu', async () => {
    await wyrenderuj({ ...bazowy, maEmail: false } as never);
    ustawEmailGoscia.mockResolvedValue(false);
    podejrzyjWpisGoscia.mockResolvedValue({ ...bazowy, maEmail: true });
    fireEvent.change(screen.getByPlaceholderText('Twój adres e-mail'), { target: { value: 'jan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz adres' }));
    await screen.findByText('Nie udało się zapisać adresu. Odśwież stronę.');
    await waitFor(() => expect(podejrzyjWpisGoscia).toHaveBeenCalledTimes(2));
  });
});
