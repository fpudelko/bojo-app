import { describe, it, expect } from 'vitest';
import { zrodloZdarzenia, rozbicieWgZrodla, konwersjaZKatalogu } from '@/lib/analytics';

// Odczyt pomiaru ruchu z katalogu — reguła „co liczy się do pozyskania".
//
// Powód istnienia tych asercji: zdarzenia `boisko_otwarte` zbierały się od
// 2026-09-16, ale panel pokazywał wyłącznie typ zdarzenia, więc `zrodlo` — jedyny
// powód, dla którego ten pomiar powstał — dało się odczytać tylko zapytaniem SQL.
// Przy pierwszym spojrzeniu na produkcję nie dało się nawet rozstrzygnąć, czy
// dziewięć wejść pod rząd to dziewięć odsłon, czy jedna licząca się dziewięć razy.
//
// Najważniejsza z tych reguł to WYŁĄCZENIE ruchu wewnętrznego z mianownika
// konwersji: przejście z mapy Bojo na stronę boiska nie jest pozyskaniem i
// rozmyłoby jedyną liczbę, dla której cały pomiar powstał.

describe('zrodloZdarzenia', () => {
  it('czyta źródło z metadanych zdarzenia', () => {
    expect(zrodloZdarzenia({ zrodlo: 'wyszukiwarka' })).toBe('wyszukiwarka');
    expect(zrodloZdarzenia({ zrodlo: 'model' })).toBe('model');
  });

  it('brak metadanych to „nieznane", nie wywrotka', () => {
    // Wiersze sprzed 2026-09-16 nie mają tego pola w ogóle.
    expect(zrodloZdarzenia(null)).toBe('nieznane');
    expect(zrodloZdarzenia(undefined)).toBe('nieznane');
    expect(zrodloZdarzenia({})).toBe('nieznane');
  });

  it('wartość spoza listy traktujemy jak brak — metadane nie są kontraktem', () => {
    // Pole przychodzi z przeglądarki, więc jest danymi wejściowymi, nie obietnicą.
    expect(zrodloZdarzenia({ zrodlo: 'cokolwiek' })).toBe('nieznane');
    expect(zrodloZdarzenia({ zrodlo: 42 })).toBe('nieznane');
  });
});

describe('rozbicieWgZrodla', () => {
  it('liczy wejścia po źródle, malejąco', () => {
    const wynik = rozbicieWgZrodla([
      { metadata: { zrodlo: 'wewnetrzne' } },
      { metadata: { zrodlo: 'wyszukiwarka' } },
      { metadata: { zrodlo: 'wyszukiwarka' } },
      { metadata: { zrodlo: 'wyszukiwarka' } },
      { metadata: { zrodlo: 'model' } },
      { metadata: { zrodlo: 'model' } },
    ]);
    expect(wynik).toEqual([
      { zrodlo: 'wyszukiwarka', ile: 3 },
      { zrodlo: 'model', ile: 2 },
      { zrodlo: 'wewnetrzne', ile: 1 },
    ]);
  });

  it('nie pokazuje pozycji zerowych — pusty wiersz niczego nie mówi', () => {
    const wynik = rozbicieWgZrodla([{ metadata: { zrodlo: 'model' } }]);
    expect(wynik).toEqual([{ zrodlo: 'model', ile: 1 }]);
  });

  it('pusta lista daje pustą listę, nie wyjątek', () => {
    expect(rozbicieWgZrodla([])).toEqual([]);
  });

  it('remis rozstrzyga alfabetycznie — kolejność ma być stabilna między odświeżeniami', () => {
    const wynik = rozbicieWgZrodla([
      { metadata: { zrodlo: 'wyszukiwarka' } },
      { metadata: { zrodlo: 'model' } },
    ]);
    expect(wynik.map((w) => w.zrodlo)).toEqual(['model', 'wyszukiwarka']);
  });
});

describe('konwersjaZKatalogu', () => {
  const wejscie = (z: string) => ({ metadata: { zrodlo: z } });

  it('WYKLUCZA ruch wewnętrzny z mianownika', () => {
    // Trzy wejścia, z czego dwa z mapy Bojo → mianownikiem jest jedno.
    const { zZewnatrz, procent } = konwersjaZKatalogu(
      [wejscie('wewnetrzne'), wejscie('wewnetrzne'), wejscie('wyszukiwarka')],
      1,
    );
    expect(zZewnatrz).toBe(1);
    expect(procent).toBe(100);
  });

  it('ruch z modelu liczy się do pozyskania tak samo jak z wyszukiwarki', () => {
    const { zZewnatrz } = konwersjaZKatalogu([wejscie('model'), wejscie('wyszukiwarka')], 0);
    expect(zZewnatrz).toBe(2);
  });

  it('zero wejść z zewnątrz daje null, nie 0% — nie ma jeszcze czego mierzyć', () => {
    // „0%" czytałoby się jak zmierzona porażka; null mówi „brak danych".
    expect(konwersjaZKatalogu([wejscie('wewnetrzne')], 0).procent).toBeNull();
    expect(konwersjaZKatalogu([], 0).procent).toBeNull();
  });

  it('procent zaokrągla do jednego miejsca po przecinku', () => {
    const { procent } = konwersjaZKatalogu(Array(7).fill(wejscie('wyszukiwarka')), 1);
    expect(procent).toBe(14.3);
  });
});
