import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PoMeczuCard from '@/components/events/PoMeczuCard';

// "Nieobecni" należy do gałęzi z listą zadań (porządki po meczu) — w gałęzi
// pustej ("Powtórzyć mecz za tydzień?") nie pasuje tematycznie i ma się NIE
// renderować, mimo że `onOznaczNieobecnych` jest podany (zgłoszone wprost
// z sesji UX 2026-09-13).

afterEach(cleanup);

const bazowe = {
  maPlatnosc: false,
  liczbaNieoplaconych: 0,
  liczbaWSkladzie: 0,
  onWyslijRozliczenie: () => {},
  onWszyscyOddali: () => {},
  trackResults: false,
  wynikWpisany: false,
  onWpiszWynik: () => {},
  liczbaGosciDoZaproszenia: 0,
  onZaprosGoscia: () => {},
  onOznaczNieobecnych: vi.fn(),
  onPowtorzMecz: () => {},
};

describe('PoMeczuCard', () => {
  it('w pustym stanie (nic do zrobienia) nie pokazuje "Nieobecni"', () => {
    render(<PoMeczuCard {...bazowe} />);
    expect(screen.getByText('Powtórzyć mecz za tydzień?')).toBeInTheDocument();
    expect(screen.queryByText('Nieobecni')).not.toBeInTheDocument();
    // "Powtórz" zostaje w tym rzędzie.
    expect(screen.getByText('Powtórz')).toBeInTheDocument();
  });

  it('gdy jest lista zadań, "Nieobecni" nadal się pokazuje', () => {
    render(<PoMeczuCard {...bazowe} maPlatnosc liczbaNieoplaconych={2} liczbaWSkladzie={5} />);
    expect(screen.getByText('Po meczu')).toBeInTheDocument();
    expect(screen.getByText('Nieobecni')).toBeInTheDocument();
  });
});
