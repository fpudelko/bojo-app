import { describe, it, expect } from 'vitest';
import { zmierzOkno, styleOknaCzatu, OKNO_NIEZMIERZONE } from '@/lib/oknoCzatu';

// Liczby z iPhone'a 15 Pro (852 pt wysokości), na którym zgłoszono problem:
// bez klawiatury widoczne okno to całe 852, z klawiaturą ~450.
const STRONA = 852;

describe('zmierzOkno', () => {
  it('bez klawiatury oddaje pełną wysokość i nie zgłasza klawiatury', () => {
    expect(zmierzOkno(852, STRONA)).toEqual({ wysokosc: 852, klawiatura: false });
  });

  it('z klawiaturą oddaje skróconą wysokość — to ona przykleja composer do jej górnej krawędzi', () => {
    expect(zmierzOkno(450, STRONA)).toEqual({ wysokosc: 450, klawiatura: true });
  });

  it('chowający się pasek adresu to nie klawiatura', () => {
    // Kilkadziesiąt pikseli ubytku bierze się z paska przeglądarki. Gdyby
    // uchodziło za klawiaturę, zniknąłby odstęp na pasek gestów u dołu.
    expect(zmierzOkno(800, STRONA).klawiatura).toBe(false);
  });

  it('ułamkowa wysokość (zoom przeglądarki) idzie do pełnych pikseli', () => {
    expect(zmierzOkno(449.6, STRONA).wysokosc).toBe(450);
  });

  it('brak pomiaru zostawia wysokość nieustaloną, zamiast zerowej', () => {
    // Zero px na korzeniu strony skasowałoby cały ekran czatu; `null` oddaje
    // pole klasie `h-[100dvh]`.
    expect(zmierzOkno(0, STRONA)).toEqual(OKNO_NIEZMIERZONE);
  });
});

describe('styleOknaCzatu', () => {
  it('niezmierzone okno nie nadpisuje wysokości z klasy', () => {
    expect(styleOknaCzatu(OKNO_NIEZMIERZONE)).toBeUndefined();
  });

  // Pasek nawigacji ZOSTAJE na ekranie czatu i chowa się wyłącznie za
  // klawiaturą, więc czat kończy się nad nim, a nie pod nim. `--bottom-nav-h`
  // schodzi do zera przy otwartej klawiaturze (globals.css, `data-klawiatura`),
  // więc jedno wyrażenie obsługuje oba stany.
  it('zmierzone okno odejmuje pasek nawigacji od wysokości', () => {
    expect(styleOknaCzatu({ wysokosc: 450, klawiatura: true }))
      .toEqual({ height: 'calc(450px - var(--bottom-nav-h))' });
  });
});
