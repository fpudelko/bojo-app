import { perPlayerPriceGrosze, priceForParticipant } from './payments';

export interface WynikRozliczenia {
  liczbaGraczy: number;
  liczbaZKarta: number;
  liczbaBezKarty: number;
  cenaBezKarty: number;
  cenaZKarta: number;
  znizkaNieustalona: boolean;
  suma: number;
}

/**
 * Orkiestracja dla /kalkulator-kosztow-boiska — czysta funkcja, wydzielona
 * z komponentu klienckiego, żeby dało się przetestować bez renderowania.
 * Liczy WYŁĄCZNIE dwiema funkcjami z lib/payments.ts (perPlayerPriceGrosze,
 * priceForParticipant), dokładnie tymi, których używa mecz w aplikacji —
 * ta funkcja tylko czyści surowe wejście z formularza (przycina do sensownych
 * zakresów, zamienia PLN-stringi na grosze) i składa wynik do wyświetlenia.
 */
export function obliczRozliczenie(wejscie: {
  kosztPln: string;
  graczy: string;
  zKarta: string;
  znizkaPln: string;
}): WynikRozliczenia {
  const kosztGrosze = Math.max(0, Math.round((parseFloat(wejscie.kosztPln) || 0) * 100));
  const liczbaGraczy = Math.max(0, Math.floor(parseFloat(wejscie.graczy) || 0));
  const liczbaZKarta = Math.min(liczbaGraczy, Math.max(0, Math.floor(parseFloat(wejscie.zKarta) || 0)));
  const liczbaBezKarty = liczbaGraczy - liczbaZKarta;
  const znizkaGrosze = wejscie.znizkaPln.trim() === ''
    ? null
    : Math.round((parseFloat(wejscie.znizkaPln) || 0) * 100);

  const cenaBezKarty = perPlayerPriceGrosze(kosztGrosze, liczbaGraczy);
  const zKartaWynik = priceForParticipant(cenaBezKarty, znizkaGrosze, true);

  return {
    liczbaGraczy,
    liczbaZKarta,
    liczbaBezKarty,
    cenaBezKarty,
    cenaZKarta: zKartaWynik.priceGrosze,
    znizkaNieustalona: zKartaWynik.discountUnspecified,
    suma: liczbaBezKarty * cenaBezKarty + liczbaZKarta * zKartaWynik.priceGrosze,
  };
}
