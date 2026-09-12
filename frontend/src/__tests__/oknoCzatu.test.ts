import { describe, it, expect } from 'vitest';
import {
  zmierzOkno, styleOknaCzatu, wPoluTekstowym, odstepNadPaskiem, OKNO_NIEZMIERZONE,
} from '@/lib/oknoCzatu';

// Liczby z iPhone'a 15 Pro (852 pt wysokości), na którym zgłoszono problem:
// bez klawiatury widoczne okno to całe 852, z klawiaturą ~450.

describe('zmierzOkno', () => {
  it('bez klawiatury oddaje pełną wysokość i nie zgłasza klawiatury', () => {
    expect(zmierzOkno(852, false)).toEqual({ wysokosc: 852, klawiatura: false });
  });

  it('z klawiaturą oddaje skróconą wysokość — to ona przykleja composer do jej górnej krawędzi', () => {
    expect(zmierzOkno(450, true)).toEqual({ wysokosc: 450, klawiatura: true });
  });

  it('ułamkowa wysokość (zoom przeglądarki) idzie do pełnych pikseli', () => {
    expect(zmierzOkno(449.6, true).wysokosc).toBe(450);
  });

  it('brak pomiaru zostawia wysokość nieustaloną, zamiast zerowej', () => {
    // Zero px na korzeniu strony skasowałoby cały ekran czatu; `null` oddaje
    // pole klasie z wysokością.
    expect(zmierzOkno(0, true)).toEqual(OKNO_NIEZMIERZONE);
  });
});

// Stan klawiatury bierze się ze SKUPIENIA, nie z ubytku wysokości okna.
// Porównanie `window.innerHeight - visualViewport.height > 160` nigdy nie
// wychodziło prawdą na iOS (kurczą się tam obie wartości naraz), więc pasek
// nawigacji nie zwalniał swojego miejsca i composer siadał o jego wysokość za
// wysoko — zgłoszone ze zrzutem.
describe('wPoluTekstowym', () => {
  const el = (html: string) => {
    const kontener = document.createElement('div');
    kontener.innerHTML = html;
    return kontener.firstElementChild;
  };

  it('textarea otwiera klawiaturę', () => {
    expect(wPoluTekstowym(el('<textarea></textarea>'))).toBe(true);
  });

  it('zwykłe pole tekstowe i szukajka też', () => {
    expect(wPoluTekstowym(el('<input type="text">'))).toBe(true);
    expect(wPoluTekstowym(el('<input type="search">'))).toBe(true);
  });

  it('pole bez klawiatury ekranowej nie liczy się jako pisanie', () => {
    // Zaznaczenie checkboxa nie chowa paska nawigacji.
    expect(wPoluTekstowym(el('<input type="checkbox">'))).toBe(false);
    expect(wPoluTekstowym(el('<input type="range">'))).toBe(false);
  });

  it('brak skupienia i zwykły element to nie pisanie', () => {
    expect(wPoluTekstowym(null)).toBe(false);
    expect(wPoluTekstowym(el('<div></div>'))).toBe(false);
  });
});

// Guzik „Nowy" wystaje ponad pasek nawigacji (`-mt-4` + `ring-4`), a
// `--bottom-nav-h` opisuje sam pasek. Bez tego odstępu pole do pisania
// wchodziło pod guzik i wyglądało na wciśnięte za nisko (zgłoszone ze zrzutem).
describe('odstepNadPaskiem', () => {
  it('przy schowanej klawiaturze omija wystający guzik', () => {
    expect(odstepNadPaskiem({ wysokosc: 852, klawiatura: false })).toBe('pb-5');
  });

  it('przy otwartej klawiaturze nie zostawia nic — paska wtedy nie ma', () => {
    expect(odstepNadPaskiem({ wysokosc: 450, klawiatura: true })).toBe('');
  });
});

describe('styleOknaCzatu', () => {
  it('niezmierzone okno nie nadpisuje wysokości z klasy', () => {
    expect(styleOknaCzatu(OKNO_NIEZMIERZONE)).toBeUndefined();
  });

  // Pasek nawigacji ZOSTAJE na ekranie czatu i znika wyłącznie na czas
  // pisania, więc czat kończy się nad nim, a nie pod nim. `--bottom-nav-h`
  // schodzi do zera przy otwartej klawiaturze (globals.css, `data-klawiatura`),
  // więc jedno wyrażenie obsługuje oba stany.
  it('zmierzone okno odejmuje pasek nawigacji od wysokości', () => {
    expect(styleOknaCzatu({ wysokosc: 450, klawiatura: true }))
      .toEqual({ height: 'calc(450px - var(--bottom-nav-h))' });
  });
});
