import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TwojaPlatnosc from '@/components/events/TwojaPlatnosc';

// Karta wspólna dla gracza z kontem i gościa bez konta (W-4, W-5).

const baza = {
  kosztGrosze: 2000, znizkaKartyGrosze: null, kartaSportowa: false, metoda: 'blik' as const,
  blikTelefon: null, blikPozniej: false, pokazStatus: true, oplacone: false,
};

describe('TwojaPlatnosc', () => {
  afterEach(cleanup);

  it('kwota w jednej formie „20,00 zł”, bez „PLN”', () => {
    render(<TwojaPlatnosc {...baza} />);
    expect(screen.getByText('20,00 zł')).toBeTruthy();
    expect(screen.queryByText(/PLN/)).toBeNull();
  });

  it('zniżka kartowa: cena po zniżce i przekreślona pełna', () => {
    render(<TwojaPlatnosc {...baza} kartaSportowa znizkaKartyGrosze={500} />);
    expect(screen.getByText('15,00 zł')).toBeTruthy();
    expect(screen.getByText('20,00 zł')).toBeTruthy();
  });

  it('karta bez znanej kwoty zniżki: „ustal z organizatorem”', () => {
    render(<TwojaPlatnosc {...baza} kartaSportowa />);
    expect(screen.getByText(/ustal kwotę z organizatorem/)).toBeTruthy();
  });

  it('BLIK później: zdanie zamiast numeru; BLIK teraz: numer', () => {
    const { rerender } = render(<TwojaPlatnosc {...baza} blikPozniej />);
    expect(screen.getByText('zobaczysz na godzinę przed meczem')).toBeTruthy();
    rerender(<TwojaPlatnosc {...baza} blikTelefon="600 123 456" />);
    expect(screen.getByText('600 123 456')).toBeTruthy();
  });

  it('płaci gotówką: wiersza BLIK nie ma, nawet gdy numer jest', () => {
    render(<TwojaPlatnosc {...baza} metoda="gotowka" blikTelefon="600 123 456" />);
    expect(screen.queryByText('600 123 456')).toBeNull();
    expect(screen.getByText('Gotówka')).toBeTruthy();
  });

  it('status wpłaty tylko, gdy organizator go pokazuje', () => {
    const { rerender } = render(<TwojaPlatnosc {...baza} oplacone />);
    expect(screen.getByText('Opłacone')).toBeTruthy();
    rerender(<TwojaPlatnosc {...baza} pokazStatus={false} oplacone />);
    expect(screen.queryByText('Opłacone')).toBeNull();
    expect(screen.queryByText('Jeszcze nieopłacone')).toBeNull();
  });
});
