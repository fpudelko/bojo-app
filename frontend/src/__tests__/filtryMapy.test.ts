import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { MAP_FILTER_SPORTS, SPORTY_NA_MAPIE, pasujeSport, rozwinSporty } from '@/lib/sports';

// Filtry mapy — jedna lista sportów i jedna definicja liczenia obiektów.
//
// SKĄD TEN PLIK. Przegląd z 18.09.2026, zgłoszony jednym zdaniem: „filtry
// na mapie się nie zgadzają i niektóre się dublują". Pod spodem siedziały
// trzy różne rozjazdy, z których każdy da się złapać tanio:
//
//  1. Ta sama lista sportów wypisana w DWÓCH miejscach — filtr
//     (`MAP_FILTER_SPORTS`) i bramka zapytań o obiekty (dawne `EXPLORER_SPORTS`
//     w `lib/api.ts`). Rozjazd znaczy filtr obiecujący sport, którego pinezki
//     nigdy nie przychodzą, albo mapę liczącą obiekty, których nie da się
//     wybrać.
//  2. Futsal. `FOCUS_SPORTS` celowo go nie ma („w interfejsie to ta sama
//     piłka nożna"), ale w katalogu 95 publicznych obiektów ma w `sport`
//     WYŁĄCZNIE `futsal` — więc wybranie „Piłka nożna" zdejmowało im pinezkę.
//  3. `mapa_skupiska` liczyła `count(*)` po `unnest(f.sport)`, czyli parę
//     obiekt-sport zamiast obiektu: boisko opisane dwoma sportami wchodziło
//     do liczby dwa razy i licznik nad mapą nie zgadzał się z liczbą pinezek
//     po przybliżeniu (38 314 wobec 35 952 realnych obiektów).

describe('sporty mapy — jedna lista, futsal w piłce nożnej', () => {
  it('bramka zapytań pokrywa cały filtr', () => {
    for (const s of MAP_FILTER_SPORTS) expect(SPORTY_NA_MAPIE).toContain(s);
  });

  it('„Piłka nożna" łapie obiekty opisane wyłącznie jako futsal', () => {
    expect(rozwinSporty(['piłka nożna'])).toContain('futsal');
    expect(pasujeSport(['futsal'], ['piłka nożna'])).toBe(true);
    // W drugą stronę już nie: kto wybrał siatkówkę, nie ma dostać piłki.
    expect(pasujeSport(['futsal'], ['siatkówka'])).toBe(false);
  });

  it('pusty wybór przepuszcza wszystko, a rozwinięcie nie dubluje wartości', () => {
    expect(pasujeSport(['koszykówka'], [])).toBe(true);
    expect(rozwinSporty(['piłka nożna', 'piłka nożna'])).toEqual(['piłka nożna', 'futsal']);
  });
});

// Najnowsza definicja funkcji wygrywa — migracje puszcza się po kolei, więc
// stan bazy opisuje ostatni plik, który jej dotyka.
function ostatniaDefinicjaSkupisk(): string {
  const katalog = path.join(process.cwd(), '..', 'supabase', 'migrations');
  const pliki = readdirSync(katalog)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => readFileSync(path.join(katalog, f), 'utf8').includes('FUNCTION mapa_skupiska'));
  expect(pliki.length).toBeGreaterThan(0);
  const tresc = readFileSync(path.join(katalog, pliki[pliki.length - 1]), 'utf8');
  // Bez komentarzy: nagłówek migracji CYTUJE stary, błędny `count(*)`, żeby
  // opisać, co się zmieniło — a test pyta o to, co baza wykona.
  return tresc.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
}

describe('mapa_skupiska liczy obiekty, nie pary obiekt-sport', () => {
  const sql = ostatniaDefinicjaSkupisk();

  it('liczy DISTINCT po identyfikatorze obiektu', () => {
    expect(sql).toMatch(/count\(\s*DISTINCT\s+f\.id\s*\)/i);
    // `count(*)` przy `CROSS JOIN LATERAL unnest(f.sport)` to dokładnie ten błąd.
    expect(sql).not.toMatch(/count\(\s*\*\s*\)/);
  });

  it('przyjmuje nawierzchnię, czyli wszystkie filtry obiektu, jakie ma mapa', () => {
    expect(sql).toContain('p_nawierzchnie');
    // `p_typy` odszedł razem z filtrem „Typ obiektu" (dublował sekcję Sport).
    expect(sql).not.toContain('p_typy TEXT[]');
  });
});
