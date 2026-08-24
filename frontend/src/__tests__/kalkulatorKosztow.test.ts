import { describe, it, expect } from 'vitest';
import { obliczRozliczenie } from '@/lib/kalkulatorKosztow';

describe('obliczRozliczenie', () => {
  it('bez posiadaczy karty: cena i suma liczą się z samego kosztu i liczby graczy', () => {
    const w = obliczRozliczenie({ kosztPln: '280', graczy: '14', zKarta: '0', znizkaPln: '' });
    expect(w.cenaBezKarty).toBe(2000); // 20 zł
    expect(w.liczbaZKarta).toBe(0);
    expect(w.liczbaBezKarty).toBe(14);
    expect(w.suma).toBe(28000); // dokładnie koszt wejściowy przy równym podziale
  });

  it('posiadacze karty bez podanej kwoty zniżki płacą tyle samo — sygnalizowane wprost', () => {
    const w = obliczRozliczenie({ kosztPln: '280', graczy: '14', zKarta: '4', znizkaPln: '' });
    expect(w.znizkaNieustalona).toBe(true);
    expect(w.cenaZKarta).toBe(w.cenaBezKarty);
    expect(w.suma).toBe(14 * w.cenaBezKarty);
  });

  it('podana kwota zniżki obniża cenę i sumę dla posiadaczy karty', () => {
    const w = obliczRozliczenie({ kosztPln: '280', graczy: '14', zKarta: '4', znizkaPln: '5' });
    expect(w.znizkaNieustalona).toBe(false);
    expect(w.cenaZKarta).toBe(w.cenaBezKarty - 500);
    expect(w.suma).toBe(10 * w.cenaBezKarty + 4 * w.cenaZKarta);
  });

  it('liczba posiadaczy karty jest przycinana do liczby graczy', () => {
    const w = obliczRozliczenie({ kosztPln: '100', graczy: '5', zKarta: '99', znizkaPln: '' });
    expect(w.liczbaZKarta).toBe(5);
    expect(w.liczbaBezKarty).toBe(0);
  });

  it('puste albo niepoprawne pola nie wywalają obliczeń — traktowane jako zero', () => {
    const w = obliczRozliczenie({ kosztPln: '', graczy: '', zKarta: '', znizkaPln: '' });
    expect(w.liczbaGraczy).toBe(0);
    expect(w.cenaBezKarty).toBe(0);
    expect(w.suma).toBe(0);
  });

  it('ujemne wartości wejściowe nie dają ujemnej ceny ani liczby graczy', () => {
    const w = obliczRozliczenie({ kosztPln: '-100', graczy: '-5', zKarta: '-2', znizkaPln: '' });
    expect(w.liczbaGraczy).toBe(0);
    expect(w.cenaBezKarty).toBe(0);
  });
});
