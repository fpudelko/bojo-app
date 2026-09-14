import { describe, it, expect } from 'vitest';
import { koniecDnia, dataWygasniecia, najwczesniejszyKoniec } from '@/lib/alerts';

describe('koniec alertu jako data', () => {
  it('wybrany dzień liczy się CAŁY — koniec, nie północ', () => {
    // Sedno zamiany czterech okresów na datę: „do 30 września" znaczy dla
    // człowieka, że 30 września alert jeszcze działa. Północ ucinałaby
    // dokładnie ten dzień, który ktoś przed chwilą wskazał palcem.
    const iso = koniecDnia('2026-09-30');
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it('jest odwracalne — data → moment → ta sama data', () => {
    // Bez tego edycja alertu przesuwałaby jego koniec o dzień przy każdym
    // otwarciu okna, a nikt by tego nie zauważył: różnica wychodzi dopiero
    // po kilku zapisach.
    for (const data of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      expect(dataWygasniecia(koniecDnia(data))).toBe(data);
    }
  });

  it('puste wygaśnięcie znaczy bezterminowo, nie „dziś"', () => {
    expect(dataWygasniecia(null)).toBe('');
    expect(dataWygasniecia(undefined)).toBe('');
    expect(dataWygasniecia('')).toBe('');
  });

  it('śmieć w kolumnie nie przewraca pola daty', () => {
    expect(dataWygasniecia('nie-data')).toBe('');
  });

  it('najwcześniejszy koniec to JUTRO — alert kończący się dziś nie zdąży nic zrobić', () => {
    const teraz = new Date(2026, 8, 14, 13, 45);
    expect(najwczesniejszyKoniec(teraz)).toBe('2026-09-15');
  });

  it('najwcześniejszy koniec przeskakuje miesiąc i rok', () => {
    expect(najwczesniejszyKoniec(new Date(2026, 8, 30, 23, 0))).toBe('2026-10-01');
    expect(najwczesniejszyKoniec(new Date(2026, 11, 31, 23, 0))).toBe('2027-01-01');
  });

  it('niepełna data nie daje „Invalid Date" w bazie', () => {
    expect(koniecDnia('')).toBeNull();
    expect(koniecDnia('2026-09')).toBeNull();
  });
});
