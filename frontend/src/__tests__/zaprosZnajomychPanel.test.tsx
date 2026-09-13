import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import ZaprosZnajomychPanel from '@/components/events/ZaprosZnajomychPanel';
import type { EventItem } from '@/types';

// Scenariusz „Kopiuj potwierdza skopiowanie linku" (`e2e/scenariusze.spec.ts`)
// zawęża wyszukiwanie przycisku do KARTY panelu i klika w niej „Kopiuj".
// Dopóki karty szukał przez `ancestor::div[1]` od tytułu, trzymało się to
// wyłącznie na tym, że tytuł jest bezpośrednim dzieckiem karty — a przestał
// nim być, gdy cztery przyciski przestały mieścić się w jednej linii
// i tytuł dostał własny wiersz. Bramka scenariuszy zgłosiła to jako zepsute
// ZACHOWANIE po dziewięciu minutach CI.
//
// Ten test pilnuje tej samej rzeczy bez przeglądarki i bez bazy: karta ma
// zaczep `data-zapros-znajomych`, a wszystkie przyciski są w ŚRODKU tego
// zaczepu. Układ wolno zmieniać, ale nie tak, żeby przycisk wypadł z karty.

const event = {
  id: 'e1',
  title: 'Piłka nożna 7v7',
  date: '2026-10-01',
  time: '18:00',
  maxPlayers: 14,
  costGrosze: 0,
  visibility: 'private',
  reserveEnabled: true,
  zapisyZamkniete: false,
} as unknown as EventItem;

afterEach(cleanup);

describe('ZaprosZnajomychPanel', () => {
  it('trzyma wszystkie przyciski wewnątrz karty z zaczepem', () => {
    const { container } = render(
      <ZaprosZnajomychPanel
        event={event}
        onZaprosZGrupy={() => {}}
        onOtworzDlaOkolicy={() => {}}
      />,
    );

    const karta = container.querySelector('[data-zapros-znajomych]');
    expect(karta).not.toBeNull();

    const wKarcie = within(karta as HTMLElement);
    for (const nazwa of ['Udostępnij', 'Kopiuj', 'Zaproś z grupy', 'Otwórz dla okolicy']) {
      expect(wKarcie.getByRole('button', { name: nazwa })).toBeTruthy();
    }
  });

  it('nie renderuje przycisków opcjonalnych bez ich handlerów', () => {
    render(<ZaprosZnajomychPanel event={event} />);
    expect(screen.queryByRole('button', { name: 'Zaproś z grupy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Otwórz dla okolicy' })).toBeNull();
    // Te dwa zostają zawsze — panel bez nich nie miałby po co istnieć.
    expect(screen.getByRole('button', { name: 'Udostępnij' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kopiuj' })).toBeTruthy();
  });
});
