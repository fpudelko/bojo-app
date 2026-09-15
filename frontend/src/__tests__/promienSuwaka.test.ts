import { describe, it, expect } from 'vitest';
import {
  PROMIENIE_SUWAK_KM, PROMIEN_DOMYSLNY_KM, indeksPromienia, promienZIndeksu,
} from '@/lib/miejscowosci';

describe('skala suwaka odległości', () => {
  it('zaczyna się na 1 km i kończy na 100 km', () => {
    expect(PROMIENIE_SUWAK_KM[0]).toBe(1);
    expect(PROMIENIE_SUWAK_KM[PROMIENIE_SUWAK_KM.length - 1]).toBe(100);
  });

  it('rośnie monotonicznie — suwak nie może cofać się w kilometrach', () => {
    for (let i = 1; i < PROMIENIE_SUWAK_KM.length; i += 1) {
      expect(PROMIENIE_SUWAK_KM[i]).toBeGreaterThan(PROMIENIE_SUWAK_KM[i - 1]);
    }
  });

  it('ma NARASTAJĄCĄ podziałkę: krok u góry jest większy niż na dole', () => {
    // Sedno zmiany z 2026-09-14. Gdyby ktoś kiedyś „uprościł" tablicę do
    // równych odstępów, ten test spadnie — a wtedy 1–10 km, czyli cały realny
    // zakres decyzji, znowu zmieści się na jednej dziesiątej suwaka.
    const pierwszyKrok = PROMIENIE_SUWAK_KM[1] - PROMIENIE_SUWAK_KM[0];
    const ostatniKrok = PROMIENIE_SUWAK_KM[PROMIENIE_SUWAK_KM.length - 1]
      - PROMIENIE_SUWAK_KM[PROMIENIE_SUWAK_KM.length - 2];
    expect(ostatniKrok).toBeGreaterThan(pierwszyKrok);
  });

  it('50 km wypada wyraźnie po PRAWEJ, nie w połowie', () => {
    // Zgłoszone wprost: „żeby nie było, że w połowie 50, tylko 50 blisko prawej".
    const udzial = indeksPromienia(50) / (PROMIENIE_SUWAK_KM.length - 1);
    expect(udzial).toBeGreaterThan(0.66);
    expect(udzial).toBeLessThan(1);
  });

  it('połowa suwaka to wciąż odległość w zasięgu miasta, nie międzymiastowa', () => {
    // Nie chodzi o konkretną liczbę, tylko o to, żeby środek suwaka nie
    // wylądował na wartości, której nikt nie wybiera.
    const srodek = promienZIndeksu(Math.floor((PROMIENIE_SUWAK_KM.length - 1) / 2));
    expect(srodek).toBeLessThanOrEqual(20);
  });

  it('domyślny promień jest jednym z przystanków, nie wpada między nie', () => {
    expect(PROMIENIE_SUWAK_KM).toContain(PROMIEN_DOMYSLNY_KM);
  });

  it('dawne wartości pigułek (5/10/25/50) mają swój przystanek', () => {
    // Filtr zapisany w adresie sprzed zmiany ma trafić w istniejącą pozycję,
    // a nie między dwie — inaczej otwarcie starego linku przestawiałoby promień.
    for (const km of [5, 10, 25, 50]) {
      expect(promienZIndeksu(indeksPromienia(km))).toBe(km);
    }
  });
});

describe('indeksPromienia', () => {
  it('wartość spoza skali ląduje na najbliższym przystanku', () => {
    expect(promienZIndeksu(indeksPromienia(11))).toBe(10);
    expect(promienZIndeksu(indeksPromienia(26))).toBe(25);
  });

  it('przy REMISIE wybiera niższy przystanek — filtr nie poszerza się sam', () => {
    // 6 km leży dokładnie między 5 a 7, 90 km między 80 a 100. W obu razach
    // wygrywa węższy: ktoś dostaje mniej meczów, a nie takie, o które nie prosił.
    expect(promienZIndeksu(indeksPromienia(6))).toBe(5);
    expect(promienZIndeksu(indeksPromienia(90))).toBe(80);
  });

  it('wartość poniżej skali nie daje ujemnego indeksu', () => {
    // `-1` przewróciłoby suwak na sam lewy skraj i zgubiło wybór.
    expect(indeksPromienia(0)).toBe(0);
    expect(indeksPromienia(-5)).toBe(0);
  });

  it('wartość powyżej skali zatrzymuje się na ostatnim przystanku', () => {
    expect(promienZIndeksu(indeksPromienia(500))).toBe(100);
  });
});

describe('promienZIndeksu', () => {
  it('przycina indeks do zakresu tablicy', () => {
    expect(promienZIndeksu(-3)).toBe(PROMIENIE_SUWAK_KM[0]);
    expect(promienZIndeksu(999)).toBe(PROMIENIE_SUWAK_KM[PROMIENIE_SUWAK_KM.length - 1]);
  });

  it('jest odwrotnością indeksPromienia dla każdego przystanku', () => {
    PROMIENIE_SUWAK_KM.forEach((km, i) => {
      expect(indeksPromienia(km)).toBe(i);
      expect(promienZIndeksu(i)).toBe(km);
    });
  });
});
