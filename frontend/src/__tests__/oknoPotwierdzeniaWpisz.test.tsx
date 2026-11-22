import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import OknoPotwierdzenia from '@/components/ui/OknoPotwierdzenia';

// Usunięcie i odwołanie turnieju (2026-11-22): przycisk odblokowuje się
// dopiero po przepisaniu nazwy turnieju.
afterEach(cleanup);

function okno(onPotwierdz = vi.fn()) {
  render(
    <OknoPotwierdzenia open tytul="Usunąć turniej?" potwierdzLabel="Usuń turniej" wariant="destrukcyjny"
      wpiszAby="Gramy dla Marysi!" onPotwierdz={onPotwierdz} onAnuluj={() => {}} />,
  );
  return onPotwierdz;
}

describe('OknoPotwierdzenia: wpiszAby', () => {
  it('bez wpisanej nazwy przycisk jest wyłączony i nic nie robi', () => {
    const fn = okno();
    const przycisk = screen.getByRole('button', { name: 'Usuń turniej' });
    expect(przycisk).toBeDisabled();
    fireEvent.click(przycisk);
    expect(fn).not.toHaveBeenCalled();
  });

  it('zła nazwa nie odblokowuje, dobra (bez względu na wielkość liter) tak', () => {
    const fn = okno();
    const pole = screen.getByLabelText(/żeby potwierdzić/);
    fireEvent.change(pole, { target: { value: 'Gramy dla' } });
    expect(screen.getByRole('button', { name: 'Usuń turniej' })).toBeDisabled();
    fireEvent.change(pole, { target: { value: '  gramy dla marysi! ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usuń turniej' }));
    expect(fn).toHaveBeenCalledOnce();
  });
});
