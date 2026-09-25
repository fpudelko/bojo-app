import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// W-7 (docs/faza1-przejscie-e2e-plan.md). Nowy organizator z bramy kreatora
// trafiał na „Zaloguj się”, wpisywał e-mail i NOWE hasło i dostawał samo
// „Nieprawidłowy e-mail lub hasło.” — bez drogi dalej.

const BLAD = 'Nieprawidłowy e-mail lub hasło.';
const signInWithEmail = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({
  BLAD_ZLE_DANE: 'Nieprawidłowy e-mail lub hasło.',
  useAuth: () => ({
    signInWithGoogle: vi.fn(), signInWithEmail, signUpWithEmail: vi.fn(),
    sendMagicLink: vi.fn(), sendPasswordReset: vi.fn(),
  }),
}));

import AuthForm from '@/components/auth/AuthForm';

function zaloguj(email: string) {
  fireEvent.change(screen.getByPlaceholderText('twoj@email.pl'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Hasło'), { target: { value: 'nowehaslo' } });
  fireEvent.submit(screen.getByPlaceholderText('twoj@email.pl').closest('form')!);
}

describe('AuthForm — nowy organizator na ekranie logowania', () => {
  afterEach(() => { cleanup(); signInWithEmail.mockReset(); });

  it('złe dane: podpowiedź rejestracji, klik przełącza na „Załóż konto” z tym samym adresem', async () => {
    signInWithEmail.mockRejectedValue(new Error(BLAD));
    render(<AuthForm />);
    zaloguj('marek@example.com');
    const podpowiedz = await screen.findByRole('button', { name: /Pierwszy raz tutaj\? Załóż konto na ten adres/ });
    fireEvent.click(podpowiedz);
    expect(screen.getByRole('heading', { name: 'Załóż konto' })).toBeTruthy();
    expect((screen.getByPlaceholderText('twoj@email.pl') as HTMLInputElement).value).toBe('marek@example.com');
  });

  it('inny błąd (np. limit prób) podpowiedzi rejestracji nie pokazuje', async () => {
    signInWithEmail.mockRejectedValue(new Error('Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'));
    render(<AuthForm />);
    zaloguj('marek@example.com');
    await waitFor(() => expect(screen.getByText(/Za dużo prób/)).toBeTruthy());
    expect(screen.queryByText(/Pierwszy raz tutaj/)).toBeNull();
  });

  it('powod=kreator i powod=dolacz mają własne zdanie pod nagłówkiem', () => {
    const { rerender } = render(<AuthForm powod="kreator" />);
    expect(screen.getByText(/Pierwszy raz\? Najszybciej przez Google/)).toBeTruthy();
    rerender(<AuthForm powod="dolacz" />);
    expect(screen.getByText(/wrócisz do meczu z otwartym oknem zapisu/)).toBeTruthy();
  });
});
