import { describe, it, expect, vi } from 'vitest';

// Komponent importuje hooki aplikacji — test dotyczy wyłącznie czystej reguły.
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null }), displayName: () => '' }));
vi.mock('@/lib/widget', () => ({ useJestWidget: () => false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

import { czyPokazacWyborRoli } from '@/components/onboarding/PostSignupRoleModal';

// W-2 (docs/faza1-przejscie-e2e-plan.md): okno „Kim jesteś?” wyskakiwało nad
// kreatorem i nad otwartym oknem zapisu, gdy logowanie skończyło się w innej
// karcie — `sessionStorage` z celem jest per karta, więc cel był `null`.

const swieze = { wiekKontaMs: 60_000, widziano: false, widget: false };

describe('czyPokazacWyborRoli', () => {
  it('nowa karta (cel null) na kreatorze — NIE', () => {
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/wydarzenia/nowe', cel: null })).toBe(false);
  });

  it('nowa karta (cel null) na stronie meczu z otwartym zapisem — NIE', () => {
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/wydarzenia/abc', cel: null })).toBe(false);
  });

  it('organiczna rejestracja, wylądowała na /moje-gry — TAK', () => {
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/moje-gry', cel: '/moje-gry' })).toBe(true);
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/moje-gry', cel: null })).toBe(true);
  });

  it('jeszcze na /logowanie (przed przekierowaniem) — NIE', () => {
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/logowanie', cel: null })).toBe(false);
  });

  it('cel kreator, ale chwilowo stoimy na / (powrót przez Site URL) — NIE', () => {
    expect(czyPokazacWyborRoli({ ...swieze, sciezka: '/', cel: '/wydarzenia/nowe' })).toBe(false);
  });

  it('konto starsze niż 10 minut, już widziane albo widget — NIE', () => {
    const baza = { sciezka: '/moje-gry', cel: null };
    expect(czyPokazacWyborRoli({ ...swieze, ...baza, wiekKontaMs: 10 * 60 * 1000 })).toBe(false);
    expect(czyPokazacWyborRoli({ ...swieze, ...baza, widziano: true })).toBe(false);
    expect(czyPokazacWyborRoli({ ...swieze, ...baza, widget: true })).toBe(false);
  });
});
