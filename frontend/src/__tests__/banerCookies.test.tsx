import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useState } from 'react';
import CookieBanner from '@/components/CookieBanner';
import { BottomNavVisibilityProvider, HideBottomNav } from '@/lib/bottomNavVisibility';

// W-1 (docs/faza1-przejscie-e2e-plan.md). Baner `z-50` przykrywał w całości
// dolny pasek akcji `z-30`: gracz z linku po 6 sekundach widział „OK,
// rozumiem” zamiast „Dołącz bez konta”. Ekrany z własnym paskiem deklarują
// się przez <HideBottomNav/> — i to jest sygnał, że baner ma poczekać.
//
// Testy e2e tego nie widziały, bo KAŻDY ustawia zgodę przed wejściem.

vi.mock('@/lib/widget', () => ({ useJestWidget: () => false }));

const baner = () => screen.queryByRole('dialog', { name: 'Informacja o cookies' });

/** Strona z przełączanym paskiem akcji — jak strona meczu przed i po zapisie. */
function Strona({ zPaskiem }: { zPaskiem: boolean }) {
  return (
    <BottomNavVisibilityProvider>
      {zPaskiem && <HideBottomNav />}
      <CookieBanner />
    </BottomNavVisibilityProvider>
  );
}

let przelacz: (v: boolean) => void = () => {};
function StronaPrzelaczana() {
  const [zPaskiem, ustaw] = useState(true);
  przelacz = ustaw;
  return <Strona zPaskiem={zPaskiem} />;
}

describe('baner cookies a dolny pasek akcji', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('bez paska akcji pojawia się po 6 sekundach (bez zmian wobec dotąd)', () => {
    render(<Strona zPaskiem={false} />);
    expect(baner()).toBeNull();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(baner()).not.toBeNull();
  });

  it('na ekranie z paskiem akcji NIE pojawia się ani po 6 s, ani po przewinięciu', () => {
    render(<Strona zPaskiem />);
    act(() => { vi.advanceTimersByTime(10_000); });
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 900, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(baner()).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('gdy pasek znika (inny ekran), pokazuje się od razu — czas już upłynął', () => {
    render(<StronaPrzelaczana />);
    act(() => { vi.advanceTimersByTime(7000); });
    expect(baner()).toBeNull();
    act(() => { przelacz(false); });
    expect(baner()).not.toBeNull();
  });

  it('po zgodzie nie wraca także poza ekranem z paskiem', () => {
    localStorage.setItem('bojo_cookie_consent_v1', '1');
    render(<Strona zPaskiem={false} />);
    act(() => { vi.advanceTimersByTime(7000); });
    expect(baner()).toBeNull();
  });
});
