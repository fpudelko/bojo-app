import { describe, it, expect } from 'vitest';
import {
  koniecDnia, dataWygasniecia, najwczesniejszyKoniec, wygasaZKiedy, kiedyZWygasniecia,
} from '@/lib/alerts';

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

describe('„Kiedy" jako czas życia alertu', () => {
  // Środa, 5 sierpnia 2026.
  const SRODA = new Date(2026, 7, 5, 14, 0);

  it('brak wyboru znaczy BEZTERMINOWO, a nie „dziś"', () => {
    expect(wygasaZKiedy('wszystkie', SRODA)).toBeNull();
    expect(kiedyZWygasniecia(null, SRODA)).toBe('wszystkie');
  });

  it('„dzisiaj" gaśnie na koniec dzisiejszego dnia', () => {
    const iso = wygasaZKiedy('dzisiaj', SRODA)!;
    expect(dataWygasniecia(iso)).toBe('2026-08-05');
    expect(new Date(iso).getHours()).toBe(23);
  });

  it('„3 dni" liczy DZISIAJ jako pierwszy — tak samo jak filtr', () => {
    // Gdyby liczyło od jutra, ta sama etykieta znaczyłaby w filtrach i w alercie
    // dwie różne rzeczy, a nikt by tego nie zauważył poza brakującym alertem.
    expect(dataWygasniecia(wygasaZKiedy('trzy-dni', SRODA)!)).toBe('2026-08-07');
  });

  it('„tydzień" sięga do niedzieli tego tygodnia, nie do siedmiu dni', () => {
    expect(dataWygasniecia(wygasaZKiedy('tydzien', SRODA)!)).toBe('2026-08-09');
  });

  it('własny termin przechodzi wprost', () => {
    expect(dataWygasniecia(wygasaZKiedy('do:2026-12-24', SRODA)!)).toBe('2026-12-24');
  });

  it('odczyt wraca na NAZWANY przycisk, gdy data się zgadza', () => {
    // Bez tego edycja alertu założonego na „tydzień" pokazywałaby własny termin,
    // czyli inny przycisk niż ten, który kliknięto przy zakładaniu.
    for (const f of ['dzisiaj', 'trzy-dni', 'tydzien'] as const) {
      expect(kiedyZWygasniecia(wygasaZKiedy(f, SRODA), SRODA)).toBe(f);
    }
  });

  it('data spoza przycisków ląduje na własnym terminie, a nie gubi wyboru', () => {
    expect(kiedyZWygasniecia(wygasaZKiedy('do:2026-12-24', SRODA), SRODA)).toBe('do:2026-12-24');
  });
});
