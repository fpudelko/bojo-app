import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import OknoPotwierdzenia from '@/components/ui/OknoPotwierdzenia';

// Okno zastępujące systemowe `confirm()`. Testujemy dokładnie to, czego
// `confirm()` NIE umiał: listę konsekwencji, drugą drogę wyjścia i blokadę
// podwójnego kliknięcia w trakcie zapisu.

afterEach(cleanup);

const bazowe = {
  open: true,
  tytul: 'Odwołać mecz?',
  potwierdzLabel: 'Odwołaj mecz',
  onPotwierdz: () => {},
  onAnuluj: () => {},
};

describe('OknoPotwierdzenia', () => {
  it('zamknięte nie renderuje niczego', () => {
    const { container } = render(<OknoPotwierdzenia {...bazowe} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pokazuje wszystkie konsekwencje, nie tylko pierwszą', () => {
    render(
      <OknoPotwierdzenia
        {...bazowe}
        konsekwencje={[
          'Uczestnicy z kontem dostaną powiadomienie.',
          '2 osoby bez konta powiadomienia NIE dostaną.',
          'Mecz możesz przywrócić.',
        ]}
      />,
    );
    expect(screen.getByText(/dostaną powiadomienie/)).toBeInTheDocument();
    expect(screen.getByText(/NIE dostaną/)).toBeInTheDocument();
    expect(screen.getByText(/możesz przywrócić/)).toBeInTheDocument();
  });

  it('potwierdzenie i anulowanie wołają właściwe funkcje', () => {
    const onPotwierdz = vi.fn();
    const onAnuluj = vi.fn();
    render(<OknoPotwierdzenia {...bazowe} onPotwierdz={onPotwierdz} onAnuluj={onAnuluj} />);

    screen.getByRole('button', { name: 'Odwołaj mecz' }).click();
    expect(onPotwierdz).toHaveBeenCalledTimes(1);

    screen.getByRole('button', { name: 'Anuluj' }).click();
    expect(onAnuluj).toHaveBeenCalledTimes(1);
  });

  it('druga droga wyjścia pojawia się tylko wtedy, gdy ją podano', () => {
    const onClick = vi.fn();
    const { rerender } = render(<OknoPotwierdzenia {...bazowe} />);
    expect(screen.queryByRole('button', { name: 'Odwołaj i wyślij wiadomość' })).toBeNull();

    rerender(
      <OknoPotwierdzenia {...bazowe} akcjaDodatkowa={{ label: 'Odwołaj i wyślij wiadomość', onClick }} />,
    );
    screen.getByRole('button', { name: 'Odwołaj i wyślij wiadomość' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // `confirm()` blokował wątek, więc podwójne kliknięcie było niemożliwe.
  // Tutaj jest — i przy wolnej sieci kończyłoby się dwoma żądaniami na to samo.
  it('w trakcie zapisu nie da się kliknąć drugi raz', () => {
    const onPotwierdz = vi.fn();
    render(<OknoPotwierdzenia {...bazowe} busy onPotwierdz={onPotwierdz} />);
    const przycisk = screen.getByRole('button', { name: 'Odwołaj mecz' });
    expect(przycisk).toBeDisabled();
    przycisk.click();
    expect(onPotwierdz).not.toHaveBeenCalled();
  });

  // Kto zamyka okno krzyżykiem, ANULUJE — nigdy nie potwierdza. Krzyżyk
  // wyglądający jak „zamknij i zrób" to najgorszy możliwy wynik przy akcji
  // destrukcyjnej.
  it('krzyżyk anuluje, nie potwierdza', () => {
    const onPotwierdz = vi.fn();
    const onAnuluj = vi.fn();
    render(<OknoPotwierdzenia {...bazowe} onPotwierdz={onPotwierdz} onAnuluj={onAnuluj} />);
    screen.getByRole('button', { name: 'Zamknij' }).click();
    expect(onAnuluj).toHaveBeenCalledTimes(1);
    expect(onPotwierdz).not.toHaveBeenCalled();
  });

  it('etykietę anulowania da się nadpisać (np. „Zostaję")', () => {
    render(<OknoPotwierdzenia {...bazowe} anulujLabel="Zostaję" />);
    expect(screen.getByRole('button', { name: 'Zostaję' })).toBeInTheDocument();
  });
});
