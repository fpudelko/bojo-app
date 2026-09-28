import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TwojaPlatnosc from '@/components/events/TwojaPlatnosc';

// Karta wspólna dla gracza z kontem i gościa bez konta (W-4, W-5).

const baza = {
  kosztGrosze: 2000, znizkaKartyGrosze: null, kartaSportowa: false, metoda: 'blik' as const,
  metodyMeczu: [] as ('blik' | 'gotowka' | 'inne')[],
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

  // Z-6 (docs/faza1-runda10-plan.md): gość dopisany ręcznie („Dopisz osobę
  // bez konta") nie ma wybranej metody — karta nie pokazywała mu wtedy
  // numeru BLIK, mimo że baza go oddawała.
  describe('bez wybranej metody płatności (Z-6)', () => {
    it('mecz przyjmuje BLIK: wiersz BLIK pokazuje się mimo braku wybranej metody', () => {
      const { rerender } = render(
        <TwojaPlatnosc {...baza} metoda={null} metodyMeczu={['gotowka', 'blik']} blikPozniej />,
      );
      expect(screen.getByText('zobaczysz na godzinę przed meczem')).toBeTruthy();
      rerender(
        <TwojaPlatnosc {...baza} metoda={null} metodyMeczu={['gotowka', 'blik']} blikTelefon="600 123 456" />,
      );
      expect(screen.getByText('600 123 456')).toBeTruthy();
    });

    it('mecz przyjmuje tylko gotówkę: bez wiersza BLIK, „Sposób” wypisuje akceptowane', () => {
      render(<TwojaPlatnosc {...baza} metoda={null} metodyMeczu={['gotowka']} blikTelefon="600 123 456" />);
      expect(screen.queryByText('600 123 456')).toBeNull();
      expect(screen.getByText('Gotówka')).toBeTruthy();
    });

    it('metoda wybrana wygrywa nad metodyMeczu — gotówka mimo że mecz przyjmuje BLIK', () => {
      render(<TwojaPlatnosc {...baza} metoda="gotowka" metodyMeczu={['gotowka', 'blik']} blikTelefon="600 123 456" />);
      expect(screen.queryByText('600 123 456')).toBeNull();
      expect(screen.getByText('Gotówka')).toBeTruthy();
    });
  });
});
